import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Cheesegrater AI Lab interface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cheesegrater AI Lab<\/title>/i);
  assert.match(html, /Your AI lab, in one place\./);
  assert.match(html, /Reading local system/);
  assert.match(html, /Chat with a model/);
  assert.match(html, /Create an image/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape|MI50|ROCm|gfx906|192\.168/i);
});

test("contains production metadata and no starter preview", async () => {
  const [page, layout, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Local runtime unavailable/);
  assert.match(page, /mobile-nav/);
  assert.match(page, /Lab settings/);
  assert.match(page, /api\/system/);
  assert.match(page, /Use in Chat/);
  assert.match(page, /Use in Studio/);
  assert.match(page, /api\/chat/);
  assert.match(page, /api\/images/);
  assert.match(page, /Enter to send/);
  assert.match(page, /Create quantized copy/);
  assert.match(page, /Estimated resulting size/);
  assert.match(page, /Quality warning/);
  assert.match(page, /api\/models\/quantize/);
  assert.doesNotMatch(page, /Thought process|payload\.reasoning|reasoning-panel/);
  assert.match(page, /Generate image/);
  assert.doesNotMatch(page, /Generation becomes available after a compatible service is connected|Model: not connected|Copy name|connected providers/i);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(layout, /configurable interface/);
  assert.match(packageJson, /cheesegrater-ai-lab-web/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await assert.rejects(access(new URL("../public/og.png", import.meta.url)));
});
