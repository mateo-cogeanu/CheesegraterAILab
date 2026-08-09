import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

async function waitFor(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

test("serves machine configuration with live storage and model data", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "cheesegrater-lab-test-"));
  const languageRoot = join(directory, "language");
  const imageRoot = join(directory, "images");
  const cachedModel = join(languageRoot, "models--publisher--example-GGUF", "snapshots", "revision");
  const blobDirectory = join(languageRoot, "models--publisher--example-GGUF", "blobs");
  await mkdir(cachedModel, { recursive: true });
  await mkdir(blobDirectory, { recursive: true });
  await mkdir(imageRoot);
  await writeFile(join(blobDirectory, "model-hash"), "model");
  await symlink("../../blobs/model-hash", join(cachedModel, "example-Q4_K_M.gguf"));
  await symlink("../../blobs/model-hash", join(cachedModel, "mmproj-example-bf16.gguf"));
  await writeFile(join(imageRoot, "test.safetensors"), "model");

  const configPath = join(directory, "config.json");
  await writeFile(configPath, JSON.stringify({
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    machine: { name: "Test lab" },
    accelerator: { name: "Detected accelerator" },
    backend: { name: "Detected backend" },
    storage: { path: directory },
    models: { languageRoots: [languageRoot], imageRoots: [imageRoot] },
    outputs: { images: join(directory, "outputs") },
    services: { language: { engine: "test", executable: "/bin/echo" }, image: null },
  }));

  const port = 32_000 + Math.floor(Math.random() * 2_000);
  const child = spawn(process.execPath, [resolve(import.meta.dirname, "lab-server.mjs")], {
    env: {
      ...process.env,
      PORT: String(port),
      LAB_UI_PORT: String(port + 1),
      LAB_CONFIG: configPath,
      LAB_WEB_DIR: resolve(import.meta.dirname, "../web"),
    },
    stdio: "ignore",
  });
  context.after(async () => {
    child.kill("SIGTERM");
    await rm(directory, { recursive: true, force: true });
  });

  await waitFor(`http://127.0.0.1:${port}/api/health`);
  const response = await fetch(`http://127.0.0.1:${port}/api/system`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.machine.name, "Test lab");
  assert.equal(payload.accelerator.name, "Detected accelerator");
  assert.match(payload.storage.available, / available$/);
  assert.equal(payload.models.total, 2);
  assert.equal(payload.models.language, 1);
  assert.equal(payload.models.image, 1);
  assert.equal(payload.models.items.length, 2);
  assert.equal(payload.models.items[0].reference, "publisher/example-GGUF:Q4_K_M");

  const chatResponse = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: payload.models.items[0].id, message: "hello locally" }),
  });
  assert.equal(chatResponse.status, 200);
  assert.match((await chatResponse.json()).answer, /hello locally/);
});
