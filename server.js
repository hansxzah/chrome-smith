const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { buildPrompt } = require("./utils/promptBuilder");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const ENV_FILE = path.join(ROOT, "ChromeSmithKey.env");
const DOWNLOAD_TTL = 5 * 60 * 1000;
const API_IMAGE_SIZE = "1024x1024";
const RESOLUTION_TARGETS = {
  "1K": "1024x1024",
  "2K": "2048x2048"
};
const downloads = new Map();

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(ENV_FILE);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
  response.end(JSON.stringify(body));
}

function readJson(request, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > limit) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function readForm(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 12_000_000) request.destroy();
    });
    request.on("end", () => resolve(Object.fromEntries(new URLSearchParams(body))));
    request.on("error", reject);
  });
}

function supportsTransparentBackground(model) {
  return ["gpt-image-1", "gpt-image-1.5"].includes(model);
}

function getResolutionMetadata(resolution) {
  const targetSize = RESOLUTION_TARGETS[resolution];
  if (!targetSize) throw new Error("Choose a supported resolution.");
  return {
    requestedResolution: resolution,
    requestedApiSize: API_IMAGE_SIZE,
    targetSize
  };
}

function getReferenceLibraryFilePath(referencePath) {
  const relativePath = String(referencePath || "").replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, relativePath));
  const allowedRoot = path.join(ROOT, "reference-library");
  if (!filePath.startsWith(allowedRoot + path.sep) && filePath !== allowedRoot) {
    throw new Error("Invalid reference image path.");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("Selected angle reference image is missing.");
  }
  return filePath;
}

function appendMultipartField(parts, boundary, name, value) {
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
}

function appendMultipartFile(parts, boundary, name, filePath) {
  const filename = path.basename(filePath);
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${getContentType(filePath)}\r\n\r\n`));
  parts.push(fs.readFileSync(filePath));
  parts.push(Buffer.from("\r\n"));
}

function createImageMultipartPayload({ model, prompt, transparentBackground, referenceImages }) {
  const boundary = `chrome-smith-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const parts = [];
  appendMultipartField(parts, boundary, "model", model);
  appendMultipartField(parts, boundary, "prompt", prompt);
  appendMultipartField(parts, boundary, "n", "1");
  appendMultipartField(parts, boundary, "size", API_IMAGE_SIZE);
  appendMultipartField(parts, boundary, "output_format", "png");
  appendMultipartField(parts, boundary, "quality", transparentBackground ? "high" : "auto");
  appendMultipartField(parts, boundary, "input_fidelity", "high");
  if (transparentBackground) appendMultipartField(parts, boundary, "background", "transparent");
  referenceImages.forEach(filePath => appendMultipartFile(parts, boundary, "image[]", filePath));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function createImageJsonPayload({ model, prompt, transparentBackground }) {
  const body = {
    model,
    prompt,
    n: 1,
    size: API_IMAGE_SIZE,
    output_format: "png",
    quality: transparentBackground ? "high" : "auto"
  };
  if (transparentBackground) body.background = "transparent";
  return {
    body: Buffer.from(JSON.stringify(body)),
    contentType: "application/json"
  };
}

function requestImage(prompt, resolution, transparentBackground, options = {}) {
  return new Promise((resolve, reject) => {
    const apiBase = process.env.API_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_IMAGE_MODEL;
    if (!apiBase || !apiKey || !model) {
      reject(new Error("Server configuration is incomplete."));
      return;
    }
    if (transparentBackground && !supportsTransparentBackground(model)) {
      reject(new Error(`${model} does not support native transparent backgrounds.`));
      return;
    }

    const referenceImages = Array.isArray(options.referenceImages) ? options.referenceImages : [];
    const endpointPath = referenceImages.length ? "images/edits" : "images/generations";
    const endpoint = new URL(`${apiBase.replace(/\/$/, "")}/${endpointPath}`);
    const payload = referenceImages.length ? createImageMultipartPayload({
      model,
      prompt,
      transparentBackground,
      referenceImages
    }) : createImageJsonPayload({ model, prompt, transparentBackground });
    const transport = endpoint.protocol === "http:" ? http : https;
    const upstream = transport.request(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": payload.contentType,
        "Content-Length": payload.body.length
      },
      timeout: 120_000
    }, response => {
      const chunks = [];
      response.on("data", chunk => { chunks.push(chunk); });
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const upstreamContentType = response.headers["content-type"] || "";
        const upstreamDebug = {
          upstreamStatus: response.statusCode,
          upstreamContentType
        };
        if (response.statusCode < 200 || response.statusCode >= 300) {
          let message = `Image service returned ${response.statusCode}.`;
          try {
            const parsed = JSON.parse(buffer.toString("utf8"));
            message = parsed.error?.message || parsed.message || message;
          } catch {
            message = `${message} ${truncateText(buffer.toString("utf8"))}`;
          }
          const error = new Error(message);
          error.debug = { ...upstreamDebug, errorPreview: truncateText(message) };
          reject(error);
          return;
        }
        try {
          const normalized = normalizeImageResponse(buffer, upstreamContentType);
          console.log("Image service response:", {
            ...upstreamDebug,
            imageExtracted: Boolean(normalized.image),
            imageSourceType: normalized.sourceType
          });
          resolve({
            ...normalized,
            debug: {
              ...upstreamDebug,
              imageExtracted: Boolean(normalized.image),
              imageSourceType: normalized.sourceType
            }
          });
        } catch (error) {
          error.debug = { ...upstreamDebug, imageExtracted: false, errorPreview: truncateText(error.message) };
          reject(error);
        }
      });
    });
    upstream.on("timeout", () => upstream.destroy(new Error("Image generation timed out.")));
    upstream.on("error", reject);
    upstream.end(payload.body);
  });
}

function getImageSource(payload) {
  if (payload?.image) return payload.image;
  const image = payload.data?.[0];
  if (image?.url) return image.url;
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  throw new Error("Image service completed without returning an image.");
}

function getDownloadFilename(value) {
  const safe = String(value || "chrome-smith-image")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safe || "chrome-smith-image"}.png`;
}

function createDownload(image, filename) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  downloads.set(id, { image, filename, expiresAt: Date.now() + DOWNLOAD_TTL });
  return id;
}

function getPromptPreview(prompt, maxLength = 1200) {
  const value = String(prompt || "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function truncateText(value, maxLength = 200) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getMimeTypeFromBuffer(buffer, contentType = "") {
  const lowerContentType = String(contentType || "").toLowerCase();
  if (lowerContentType.includes("image/png")) return "image/png";
  if (lowerContentType.includes("image/jpeg") || lowerContentType.includes("image/jpg")) return "image/jpeg";
  if (lowerContentType.includes("image/webp")) return "image/webp";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return lowerContentType.startsWith("image/") ? lowerContentType.split(";")[0] : "image/png";
}

function isLikelyBase64Image(value) {
  const text = String(value || "").trim();
  return text.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(text);
}

function dataUrlFromBase64(base64, mimeType = "image/png") {
  return `data:${mimeType};base64,${String(base64 || "").replace(/\s+/g, "")}`;
}

function normalizeImageValue(value, mimeType = "image/png") {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(trimmed)) {
    return { image: trimmed, mimeType: trimmed.slice(5, trimmed.indexOf(";")), sourceType: "base64" };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { image: trimmed, mimeType, sourceType: "url" };
  }
  if (isLikelyBase64Image(trimmed)) {
    return { image: dataUrlFromBase64(trimmed, mimeType), mimeType, sourceType: "base64" };
  }
  return null;
}

function findImageInJson(payload, mimeType = "image/png") {
  const candidates = [];
  const firstData = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (firstData) {
    candidates.push(firstData.url, firstData.b64_json, firstData.image, firstData.image_base64);
  }
  candidates.push(payload?.url, payload?.b64_json, payload?.image, payload?.image_base64);
  const output = Array.isArray(payload?.output) ? payload.output : [];
  output.forEach(item => {
    candidates.push(item?.url, item?.b64_json, item?.image, item?.image_base64);
    if (Array.isArray(item?.content)) {
      item.content.forEach(content => candidates.push(content?.image, content?.b64_json, content?.image_base64, content?.url));
    }
  });
  for (const candidate of candidates) {
    const normalized = normalizeImageValue(candidate, mimeType);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeImageResponse(buffer, contentType = "") {
  const mimeType = getMimeTypeFromBuffer(buffer, contentType);
  const lowerContentType = String(contentType || "").toLowerCase();
  if (lowerContentType.startsWith("image/")) {
    return { image: dataUrlFromBase64(buffer.toString("base64"), mimeType), mimeType, sourceType: "binary" };
  }

  const text = buffer.toString("utf8").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text);
      const normalized = findImageInJson(parsed, mimeType);
      if (normalized) return normalized;
    } catch {}

    const normalizedText = normalizeImageValue(text, mimeType);
    if (normalizedText) return normalizedText;
  }

  if (lowerContentType.includes("json") || lowerContentType.startsWith("text/") || text.startsWith("{") || text.startsWith("[")) {
    throw new Error("Image service response did not include an image.");
  }

  if (buffer.length) {
    return { image: dataUrlFromBase64(buffer.toString("base64"), mimeType), mimeType, sourceType: "binary" };
  }

  throw new Error("Image service completed without returning an image.");
}

function downloadImage(source, filename, response) {
  let endpoint;
  try {
    endpoint = new URL(source);
  } catch {
    json(response, 400, { error: "Invalid image URL." });
    return;
  }
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    json(response, 400, { error: "Unsupported image URL." });
    return;
  }
  const transport = endpoint.protocol === "http:" ? http : https;
  const upstream = transport.get(endpoint, upstreamResponse => {
    if (upstreamResponse.statusCode < 200 || upstreamResponse.statusCode >= 300) {
      upstreamResponse.resume();
      json(response, 502, { error: "Could not download the generated image." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": upstreamResponse.headers["content-type"] || "image/png",
      "Content-Disposition": `attachment; filename="${getDownloadFilename(filename)}"`
    });
    upstreamResponse.pipe(response);
  });
  upstream.setTimeout(30_000, () => upstream.destroy(new Error("Image download timed out.")));
  upstream.on("error", error => json(response, 502, { error: error.message }));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function serveStaticFile(requestUrl, response) {
  const decodedPath = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = decodedPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, relativePath));
  const allowedRoot = path.join(ROOT, "reference-library");
  if (!filePath.startsWith(allowedRoot + path.sep) && filePath !== allowedRoot) {
    json(response, 403, { error: "Forbidden." });
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    json(response, 404, { error: "File not found." });
    return;
  }
  response.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(path.join(ROOT, "index.html")).pipe(response);
    return;
  }

  if (request.method === "GET" && new URL(request.url, "http://localhost").pathname.startsWith("/reference-library/")) {
    serveStaticFile(request.url, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    json(response, 200, {
      ready: Boolean(process.env.API_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_IMAGE_MODEL)
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate") {
    let safeDebug = {};
    try {
      const { prompt, selectedAngleId = "angle_center", resolution = "1K", transparentBackground = true, debugMetadata = {} } = await readJson(request);
      safeDebug = {
        clientSelectedAngleId: selectedAngleId,
        clientSelectedAngleLabel: typeof debugMetadata.selectedAngleLabel === "string" ? debugMetadata.selectedAngleLabel : null,
        resolution
      };
      if (typeof prompt !== "string" || !prompt.trim()) {
        json(response, 400, { ok: false, error: true, message: "Enter a prompt before generating.", debug: safeDebug });
        return;
      }
      const resolutionMetadata = getResolutionMetadata(resolution);
      if (typeof transparentBackground !== "boolean") {
        json(response, 400, { ok: false, error: true, message: "Transparent background must be enabled or disabled.", debug: safeDebug });
        return;
      }
      const promptPlan = buildPrompt({
        feature: "generate",
        userPrompt: prompt.trim(),
        selectedAngleId
      });
      const selectedAngleReferencePath = getReferenceLibraryFilePath(promptPlan.selectedAngle.path);
      const selectedStyleReferencePaths = promptPlan.selectedReferences.map(reference => getReferenceLibraryFilePath(reference.path));
      const referenceImages = [selectedAngleReferencePath, ...selectedStyleReferencePaths];
      safeDebug = {
        ...safeDebug,
        resolvedSelectedAngleId: promptPlan.selectedAngle.id,
        resolvedSelectedAngleLabel: promptPlan.selectedAngle.label,
        assetCategory: promptPlan.assetCategory,
        material: promptPlan.material,
        selectedAngleReferencePath: promptPlan.selectedAngle.path,
        selectedAngleReferenceAttached: true,
        selectedStyleReferenceIds: promptPlan.selectedReferences.map(reference => reference.id),
        selectedStyleReferencePaths: promptPlan.selectedReferences.map(reference => reference.path),
        selectedStyleReferenceCount: promptPlan.selectedReferences.length,
        attachedReferenceImageCount: referenceImages.length,
        finalPromptPreview: getPromptPreview(promptPlan.finalPrompt)
      };
      console.log("Generate prompt builder:", {
        assetCategory: promptPlan.assetCategory,
        material: promptPlan.material,
        clientSelectedAngleId: selectedAngleId,
        clientSelectedAngleLabel: typeof debugMetadata.selectedAngleLabel === "string" ? debugMetadata.selectedAngleLabel : undefined,
        selectedAngleId: promptPlan.selectedAngle.id,
        selectedAngleLabel: promptPlan.selectedAngle.label,
        selectedAngleReferenceAttached: true,
        selectedReferenceCount: promptPlan.selectedReferences.length,
        selectedStyleReferenceIds: promptPlan.selectedReferences.map(reference => reference.id),
        attachedReferenceImageCount: referenceImages.length,
        finalPromptPreview: getPromptPreview(promptPlan.finalPrompt, 500),
        resolution
      });
      const payload = await requestImage(promptPlan.finalPrompt, resolution, transparentBackground, {
        referenceImages
      });
      safeDebug = {
        ...safeDebug,
        upstreamStatus: payload.debug?.upstreamStatus,
        upstreamContentType: payload.debug?.upstreamContentType,
        imageExtracted: payload.debug?.imageExtracted,
        imageSourceType: payload.debug?.imageSourceType
      };
      json(response, 200, {
        ok: true,
        image: payload.image,
        mimeType: payload.mimeType || "image/png",
        resolution,
        ...resolutionMetadata,
        transparentBackground,
        outputFormat: "png",
        promptBuilder: {
          assetCategory: promptPlan.assetCategory,
          material: promptPlan.material,
          selectedAngle: promptPlan.selectedAngle,
          selectedReferences: promptPlan.selectedReferences,
          debug: safeDebug
        },
        debug: safeDebug
      });
    } catch (error) {
      const debug = {
        ...safeDebug,
        ...(error.debug || {}),
        messagePreview: truncateText(error.message)
      };
      console.error("Generation failed:", debug);
      json(response, 502, {
        ok: false,
        error: true,
        message: error.message || "Generation failed.",
        debug
      });
    }
    return;
  }

  if (request.method === "GET" && request.url.startsWith("/api/download?")) {
    const source = new URL(request.url, "http://localhost").searchParams.get("url");
    if (!source) {
      json(response, 400, { error: "Image URL is required." });
      return;
    }
    const filename = new URL(request.url, "http://localhost").searchParams.get("filename");
    downloadImage(source, filename, response);
    return;
  }

  if (request.method === "POST" && request.url === "/api/download-data") {
    try {
      const { image, filename } = await readForm(request);
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(image || "");
      if (!match) {
        json(response, 400, { error: "Valid image data is required." });
        return;
      }
      response.writeHead(200, {
        "Content-Type": match[1],
        "Content-Disposition": `attachment; filename="${getDownloadFilename(filename)}"`
      });
      response.end(Buffer.from(match[2], "base64"));
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/downloads") {
    try {
      const { image, filename } = await readJson(request, 12_000_000);
      if (!/^data:image\/(?:png|jpeg|webp);base64,/.test(image || "")) {
        json(response, 400, { error: "Valid image data is required." });
        return;
      }
      json(response, 201, { url: `/api/downloads/${createDownload(image, filename)}` });
    } catch (error) {
      json(response, 400, { error: error.message });
    }
    return;
  }

  if (request.method === "GET" && request.url.startsWith("/api/downloads/")) {
    const id = request.url.slice("/api/downloads/".length);
    const item = downloads.get(id);
    if (!item || item.expiresAt < Date.now()) {
      downloads.delete(id);
      json(response, 404, { error: "Download expired or was not found." });
      return;
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(item.image);
    response.writeHead(200, {
      "Content-Type": match[1],
      "Content-Disposition": `attachment; filename="${getDownloadFilename(item.filename)}"`
    });
    response.end(Buffer.from(match[2], "base64"));
    downloads.delete(id);
    return;
  }

  json(response, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`Chrome Smith is running at http://localhost:${PORT}`);
});
