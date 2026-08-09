#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, readdirSync, statfsSync, statSync } from "node:fs";
import http from "node:http";
import { basename, extname, join, resolve } from "node:path";

const listenHost = process.env.LAB_HOST || "0.0.0.0";
const listenPort = Number(process.env.PORT || 8080);
const uiHost = "127.0.0.1";
const uiPort = Number(process.env.LAB_UI_PORT || listenPort + 1);
const configPath = process.env.LAB_CONFIG || "/etc/cheesegrater-ai-lab/config.json";
const webDirectory = process.env.LAB_WEB_DIR || resolve(import.meta.dirname, "../web");

function loadConfig() {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.version !== 1) throw new Error(`Unsupported configuration version: ${config.version}`);
  return config;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return undefined;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function storageSnapshot(path) {
  if (!path) return undefined;
  const stats = statfsSync(path);
  const total = Number(stats.blocks) * Number(stats.bsize);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const used = total - Number(stats.bfree) * Number(stats.bsize);
  return {
    path,
    used: `${formatBytes(used)} used`,
    available: `${formatBytes(available)} available`,
    total: formatBytes(total),
    usedPercent: total ? Math.round((used / total) * 1000) / 10 : 0,
  };
}

function filesBelow(roots, extensions) {
  const files = new Map();
  const pending = roots.map((path) => resolve(path));
  while (pending.length && files.size < 100_000) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory() && entry.name !== "outputs" && entry.name !== ".git") pending.push(path);
      else if ((entry.isFile() || entry.isSymbolicLink()) && extensions.has(extname(entry.name).toLowerCase())) {
        try {
          const stats = statSync(path);
          if (stats.isFile()) files.set(path, { path, size: stats.size });
        } catch {}
      }
    }
  }
  return files;
}

function huggingFaceReference(path) {
  const match = path.match(/\/models--([^/]+)\/snapshots\/[^/]+\/([^/]+\.gguf)$/i);
  if (!match) return null;
  const parts = match[1].split("--");
  if (parts.length < 2) return null;
  const repository = `${parts.shift()}/${parts.join("--")}`;
  const quantization = match[2].match(/-([A-Za-z0-9]+(?:_[A-Za-z0-9]+)+)(?:-\d+-of-\d+)?\.gguf$/i)?.[1];
  return quantization ? `${repository}:${quantization}` : repository;
}

function modelRecord(file, type) {
  const filename = basename(file.path);
  const reference = type === "language" ? huggingFaceReference(file.path) : null;
  return {
    id: file.path,
    name: reference || filename.replace(/\.[^.]+$/, ""),
    filename,
    type,
    size: formatBytes(file.size),
    reference: reference || filename,
    source: reference ? "Hugging Face" : "Local storage",
  };
}

function systemSnapshot() {
  const config = loadConfig();
  const language = [...filesBelow(config.models?.languageRoots || [], new Set([".gguf"])).values()]
    .filter((file) => !basename(file.path).toLowerCase().startsWith("mmproj-"))
    .map((file) => modelRecord(file, "language"));
  const images = [...filesBelow(config.models?.imageRoots || [], new Set([".safetensors", ".ckpt", ".gguf", ".pt", ".pth", ".bin"])).values()]
    .map((file) => modelRecord(file, "image"));
  const items = [...language, ...images].sort((left, right) => left.name.localeCompare(right.name));
  return {
    machine: config.machine || undefined,
    accelerator: config.accelerator || undefined,
    backend: config.backend || undefined,
    storage: storageSnapshot(config.storage?.path),
    models: { total: items.length, language: language.length, image: images.length, items },
    services: {
      language: config.services?.language ? { engine: config.services.language.engine, configured: true } : { configured: false },
      image: config.services?.image ? { engine: config.services.image.engine, configured: true } : { configured: false },
    },
    configuredAt: config.generatedAt,
  };
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65_536) reject(new Error("Request is too large"));
    });
    request.on("end", () => {
      try { resolveBody(JSON.parse(body || "{}")); }
      catch { reject(new Error("Invalid JSON")); }
    });
    request.on("error", reject);
  });
}

function runExecutable(executable, args, timeoutMs) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, {
      env: {
        ...process.env,
        PATH: `/opt/rocm/bin:/opt/rocm/lib/llvm/bin:${process.env.PATH || "/usr/local/bin:/usr/bin:/bin"}`,
        LD_LIBRARY_PATH: `/opt/rocm/lib:/opt/rocm/lib64${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""}`,
        HIP_CACHE_DIR: "/tmp/cheesegrater-ai-lab-hip-cache",
        XDG_CACHE_HOME: "/tmp/cheesegrater-ai-lab-cache",
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (chunk) => { if (stdout.length < 8_000_000) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < 8_000_000) stderr += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolveRun({ stdout, stderr });
      else reject(new Error((stderr || stdout || `Process stopped (${signal || code})`).trim().slice(-4000)));
    });
  });
}

function cleanText(value) {
  return value.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/^>\s*/gm, "").trim();
}

function modelById(type, id) {
  return systemSnapshot().models.items.find((model) => model.type === type && model.id === id);
}

let languageBusy = false;
let imageBusy = false;

async function runChat(request, response) {
  if (languageBusy) return json(response, 409, { error: "The language model is already working" });
  try {
    const body = await readJson(request);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const model = modelById("language", body.modelId);
    const executable = loadConfig().services?.language?.executable;
    if (!model || !executable || !message) return json(response, 400, { error: "Choose a model and enter a message" });
    if (message.length > 16_000) return json(response, 400, { error: "Message is too long" });
    languageBusy = true;
    const result = await runExecutable(executable, [
      "-m", model.id,
      "-p", message,
      "-n", "384",
      "-ngl", "999",
      "--no-display-prompt",
      "--simple-io",
      "--single-turn",
    ], 15 * 60_000);
    const answer = cleanText(result.stdout);
    json(response, 200, { answer: answer || "The model returned an empty response" });
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "Local language generation failed", detail: error.message });
  } finally {
    languageBusy = false;
  }
}

async function runImage(request, response) {
  if (imageBusy) return json(response, 409, { error: "The image model is already working" });
  try {
    const body = await readJson(request);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const model = modelById("image", body.modelId);
    const config = loadConfig();
    const executable = config.services?.image?.executable;
    if (!model || !executable || !prompt) return json(response, 400, { error: "Choose a model and enter a prompt" });
    if (prompt.length > 4_000) return json(response, 400, { error: "Prompt is too long" });
    const outputRoot = config.outputs?.images || join(config.storage.path, "diffusion/outputs/lab");
    mkdirSync(outputRoot, { recursive: true });
    const filename = `image-${Date.now()}-${randomBytes(4).toString("hex")}.png`;
    const output = join(outputRoot, filename);
    imageBusy = true;
    await runExecutable(executable, [
      "-m", model.id,
      "-p", prompt,
      "-o", output,
      "-W", "512",
      "-H", "512",
      "--steps", "20",
    ], 20 * 60_000);
    statSync(output);
    json(response, 200, { imageUrl: `/api/outputs/${filename}` });
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "Local image generation failed", detail: error.message });
  } finally {
    imageBusy = false;
  }
}

function serveOutput(url, response) {
  const filename = basename(url.pathname);
  if (!/^image-[0-9]+-[a-f0-9]+\.png$/.test(filename)) return json(response, 404, { error: "Image not found" });
  try {
    const config = loadConfig();
    const outputRoot = config.outputs?.images || join(config.storage.path, "diffusion/outputs/lab");
    const path = join(outputRoot, filename);
    const stats = statSync(path);
    response.writeHead(200, {
      "content-type": "image/png",
      "content-length": stats.size,
      "cache-control": "private, max-age=86400",
    });
    createReadStream(path).pipe(response);
  } catch {
    json(response, 404, { error: "Image not found" });
  }
}

const ui = spawn("npm", ["run", "start", "--", "--hostname", uiHost, "--port", String(uiPort)], {
  cwd: webDirectory,
  env: { ...process.env, PORT: String(uiPort) },
  stdio: "inherit",
});

ui.once("exit", (code, signal) => {
  console.error(`UI process stopped (${signal || code || 0})`);
  process.exit(code || 1);
});

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/system") {
    try {
      json(response, 200, systemSnapshot());
    } catch (error) {
      console.error(error);
      json(response, 503, { error: "System configuration is unavailable" });
    }
    return;
  }
  if (url.pathname === "/api/health") {
    json(response, 200, { status: "ok", jobs: { languageBusy, imageBusy } });
    return;
  }
  if (url.pathname === "/api/chat" && request.method === "POST") return void runChat(request, response);
  if (url.pathname === "/api/images" && request.method === "POST") return void runImage(request, response);
  if (url.pathname.startsWith("/api/outputs/") && request.method === "GET") return void serveOutput(url, response);

  const proxy = http.request({
    hostname: uiHost,
    port: uiPort,
    method: request.method,
    path: request.url,
    headers: { ...request.headers, host: `${uiHost}:${uiPort}` },
  }, (upstream) => {
    response.writeHead(upstream.statusCode || 502, upstream.headers);
    upstream.pipe(response);
  });
  proxy.on("error", () => json(response, 503, { error: "Interface is starting" }));
  request.pipe(proxy);
});

server.listen(listenPort, listenHost, () => {
  console.log(`Cheesegrater AI Lab listening on http://${listenHost}:${listenPort}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  ui.kill("SIGTERM");
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
