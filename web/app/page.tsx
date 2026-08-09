"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type View = "overview" | "models" | "chat" | "images";
type ConnectionState = "checking" | "connected" | "unconfigured" | "error";

type ModelRecord = {
  id: string;
  name: string;
  filename: string;
  type: "language" | "image";
  size?: string;
  reference: string;
  source?: string;
};

type SystemSnapshot = {
  machine?: { name?: string };
  accelerator?: { name?: string; memory?: string };
  backend?: { name?: string; version?: string };
  storage?: { path?: string; used?: string; available?: string; total?: string; usedPercent?: number };
  models?: { total?: number; language?: number; image?: number; items?: ModelRecord[] };
};

const navigation: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "models", label: "Models", icon: "◫" },
  { id: "chat", label: "Chat", icon: "✦" },
  { id: "images", label: "Image studio", icon: "◇" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "System overview", title: "Your AI lab, in one place.", description: "See your local hardware and models, then choose what you want the Cheesegrater to run." },
  models: { eyebrow: "Model library", title: "Choose what runs next.", description: "Models found in local storage appear here, ready to use in Chat or the Image Studio." },
  chat: { eyebrow: "Private chat", title: "Start a conversation.", description: "Pick an available language model, then chat through your own lab infrastructure." },
  images: { eyebrow: "Image studio", title: "Turn an idea into an image.", description: "Choose a local image model and run it with the compute available in this machine." },
};

function Header({ view, openSettings }: { view: View; openSettings: () => void }) {
  const copy = viewCopy[view];
  return <header className="page-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="lede">{copy.description}</p></div><button className="header-settings" onClick={openSettings}><span>⚙</span> Settings</button></header>;
}

function StatusStrip({ state, system }: { state: ConnectionState; system: SystemSnapshot | null }) {
  const connected = state === "connected";
  const title = state === "checking" ? "Reading local system" : connected ? (system?.machine?.name || "Local system ready") : "Local runtime unavailable";
  const subtitle = connected ? "Live information from this machine" : "Check the local runtime in Settings";
  const accelerator = system?.accelerator?.name ? `${system.accelerator.name}${system.accelerator.memory ? ` · ${system.accelerator.memory}` : ""}` : "Not detected";
  const backend = system?.backend?.name ? `${system.backend.name}${system.backend.version ? ` ${system.backend.version}` : ""}` : "Not detected";
  const storage = system?.storage?.available || "Not reported";
  return <section className="status-strip" aria-label="Lab system status"><div className="status-primary"><span className={`pulse ${connected ? "" : "amber"}`} /><div><strong>{title}</strong><span>{subtitle}</span></div></div><div className="status-detail"><span>Accelerator</span><strong>{accelerator}</strong></div><div className="status-detail"><span>Backend</span><strong>{backend}</strong></div><div className="status-detail"><span>Available storage</span><strong>{storage}</strong></div></section>;
}

function Overview({ goTo, state, system, openSettings }: { goTo: (view: View) => void; state: ConnectionState; system: SystemSnapshot | null; openSettings: () => void }) {
  const storage = system?.storage;
  const percent = typeof storage?.usedPercent === "number" ? Math.min(100, Math.max(0, storage.usedPercent)) : null;
  const modelCount = system?.models?.total;
  return <>
    <StatusStrip state={state} system={system} />
    <section className="hero-grid">
      <article className="hero-card"><div className="hero-copy"><span className="card-kicker">Adaptive compute</span><h2>Use the hardware that is actually there.</h2><p>Cheesegrater AI Lab detects the accelerator, runtime, model storage, and installed models directly from this machine.</p><div className="button-row"><button className="button button-primary" onClick={() => goTo("chat")}>New conversation <span>→</span></button><button className="button button-secondary" onClick={() => goTo("models")}>Browse models</button></div></div><div className="compute-visual" aria-label="Compute resources are discovered at runtime"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="compute-core"><small>AI LAB</small><strong>READY</strong><span>AUTO-DETECT</span></div><span className="spark spark-one" /><span className="spark spark-two" /><span className="spark spark-three" /></div></article>
      <article className="storage-card"><div className="card-heading"><div><span className="card-kicker">Model storage</span><h3>{storage ? "Local model storage." : "Waiting for storage details."}</h3></div>{storage?.total && <span className="storage-mark">{storage.total}</span>}</div><div className={`capacity ${percent === null ? "unknown" : ""}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div><div className="capacity-labels"><span>{storage?.used || "Usage not reported"}</span><strong>{storage?.available || "Availability not reported"}</strong></div><div className="folder-row"><span className="folder-icon">▰</span><div><strong>{storage?.path || "No storage path configured"}</strong><span>Detected on this machine</span></div></div></article>
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="card-kicker">Quick start</span><h2>What would you like to do?</h2></div></div><div className="action-grid"><button className="action-card peach" onClick={() => goTo("chat")}><span className="action-icon">✦</span><strong>Chat with a model</strong><small>Use a language model stored on this machine</small><span className="action-link">Open chat →</span></button><button className="action-card blue" onClick={() => goTo("images")}><span className="action-icon">◇</span><strong>Create an image</strong><small>Use an image model stored on this machine</small><span className="action-link">Open studio →</span></button><button className="action-card mint" onClick={() => goTo("models")}><span className="action-icon">↓</span><strong>Add a model</strong><small>Download into local model storage</small><span className="action-link">Model library →</span></button></div></section>
    <section className="section-block two-column"><article className="panel"><div className="section-heading compact"><div><span className="card-kicker">Model library</span><h2>{typeof modelCount === "number" ? `${modelCount} local models` : "Scanning model storage"}</h2></div><button className="text-button" onClick={() => goTo("models")}>View library</button></div><div className="empty-inline"><span>◫</span><div><strong>{typeof modelCount === "number" ? "Local library ready" : "Scanning for models"}</strong><p>Models are detected directly from the configured model folders.</p></div><button className="button button-small" onClick={() => goTo("models")}>Open library</button></div></article><article className="panel activity-panel"><span className="card-kicker">Activity</span><h2>{state === "connected" ? "Local runtime ready." : "Runtime check needed."}</h2><p>Local jobs, downloads, and runtime events will appear here as the lab grows.</p><div className="activity-line"><span className={`pulse subtle ${state === "connected" ? "" : "amber"}`} /><span>{state === "connected" ? "Reading this machine" : "Local runtime unavailable"}</span><button className="text-button" onClick={openSettings}>Settings</button></div></article></section>
  </>;
}

function Models({ system, chooseModel }: { system: SystemSnapshot | null; chooseModel: (model: ModelRecord) => void }) {
  const [repo, setRepo] = useState("");
  const [filter, setFilter] = useState<"all" | "language" | "image">("all");
  const storage = system?.storage;
  const percent = typeof storage?.usedPercent === "number" ? Math.min(100, Math.max(0, storage.usedPercent)) : null;
  const models = (system?.models?.items || []).filter((model) => filter === "all" || model.type === filter);
  return <><section className="workspace-grid"><article className="panel download-panel"><span className="card-kicker">Model downloads</span><h2>Add a model to local storage</h2><p>Enter a Hugging Face reference or direct URL. Downloads will be placed in this machine&apos;s model folders.</p><label className="field-label" htmlFor="model-repo">Model reference or URL</label><div className="input-row"><input id="model-repo" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/model or https://…" /><button className="button button-primary" disabled>Download</button></div><p className="field-note">Download controls are part of the next lab feature.</p></article><article className="panel storage-mini"><span className="card-kicker">Storage</span><h3>{storage?.path || "Not configured"}</h3><div className={`capacity ${percent === null ? "unknown" : ""}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div><div className="capacity-labels"><span>{storage?.used || "Usage unknown"}</span><strong>{storage?.available || "Availability unknown"}</strong></div></article></section><section className="panel library-panel"><div className="section-heading compact"><div><span className="card-kicker">Installed models</span><h2>Your local model library</h2></div><div className="segmented" aria-label="Filter models"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "language" ? "active" : ""} onClick={() => setFilter("language")}>Language</button><button className={filter === "image" ? "active" : ""} onClick={() => setFilter("image")}>Images</button></div></div>{models.length ? <div className="model-list">{models.map((model) => <article className="model-row" key={model.id}><span className={`model-glyph ${model.type}`}>{model.type === "language" ? "✦" : "◇"}</span><div className="model-info"><div className="model-title"><strong>{model.name}</strong><span>{model.type === "language" ? "Language" : "Image"}</span></div><small>{[model.source, model.size, model.filename].filter(Boolean).join(" · ")}</small></div><button className="use-model" onClick={() => chooseModel(model)}>{model.type === "language" ? "Use in Chat" : "Use in Studio"}</button></article>)}</div> : <div className="library-empty"><span className="large-glyph">◫</span><h3>{system?.models?.items ? "No models in this category." : "No model data yet."}</h3><p>{system?.models?.items ? "Choose another filter to see the local models in this lab." : "The lab is scanning the configured model folders on this machine."}</p></div>}</section></>;
}

function Chat({ models, selectedId, onSelect }: { models: ModelRecord[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = models.find((model) => model.id === selectedId) || null;
  async function sendMessage() {
    const text = message.trim();
    if (!selected || !text || busy) return;
    setMessage("");
    setError("");
    setTurns((current) => [...current, { role: "user", text }]);
    setBusy(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelId: selected.id, message: text }) });
      const payload = await response.json() as { answer?: string; error?: string; detail?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.detail || payload.error || "Local generation failed");
      setTurns((current) => [...current, { role: "assistant", text: payload.answer! }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local generation failed");
    } finally {
      setBusy(false);
    }
  }
  return <section className="chat-shell"><aside className="chat-history"><button className="button button-primary wide" onClick={() => { setTurns([]); setError(""); }}>＋ New conversation</button><span className="card-kicker">Current session</span><div className="history-empty">{turns.length ? `${Math.ceil(turns.length / 2)} local exchange${turns.length > 2 ? "s" : ""}` : "No messages yet."}</div></aside><div className="chat-main"><div className="chat-model"><div><span className={`pulse ${selected ? "" : "amber"}`} /><strong>{selected?.name || "Choose a language model"}</strong></div><select aria-label="Language model" value={selectedId || ""} onChange={(event) => onSelect(event.target.value)} disabled={busy}><option value="" disabled>Choose model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></div>{turns.length ? <div className="chat-messages" aria-live="polite">{turns.map((turn, index) => <article className={`chat-bubble ${turn.role}`} key={`${turn.role}-${index}`}><span>{turn.role === "user" ? "You" : selected?.name || "Model"}</span><p>{turn.text}</p></article>)}{busy && <div className="thinking"><span className="pulse" /> Running locally on the accelerator…</div>}</div> : <div className="chat-empty"><span className="chat-star">✦</span><h2>What are we thinking about?</h2><p>{selected ? `${selected.name} is ready on this machine.` : "Choose one of the language models found on this machine."}</p></div>}<div className="composer"><textarea aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={selected ? `Message ${selected.name}…` : "Choose a language model above"} rows={2} disabled={!selected || busy} /><button aria-label="Send message" onClick={() => void sendMessage()} disabled={!selected || !message.trim() || busy}>{busy ? "…" : "↑"}</button>{error ? <small className="runtime-error">{error}</small> : <small>Enter to send · Shift+Enter for a new line</small>}</div></div></section>;
}

function Images({ models, selectedId, onSelect }: { models: ModelRecord[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const selected = models.find((model) => model.id === selectedId) || null;
  async function generateImage() {
    if (!selected || !prompt.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/images", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelId: selected.id, prompt: prompt.trim() }) });
      const payload = await response.json() as { imageUrl?: string; error?: string; detail?: string };
      if (!response.ok || !payload.imageUrl) throw new Error(payload.detail || payload.error || "Local image generation failed");
      setImageUrl(`${payload.imageUrl}?v=${Date.now()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local image generation failed");
    } finally {
      setBusy(false);
    }
  }
  return <section className="studio-grid"><article className="panel controls-panel"><span className="card-kicker">Generation setup</span><h2>Describe your image</h2><label className="field-label" htmlFor="image-prompt">Prompt</label><textarea id="image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic photograph of…" rows={6} disabled={busy} /><div className="control-pair"><label className="control-field"><span>Model</span><select value={selectedId || ""} onChange={(event) => onSelect(event.target.value)} disabled={busy}><option value="" disabled>Choose model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label><div className="control-field"><span>Size</span><button className="select-button" disabled>512 × 512</button></div></div><button className="button button-primary wide" onClick={() => void generateImage()} disabled={!selected || !prompt.trim() || busy}>{busy ? "Generating locally…" : "Generate image"} <span>✦</span></button><p className={`field-note ${error ? "runtime-error" : ""}`}>{error || (selected ? `${selected.name} will run on this machine.` : "Choose one of the image models found on this machine.")}</p></article><article className="canvas-panel">{imageUrl ? <div className="generated-canvas"><Image src={imageUrl} alt={prompt || "Locally generated image"} width={512} height={512} unoptimized /><span>Generated locally</span></div> : <div className="canvas-empty"><div className="canvas-glyph">◇</div><h2>{busy ? "Generating on the accelerator…" : "Your canvas is ready."}</h2><p>{busy ? "The first run can take a little longer while the model loads." : "Images will be generated here using this machine&apos;s accelerator."}</p><span>Local generation</span></div>}</article></section>;
}

function SettingsDialog({ state, onClose, onRefresh }: { state: ConnectionState; onClose: () => void; onRefresh: () => void }) {
  const stateText = state === "checking" ? "Reading this machine…" : state === "connected" ? "Local runtime ready" : "Local runtime unavailable";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="dialog-heading"><div><span className="card-kicker">Local configuration</span><h2 id="settings-title">Lab settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></div><p>Cheesegrater AI Lab reads its hardware, runtime, storage, and models automatically from this machine.</p><div className="connection-result"><span className={`pulse ${state === "connected" ? "" : "amber"}`} /><strong>{stateText}</strong></div><div className="dialog-actions"><button className="button button-secondary-light" onClick={onRefresh}>Refresh local system</button><button className="button button-primary" onClick={onClose}>Done</button></div></section></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [runtimeHost] = useState(() => typeof window === "undefined" ? "Current host" : (window.location.host || "Current host"));

  const refreshSystem = useCallback(async () => {
    setConnection("checking");
    try {
      const response = await fetch("/api/system", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("Discovery unavailable");
      const payload = await response.json() as SystemSnapshot;
      setSystem(payload);
      setConnection("connected");
    } catch {
      setSystem(null);
      setConnection("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSystem(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSystem]);

  const languageModels = (system?.models?.items || []).filter((model) => model.type === "language");
  const imageModels = (system?.models?.items || []).filter((model) => model.type === "image");
  const activeLanguage = languageModels.some((model) => model.id === selectedLanguage) ? selectedLanguage : (languageModels[0]?.id || null);
  const activeImage = imageModels.some((model) => model.id === selectedImage) ? selectedImage : (imageModels[0]?.id || null);

  function chooseModel(model: ModelRecord) {
    if (model.type === "language") { setSelectedLanguage(model.id); setView("chat"); }
    else { setSelectedImage(model.id); setView("images"); }
  }

  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => setView("overview")} aria-label="Cheesegrater AI Lab overview"><span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span><strong>Cheesegrater</strong><small>AI LAB</small></span></button><nav aria-label="Lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="mini-status"><span className={`pulse ${connection === "connected" ? "" : "amber"}`} /><div><strong>{connection === "connected" ? "Local system ready" : "Runtime unavailable"}</strong><small>{runtimeHost}</small></div></div><button className="settings-button" onClick={() => setSettingsOpen(true)}><span>⚙</span>Settings</button></div></aside><main className="main-content"><div className="mobile-topbar"><button className="brand" onClick={() => setView("overview")}><span className="brand-mark small"><i /><i /><i /><i /></span><strong>AI Lab</strong></button><button className="mobile-settings" onClick={() => setSettingsOpen(true)}>⚙</button></div><Header view={view} openSettings={() => setSettingsOpen(true)} />{view === "overview" && <Overview goTo={setView} state={connection} system={system} openSettings={() => setSettingsOpen(true)} />}{view === "models" && <Models system={system} chooseModel={chooseModel} />}{view === "chat" && <Chat models={languageModels} selectedId={activeLanguage} onSelect={setSelectedLanguage} />}{view === "images" && <Images models={imageModels} selectedId={activeImage} onSelect={setSelectedImage} />}</main><nav className="mobile-nav" aria-label="Mobile lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>{settingsOpen && <SettingsDialog state={connection} onClose={() => setSettingsOpen(false)} onRefresh={() => void refreshSystem()} />}</div>;
}
