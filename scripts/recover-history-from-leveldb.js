const fs = require("fs");
const path = require("path");

const inputDir = process.argv[2];
const outputFile = process.argv[3] || path.join(process.cwd(), "recovered-chrome-smith-history.json");
const keyNames = ["chromeSmithAssetLibrary", "chromeSmithGenerationHistory"];

if (!inputDir) {
  console.error("Usage: node scripts/recover-history-from-leveldb.js <leveldb-dir> [output-file]");
  process.exit(1);
}

function decodeCandidates(buffer) {
  const utf8 = buffer.toString("utf8");
  const utf16 = buffer.toString("utf16le");
  return [
    utf8,
    utf8.replace(/\u0000/g, ""),
    utf16,
    utf16.replace(/\u0000/g, "")
  ];
}

function findBalancedArray(text, start) {
  let inString = false;
  let escape = false;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseHistoryArray(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed)) return null;
    const assetLike = parsed.filter(item => item && typeof item === "object" && item.image);
    if (!assetLike.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function repairJsonCandidate(candidate) {
  return candidate
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\([^"\\/bfnrtu])/g, "$1");
}

function extractField(chunk, field) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`);
  return chunk.match(pattern)?.[1] || "";
}

function extractObjectRecords(text, file) {
  const normalized = text.replace(/\u0000/g, "");
  const keyIndex = normalized.indexOf("chromeSmithAssetLibrary");
  if (keyIndex === -1) return [];
  const start = normalized.indexOf("[", keyIndex);
  if (start === -1) return [];
  const endMarkers = [
    normalized.indexOf("\u0001\u001aMETA:", start),
    normalized.indexOf("META:http://localhost:3000", start)
  ].filter(index => index > start);
  const roughEnd = endMarkers.length ? Math.min(...endMarkers) : normalized.length;
  const candidate = repairJsonCandidate(normalized.slice(start, roughEnd));
  const objectStarts = [];
  const startPattern = /\{"id"\s*:\s*"/g;
  let match;
  while ((match = startPattern.exec(candidate))) objectStarts.push(match.index);
  const records = [];
  for (let index = 0; index < objectStarts.length; index += 1) {
    const chunk = candidate.slice(objectStarts[index], objectStarts[index + 1] || candidate.length);
    const id = extractField(chunk, "id");
    const type = extractField(chunk, "type") || "generate";
    const prompt = extractField(chunk, "prompt");
    const action = extractField(chunk, "action") || extractField(chunk, "angle");
    const createdAtRaw = chunk.match(/"createdAt"\s*:\s*([0-9]+)/)?.[1];
    const imageStartToken = "\"image\":\"data:image/png;base64,";
    const imageStart = chunk.indexOf(imageStartToken);
    if (!id || imageStart === -1) continue;
    const imageValueStart = imageStart + "\"image\":\"".length;
    const afterImage = chunk.slice(imageValueStart);
    const terminators = [
      afterImage.search(/","prompt"\s*:/),
      afterImage.search(/","sourceImage"\s*:/),
      afterImage.search(/","action"\s*:/),
      afterImage.search(/","settings"\s*:/),
      afterImage.search(/","createdAt"\s*:/)
    ].filter(position => position >= 0);
    if (!terminators.length) continue;
    const rawImage = afterImage.slice(0, Math.min(...terminators));
    const image = `data:image/png;base64,${rawImage.replace(/^data:image\/png;base64,/, "").replace(/[^A-Za-z0-9+/=]/g, "")}`;
    if (image.length < 100) continue;
    records.push({
      id,
      type,
      image,
      prompt,
      action,
      createdAt: createdAtRaw ? Number(createdAtRaw) : Date.now(),
      recoveredFrom: path.basename(file)
    });
  }
  return records;
}

function extractArraysFromText(text, file) {
  const arrays = [];
  for (const key of keyNames) {
    let cursor = 0;
    while (cursor < text.length) {
      const keyIndex = text.indexOf(key, cursor);
      if (keyIndex === -1) break;
      const arrayStart = text.indexOf("[", keyIndex + key.length);
      if (arrayStart === -1) break;
      const candidate = findBalancedArray(text, arrayStart);
      if (!candidate) {
        cursor = keyIndex + key.length;
        continue;
      }
      const parsed = parseHistoryArray(candidate);
      if (parsed) {
        arrays.push({
          key,
          file,
          count: parsed.length,
          jsonLength: candidate.length,
          parsed
        });
      }
      cursor = arrayStart + candidate.length;
    }
  }
  return arrays;
}

function uniqueById(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const id = item.id || `${item.type || "asset"}-${item.createdAt || ""}-${item.image?.slice(0, 80) || ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    output.push(item);
  }
  return output;
}

const files = fs.readdirSync(inputDir)
  .filter(name => /\.(log|ldb|sst)$/.test(name))
  .map(name => path.join(inputDir, name));

const matches = [];
for (const file of files) {
  const buffer = fs.readFileSync(file);
  for (const text of decodeCandidates(buffer)) {
    matches.push(...extractArraysFromText(text, file));
    const reconstructed = extractObjectRecords(text, file);
    if (reconstructed.length) {
      matches.push({
        key: "chromeSmithAssetLibrary",
        file,
        count: reconstructed.length,
        jsonLength: reconstructed.reduce((sum, item) => sum + item.image.length, 0),
        parsed: reconstructed
      });
    }
  }
}

matches.sort((a, b) => b.count - a.count || b.jsonLength - a.jsonLength);
if (!matches.length) {
  console.error("No Chrome Smith history arrays found.");
  process.exit(2);
}

const merged = uniqueById(matches.flatMap(match => match.parsed))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2));

console.log(JSON.stringify({
  outputFile,
  arraysFound: matches.length,
  bestArrayCount: matches[0].count,
  recoveredAssetCount: merged.length,
  sourceFiles: [...new Set(matches.map(match => match.file))]
}, null, 2));
