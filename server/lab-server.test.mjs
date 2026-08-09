import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
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
  const languageExecutable = join(directory, "test-language-runtime");
  await writeFile(languageExecutable, "#!/bin/sh\nprintf '[Start thinking]\\nI should reply locally.\\n[End thinking]\\nhello locally\\n'\n");
  await chmod(languageExecutable, 0o755);
  const quantizeExecutable = join(directory, "test-quantize-runtime");
  await writeFile(quantizeExecutable, "#!/bin/sh\nif [ \"$1\" = \"--allow-requantize\" ]; then shift; fi\ncp \"$1\" \"$2\"\n");
  await chmod(quantizeExecutable, 0o755);

  const configPath = join(directory, "config.json");
  await writeFile(configPath, JSON.stringify({
    version: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    machine: { name: "Test lab" },
    accelerator: { name: "Detected accelerator" },
    backend: { name: "Detected backend" },
    storage: { path: directory },
    models: { languageRoots: [languageRoot], imageRoots: [imageRoot], languageOutputRoot: languageRoot },
    outputs: { images: join(directory, "outputs") },
    services: { language: { engine: "test", executable: languageExecutable, quantizeExecutable }, image: null },
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
  assert.equal(payload.models.items[0].quantization.currentLevel, "Q4_K_M");
  assert.deepEqual(payload.models.items[0].quantization.options.map((option) => option.id), ["Q3_K_M", "Q2_K"]);
  assert.equal(payload.models.items[0].quantization.options[0].warning, true);
  assert.match(payload.models.items[0].quantization.options[0].estimatedSize, / B$/);
  assert.equal(payload.models.items[1].quantization.supported, false);

  const chatResponse = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: payload.models.items[0].id, message: "hello locally" }),
  });
  assert.equal(chatResponse.status, 200);
  const chatPayload = await chatResponse.json();
  assert.equal(chatPayload.answer, "hello locally");
  assert.equal("reasoning" in chatPayload, false);

  const quantizeResponse = await fetch(`http://127.0.0.1:${port}/api/models/quantize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: payload.models.items[0].id, level: "Q3_K_M" }),
  });
  assert.equal(quantizeResponse.status, 201);
  const quantizePayload = await quantizeResponse.json();
  assert.match(quantizePayload.filename, /-Q3_K_M-\d+\.gguf$/);
  assert.notEqual(join(languageRoot, quantizePayload.filename), payload.models.items[0].id);
  const refreshedPayload = await fetch(`http://127.0.0.1:${port}/api/system`).then((result) => result.json());
  assert.equal(refreshedPayload.models.total, 3);
  assert.equal(refreshedPayload.models.items.find((model) => model.filename === quantizePayload.filename).quantization.currentLevel, "Q3_K_M");

  const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/models/quantize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: payload.models.items[0].id, level: "NOT_A_LEVEL" }),
  });
  assert.equal(invalidResponse.status, 400);
});
