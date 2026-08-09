"use client";

import { useCallback, useEffect, useState } from "react";

type View = "overview" | "models" | "chat" | "images";
type ConnectionState = "checking" | "connected" | "unconfigured" | "error";

type SystemSnapshot = {
  machine?: { name?: string };
  accelerator?: { name?: string; memory?: string };
  backend?: { name?: string; version?: string };
  storage?: { path?: string; used?: string; available?: string; total?: string; usedPercent?: number };
  models?: { total?: number; language?: number; image?: number };
};

type LabSettings = { apiUrl: string };

const SETTINGS_KEY = "cheesegrater-ai-lab.settings";
const navigation: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "models", label: "Models", icon: "◫" },
  { id: "chat", label: "Chat", icon: "✦" },
  { id: "images", label: "Image studio", icon: "◇" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "System overview", title: "Your AI lab, in one place.", description: "See what is connected, choose a model, and send work to the compute resources available on this lab." },
  models: { eyebrow: "Model library", title: "Choose what runs next.", description: "Models reported by connected providers will appear here, ready to inspect, launch, or manage." },
  chat: { eyebrow: "Private chat", title: "Start a conversation.", description: "Pick an available language model, then chat through your own lab infrastructure." },
  images: { eyebrow: "Image studio", title: "Turn an idea into an image.", description: "Choose an available image model and let the lab assign compatible compute at runtime." },
};

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function endpointFor(settings: LabSettings) {
  return `${normalizeApiUrl(settings.apiUrl)}/api/system`;
}

function Header({ view, openSettings }: { view: View; openSettings: () => void }) {
  const copy = viewCopy[view];
  return <header className="page-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="lede">{copy.description}</p></div><button className="header-settings" onClick={openSettings}><span>⚙</span> Settings</button></header>;
}

function StatusStrip({ state, system }: { state: ConnectionState; system: SystemSnapshot | null }) {
  const connected = state === "connected";
  const title = state === "checking" ? "Checking system connection" : connected ? (system?.machine?.name || "System connected") : "System discovery not connected";
  const subtitle = connected ? "Live information from the configured lab API" : "Open Settings to configure or test a lab API";
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
      <article className="hero-card"><div className="hero-copy"><span className="card-kicker">Adaptive compute</span><h2>Use the hardware that is actually there.</h2><p>Cheesegrater AI Lab does not assume a vendor, accelerator, backend, or storage layout. Connected services report their own capabilities.</p><div className="button-row"><button className="button button-primary" onClick={() => goTo("chat")}>New conversation <span>→</span></button><button className="button button-secondary" onClick={() => goTo("models")}>Browse models</button></div></div><div className="compute-visual" aria-label="Compute resources are discovered at runtime"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="compute-core"><small>AI LAB</small><strong>READY</strong><span>AUTO-DETECT</span></div><span className="spark spark-one" /><span className="spark spark-two" /><span className="spark spark-three" /></div></article>
      <article className="storage-card"><div className="card-heading"><div><span className="card-kicker">Model storage</span><h3>{storage ? "Storage reported by your lab." : "Waiting for storage details."}</h3></div>{storage?.total && <span className="storage-mark">{storage.total}</span>}</div><div className={`capacity ${percent === null ? "unknown" : ""}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div><div className="capacity-labels"><span>{storage?.used || "Usage not reported"}</span><strong>{storage?.available || "Availability not reported"}</strong></div><div className="folder-row"><span className="folder-icon">▰</span><div><strong>{storage?.path || "No storage path configured"}</strong><span>Reported by the connected system</span></div></div></article>
    </section>
    <section className="section-block"><div className="section-heading"><div><span className="card-kicker">Quick start</span><h2>What would you like to do?</h2></div></div><div className="action-grid"><button className="action-card peach" onClick={() => goTo("chat")}><span className="action-icon">✦</span><strong>Chat with a model</strong><small>Use a language model exposed by the lab</small><span className="action-link">Open chat →</span></button><button className="action-card blue" onClick={() => goTo("images")}><span className="action-icon">◇</span><strong>Create an image</strong><small>Use a compatible image-generation model</small><span className="action-link">Open studio →</span></button><button className="action-card mint" onClick={() => goTo("models")}><span className="action-icon">↓</span><strong>Add a model</strong><small>Connect a provider or model source</small><span className="action-link">Model library →</span></button></div></section>
    <section className="section-block two-column"><article className="panel"><div className="section-heading compact"><div><span className="card-kicker">Model library</span><h2>{typeof modelCount === "number" ? `${modelCount} models reported` : "Waiting for model data"}</h2></div><button className="text-button" onClick={() => goTo("models")}>View library</button></div><div className="empty-inline"><span>◫</span><div><strong>{typeof modelCount === "number" ? "Library connected" : "No models reported yet"}</strong><p>Models appear only after a provider or lab API reports them.</p></div><button className="button button-small" onClick={() => goTo("models")}>Open library</button></div></article><article className="panel activity-panel"><span className="card-kicker">Activity</span><h2>{state === "connected" ? "System connected." : "Configuration needed."}</h2><p>Jobs, downloads, and runtime events will appear here when the lab API is connected.</p><div className="activity-line"><span className={`pulse subtle ${state === "connected" ? "" : "amber"}`} /><span>{state === "connected" ? "Receiving system data" : "No activity source configured"}</span><button className="text-button" onClick={openSettings}>Settings</button></div></article></section>
  </>;
}

function Models({ system }: { system: SystemSnapshot | null }) {
  const [repo, setRepo] = useState("");
  const storage = system?.storage;
  const percent = typeof storage?.usedPercent === "number" ? Math.min(100, Math.max(0, storage.usedPercent)) : null;
  return <><section className="workspace-grid"><article className="panel download-panel"><span className="card-kicker">Model source</span><h2>Add a model to the lab</h2><p>Enter a provider reference or URL. The connected backend will determine supported sources, files, and destination.</p><label className="field-label" htmlFor="model-repo">Repository, reference, or URL</label><div className="input-row"><input id="model-repo" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="provider/model or https://…" /><button className="button button-primary" disabled>Review</button></div><p className="field-note">Downloads will be enabled when a model-management API is connected.</p></article><article className="panel storage-mini"><span className="card-kicker">Storage</span><h3>{storage?.path || "Not configured"}</h3><div className={`capacity ${percent === null ? "unknown" : ""}`}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div><div className="capacity-labels"><span>{storage?.used || "Usage unknown"}</span><strong>{storage?.available || "Availability unknown"}</strong></div></article></section><section className="panel library-panel"><div className="section-heading compact"><div><span className="card-kicker">Installed models</span><h2>Your model library</h2></div><div className="segmented"><button className="active">All</button><button>Language</button><button>Images</button></div></div><div className="library-empty"><span className="large-glyph">◫</span><h3>No model data yet.</h3><p>The library will populate from configured providers. Nothing is assumed from the browser or deployment host.</p></div></section></>;
}

function Chat() {
  const [message, setMessage] = useState("");
  return <section className="chat-shell"><aside className="chat-history"><button className="button button-primary wide" disabled>＋ New conversation</button><span className="card-kicker">Recent</span><div className="history-empty">Conversation history will appear after a chat service is configured.</div></aside><div className="chat-main"><div className="chat-model"><div><span className="pulse amber" /><strong>No model selected</strong></div><button className="button button-small" disabled>Choose model</button></div><div className="chat-empty"><span className="chat-star">✦</span><h2>What are we thinking about?</h2><p>Connect a chat service and select one of the language models it reports.</p></div><div className="composer"><textarea aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message a connected model…" rows={2} disabled /><button aria-label="Send message" disabled>↑</button><small>Chat becomes available after a compatible service is connected.</small></div></div></section>;
}

function Images() {
  const [prompt, setPrompt] = useState("");
  return <section className="studio-grid"><article className="panel controls-panel"><span className="card-kicker">Generation setup</span><h2>Describe your image</h2><label className="field-label" htmlFor="image-prompt">Prompt</label><textarea id="image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic photograph of…" rows={6} disabled /><div className="control-pair"><div className="control-field"><span>Model</span><button className="select-button" disabled>Not connected <b>⌄</b></button></div><div className="control-field"><span>Size</span><button className="select-button" disabled>Set by model <b>⌄</b></button></div></div><button className="button button-primary wide" disabled>Generate image <span>✦</span></button><p className="field-note">Generation becomes available after a compatible service is connected.</p></article><article className="canvas-panel"><div className="canvas-empty"><div className="canvas-glyph">◇</div><h2>Your canvas is ready.</h2><p>Available models and compute resources will be reported by the connected lab service.</p><span>Runtime discovery</span></div></article></section>;
}

function SettingsDialog({ settings, state, onSave, onClose, onTest }: { settings: LabSettings; state: ConnectionState; onSave: (settings: LabSettings) => void; onClose: () => void; onTest: (settings: LabSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const stateText = state === "checking" ? "Checking…" : state === "connected" ? "Connected" : state === "error" ? "Connection failed" : "Not connected";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="dialog-heading"><div><span className="card-kicker">Configuration</span><h2 id="settings-title">Lab settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></div><p>Settings belong to this browser only. Leave the endpoint empty to use the same host that serves this interface.</p><label className="field-label" htmlFor="api-url">Lab API endpoint</label><input id="api-url" value={draft.apiUrl} onChange={(event) => setDraft({ apiUrl: event.target.value })} placeholder="Same origin" inputMode="url" /><p className="field-note">Expected discovery endpoint: {endpointFor(draft) || "/api/system"}</p><div className="connection-result"><span className={`pulse ${state === "connected" ? "" : "amber"}`} /><strong>{stateText}</strong></div><div className="dialog-actions"><button className="button button-ghost" onClick={() => { const reset = { apiUrl: "" }; setDraft(reset); onSave(reset); }}>Reset</button><button className="button button-secondary-light" onClick={() => onTest(draft)}>Test connection</button><button className="button button-primary" onClick={() => { onSave(draft); onClose(); }}>Save settings</button></div></section></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<LabSettings>(() => {
    if (typeof window === "undefined") return { apiUrl: "" };
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) as LabSettings : { apiUrl: "" };
    } catch {
      return { apiUrl: "" };
    }
  });
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [runtimeHost] = useState(() => typeof window === "undefined" ? "Current host" : (window.location.host || "Current host"));

  const testConnection = useCallback(async (candidate: LabSettings) => {
    setConnection("checking");
    try {
      const response = await fetch(endpointFor(candidate) || "/api/system", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("Discovery unavailable");
      const payload = await response.json() as SystemSnapshot;
      setSystem(payload);
      setConnection("connected");
    } catch {
      setSystem(null);
      setConnection(candidate.apiUrl ? "error" : "unconfigured");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void testConnection(settings), 0);
    return () => window.clearTimeout(timer);
  }, [settings, testConnection]);

  function saveSettings(next: LabSettings) {
    const normalized = { apiUrl: normalizeApiUrl(next.apiUrl) };
    setSettings(normalized);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  }

  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => setView("overview")} aria-label="Cheesegrater AI Lab overview"><span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span><strong>Cheesegrater</strong><small>AI LAB</small></span></button><nav aria-label="Lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-bottom"><div className="mini-status"><span className={`pulse ${connection === "connected" ? "" : "amber"}`} /><div><strong>{connection === "connected" ? "System connected" : "System not connected"}</strong><small>{runtimeHost}</small></div></div><button className="settings-button" onClick={() => setSettingsOpen(true)}><span>⚙</span>Settings</button></div></aside><main className="main-content"><div className="mobile-topbar"><button className="brand" onClick={() => setView("overview")}><span className="brand-mark small"><i /><i /><i /><i /></span><strong>AI Lab</strong></button><button className="mobile-settings" onClick={() => setSettingsOpen(true)}>⚙</button></div><Header view={view} openSettings={() => setSettingsOpen(true)} />{view === "overview" && <Overview goTo={setView} state={connection} system={system} openSettings={() => setSettingsOpen(true)} />}{view === "models" && <Models system={system} />}{view === "chat" && <Chat />}{view === "images" && <Images />}</main><nav className="mobile-nav" aria-label="Mobile lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>{settingsOpen && <SettingsDialog settings={settings} state={connection} onSave={saveSettings} onClose={() => setSettingsOpen(false)} onTest={testConnection} />}</div>;
}
