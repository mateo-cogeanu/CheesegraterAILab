#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync, readdirSync, statfsSync } from "node:fs";
import http from "node:http";
import { extname, resolve } from "node:path";

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
  const files = new Set();
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
      else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) files.add(path);
    }
  }
  return files;
}

function systemSnapshot() {
  const config = loadConfig();
  const language = filesBelow(config.models?.languageRoots || [], new Set([".gguf"]));
  const images = filesBelow(config.models?.imageRoots || [], new Set([".safetensors", ".ckpt", ".gguf", ".pt", ".pth", ".bin"]));
  return {
    machine: config.machine || undefined,
    accelerator: config.accelerator || undefined,
    backend: config.backend || undefined,
    storage: storageSnapshot(config.storage?.path),
    models: { total: language.size + images.size, language: language.size, image: images.size },
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
    json(response, 200, { status: "ok" });
    return;
  }

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
