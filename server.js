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

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
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

function requestImage(prompt, resolution, transparentBackground) {
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

    const endpoint = new URL(`${apiBase.replace(/\/$/, "")}/images/generations`);
    const body = {
      model,
      prompt,
      n: 1,
      size: API_IMAGE_SIZE,
      output_format: "png",
      quality: transparentBackground ? "high" : "auto"
    };
    if (transparentBackground) body.background = "transparent";
    const payload = JSON.stringify(body);
    const transport = endpoint.protocol === "http:" ? http : https;
    const upstream = transport.request(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 120_000
    }, response => {
      let data = "";
      response.on("data", chunk => { data += chunk; });
      response.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          reject(new Error("Image service returned an unreadable response."));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(parsed.error?.message || `Image service returned ${response.statusCode}.`));
          return;
        }
        resolve(parsed);
      });
    });
    upstream.on("timeout", () => upstream.destroy(new Error("Image generation timed out.")));
    upstream.on("error", reject);
    upstream.end(payload);
  });
}

function getImageSource(payload) {
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

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(path.join(ROOT, "index.html")).pipe(response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    json(response, 200, {
      ready: Boolean(process.env.API_BASE_URL && process.env.OPENAI_API_KEY && process.env.OPENAI_IMAGE_MODEL)
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate") {
    try {
      const { prompt, selectedAngleId = "angle_center", resolution = "1K", transparentBackground = true } = await readJson(request);
      if (typeof prompt !== "string" || !prompt.trim()) {
        json(response, 400, { error: "Enter a prompt before generating." });
        return;
      }
      const resolutionMetadata = getResolutionMetadata(resolution);
      if (typeof transparentBackground !== "boolean") {
        json(response, 400, { error: "Transparent background must be enabled or disabled." });
        return;
      }
      const promptPlan = buildPrompt({
        feature: "generate",
        userPrompt: prompt.trim(),
        selectedAngleId
      });
      console.log("Generate prompt builder:", {
        assetCategory: promptPlan.assetCategory,
        material: promptPlan.material,
        selectedAngleId: promptPlan.selectedAngle.id,
        selectedReferenceCount: promptPlan.selectedReferences.length,
        resolution
      });
      const payload = await requestImage(promptPlan.finalPrompt, resolution, transparentBackground);
      json(response, 200, {
        image: getImageSource(payload),
        resolution,
        ...resolutionMetadata,
        transparentBackground,
        outputFormat: "png",
        promptBuilder: {
          assetCategory: promptPlan.assetCategory,
          material: promptPlan.material,
          selectedAngle: promptPlan.selectedAngle,
          selectedReferences: promptPlan.selectedReferences
        }
      });
    } catch (error) {
      console.error("Generation failed:", error.message);
      json(response, 502, { error: error.message });
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Chrome Smith is running at http://localhost:${PORT}`);
});
