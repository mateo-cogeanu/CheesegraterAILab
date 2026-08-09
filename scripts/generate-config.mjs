#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { dirname, join } from "node:path";

function run(command, args = [], timeout = 15_000) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout,
    }).trim();
  } catch {
    return "";
  }
}

function executable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      if (statSync(candidate).isFile() && (statSync(candidate).mode & 0o111)) return realpathSync(candidate);
    } catch {}
  }
  return null;
}

function mountedModelRoots() {
  try {
    return readFileSync("/proc/mounts", "utf8")
      .split("\n")
      .map((line) => line.split(" ")[1])
      .filter(Boolean)
      .map((mount) => join(mount.replaceAll("\\040", " "), "models"))
      .filter((path) => existsSync(path));
  } catch {
    return [];
  }
}

function modelRoot() {
  const candidates = [
    process.env.LAB_MODEL_ROOT,
    process.env.MODELS_DIR,
    process.env.HF_HOME ? dirname(process.env.HF_HOME) : null,
    ...mountedModelRoots(),
    join(homedir(), "models"),
    "/var/lib/cheesegrater-ai-lab/models",
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) || null;
}

function detectRocm() {
  const rocminfo = executable([
    process.env.ROCM_PATH && join(process.env.ROCM_PATH, "bin/rocminfo"),
    "/opt/rocm/bin/rocminfo",
    "/usr/bin/rocminfo",
  ]);
  if (!rocminfo) return null;

  const output = run(rocminfo);
  const architecture = output.match(/^\s*Name:\s*(gfx[0-9a-z]+)/m)?.[1];
  if (!architecture) return null;
  const agent = output.slice(Math.max(0, output.indexOf(`Name:                    ${architecture}`)));
  let name = agent.match(/^\s*Marketing Name:\s*(.+)$/m)?.[1]?.trim() || architecture;
  const computeUnits = Number(agent.match(/^\s*Compute Unit:\s*(\d+)/m)?.[1]) || undefined;
  const pciLine = run("/usr/bin/lspci", ["-nn"]).split("\n").find((entry) => /AMD|ATI/i.test(entry) && /VGA|3D controller|Display controller/i.test(entry));
  if (pciLine) {
    name = pciLine.replace(/^.*\[AMD\/ATI\]\s*/i, "").replace(/\s*\[[0-9a-f]{4}:[0-9a-f]{4}\].*$/i, "").trim() || name;
  }
  const rocmSmi = executable([join(dirname(rocminfo), "rocm-smi"), "/opt/rocm/bin/rocm-smi"]);
  const memoryBytes = Number(run(rocmSmi, ["--showmeminfo", "vram"]).match(/VRAM Total Memory \(B\):\s*(\d+)/)?.[1]) || 0;
  const memory = memoryBytes ? `${(memoryBytes / (1024 ** 3)).toFixed(0)} GiB` : undefined;
  let version = "";
  try {
    version = realpathSync(dirname(dirname(rocminfo))).match(/rocm-([0-9.]+)/)?.[1] || "";
  } catch {}
  return {
    accelerator: { name, architecture, ...(memory ? { memory } : {}), ...(computeUnits ? { computeUnits } : {}) },
    backend: { name: "ROCm", ...(version ? { version } : {}) },
  };
}

function detectNvidia() {
  const tool = executable(["/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi"]);
  if (!tool) return null;
  const line = run(tool, ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]).split("\n")[0];
  const [name, memoryMiB] = line.split(",").map((value) => value.trim());
  if (!name) return null;
  return {
    accelerator: { name, ...(memoryMiB ? { memory: `${memoryMiB} MiB` } : {}) },
    backend: { name: "CUDA" },
  };
}

function detectGenericAccelerator() {
  const line = run("/usr/bin/lspci", ["-nn"]).split("\n").find((entry) => /VGA|3D controller|Display controller/i.test(entry));
  if (!line) return null;
  return { accelerator: { name: line.replace(/^\S+\s+/, "").trim() }, backend: null };
}

const root = modelRoot();
const llamaServer = executable([
  process.env.LLAMA_SERVER,
  join(homedir(), "llama.cpp/build/bin/llama-server"),
  "/usr/local/bin/llama-server",
  "/usr/bin/llama-server",
]);
const imageServer = executable([
  process.env.DIFFUSION_SERVER,
  "/usr/local/libexec/stable-diffusion.cpp/sd-server",
  "/usr/local/bin/sd-server",
  join(homedir(), "stable-diffusion.cpp/build/bin/sd-server"),
]);
const imageCli = executable([
  process.env.DIFFUSION_CLI,
  "/usr/local/libexec/stable-diffusion.cpp/sd-cli",
  "/usr/local/bin/sd-cli",
  join(homedir(), "stable-diffusion.cpp/build/bin/sd-cli"),
]);
const llamaCli = executable([
  process.env.LLAMA_CLI,
  join(homedir(), "llama.cpp/build/bin/llama-cli"),
  "/usr/local/bin/llama-cli",
  "/usr/bin/llama-cli",
]);
const compute = detectRocm() || detectNvidia() || detectGenericAccelerator() || { accelerator: null, backend: null };

const config = {
  version: 1,
  generatedAt: new Date().toISOString(),
  machine: { name: hostname(), platform: platform() },
  accelerator: compute.accelerator,
  backend: compute.backend,
  storage: root ? { path: root } : null,
  models: {
    languageRoots: root ? [join(root, "huggingface"), join(root, "language")] : [],
    imageRoots: root ? [join(root, "diffusion")] : [],
  },
  outputs: root ? { images: join(root, "diffusion/outputs/lab") } : null,
  services: {
    language: llamaCli ? { engine: "llama.cpp", executable: llamaCli, serverExecutable: llamaServer } : null,
    image: imageCli ? { engine: "stable-diffusion.cpp", executable: imageCli, serverExecutable: imageServer } : null,
  },
};

process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
