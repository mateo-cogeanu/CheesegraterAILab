"use client";

import { useMemo, useState } from "react";

type View = "overview" | "models" | "chat" | "images";

const navigation: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "models", label: "Models", icon: "◫" },
  { id: "chat", label: "Chat", icon: "✦" },
  { id: "images", label: "Image studio", icon: "◇" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "System overview",
    title: "Your local AI, in one place.",
    description: "Run private models on the Cheesegrater without losing track of what is loaded, downloading, or using the MI50.",
  },
  models: {
    eyebrow: "Model library",
    title: "Choose what runs next.",
    description: "Language and diffusion models stored on the RAID volume will appear here, ready to launch or manage.",
  },
  chat: {
    eyebrow: "Private chat",
    title: "Start a conversation.",
    description: "Pick a local language model, then chat privately on your own hardware.",
  },
  images: {
    eyebrow: "Image studio",
    title: "Turn an idea into an image.",
    description: "Create locally with stable-diffusion.cpp and keep every output on the Cheesegrater.",
  },
};

function Header({ view }: { view: View }) {
  const copy = viewCopy[view];
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="lede">{copy.description}</p>
      </div>
      <div className="header-actions">
        <button className="icon-button" aria-label="Open activity log">⌁</button>
        <div className="avatar" aria-label="Mateo account">MC</div>
      </div>
    </header>
  );
}

function StatusStrip() {
  return (
    <section className="status-strip" aria-label="Cheesegrater status">
      <div className="status-primary">
        <span className="pulse" />
        <div>
          <strong>Cheesegrater online</strong>
          <span>Local network · Web lab connected</span>
        </div>
      </div>
      <div className="status-detail"><span>GPU</span><strong>MI50 · 32 GB</strong></div>
      <div className="status-detail"><span>Backend</span><strong>ROCm 6.3.3</strong></div>
      <div className="status-detail"><span>Storage</span><strong>1.4 TB free</strong></div>
    </section>
  );
}

function Overview({ goTo }: { goTo: (view: View) => void }) {
  return (
    <>
      <StatusStrip />
      <section className="hero-grid">
        <article className="hero-card">
          <div className="hero-copy">
            <span className="card-kicker">MI50 compute</span>
            <h2>Built to keep the work local.</h2>
            <p>The lab is ready to connect model downloads, conversations, and image generation to your existing ROCm setup.</p>
            <div className="button-row">
              <button className="button button-primary" onClick={() => goTo("chat")}>New conversation <span>→</span></button>
              <button className="button button-secondary" onClick={() => goTo("models")}>Browse models</button>
            </div>
          </div>
          <div className="gpu-visual" aria-label="AMD MI50 accelerator available">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="chip">
              <small>AMD</small>
              <strong>MI50</strong>
              <span>gfx906</span>
            </div>
            <span className="spark spark-one" />
            <span className="spark spark-two" />
            <span className="spark spark-three" />
          </div>
        </article>
        <article className="storage-card">
          <div className="card-heading">
            <div>
              <span className="card-kicker">RAID model storage</span>
              <h3>Models have room to grow.</h3>
            </div>
            <span className="storage-mark">1.5 TB</span>
          </div>
          <div className="capacity"><span style={{ width: "2%" }} /></div>
          <div className="capacity-labels"><span>18 GB used</span><strong>1.4 TB available</strong></div>
          <div className="folder-row"><span className="folder-icon">▰</span><div><strong>/mnt/raid0/models</strong><span>Shared model library</span></div></div>
        </article>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="card-kicker">Quick start</span><h2>What would you like to do?</h2></div></div>
        <div className="action-grid">
          <button className="action-card peach" onClick={() => goTo("chat")}><span className="action-icon">✦</span><strong>Chat with a model</strong><small>Private language-model conversations</small><span className="action-link">Open chat →</span></button>
          <button className="action-card blue" onClick={() => goTo("images")}><span className="action-icon">◇</span><strong>Create an image</strong><small>Generate locally with diffusion models</small><span className="action-link">Open studio →</span></button>
          <button className="action-card mint" onClick={() => goTo("models")}><span className="action-icon">↓</span><strong>Download a model</strong><small>Add a Hugging Face model to the RAID</small><span className="action-link">Model library →</span></button>
        </div>
      </section>
      <section className="section-block two-column">
        <article className="panel">
          <div className="section-heading compact"><div><span className="card-kicker">Model library</span><h2>Ready on this machine</h2></div><button className="text-button" onClick={() => goTo("models")}>View all</button></div>
          <div className="empty-inline"><span>◫</span><div><strong>No diffusion models yet</strong><p>Resume the prepared SD 1.5 download or add a model from Hugging Face.</p></div><button className="button button-small" onClick={() => goTo("models")}>Add model</button></div>
        </article>
        <article className="panel activity-panel">
          <span className="card-kicker">Activity</span><h2>Everything is quiet.</h2><p>Downloads and generation jobs will appear here with clear progress and controls.</p>
          <div className="activity-line"><span className="pulse subtle" /><span>Lab service is ready</span><time>now</time></div>
        </article>
      </section>
    </>
  );
}

function Models() {
  const [repo, setRepo] = useState("");
  return (
    <>
      <StatusStrip />
      <section className="workspace-grid">
        <article className="panel download-panel">
          <span className="card-kicker">Hugging Face</span>
          <h2>Add a model to the lab</h2>
          <p>Paste a repository name or model URL. Downloads will be resumable and stored on the RAID.</p>
          <label className="field-label" htmlFor="model-repo">Repository or URL</label>
          <div className="input-row"><input id="model-repo" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/model-name" /><button className="button button-primary" disabled={!repo.trim()}>Review</button></div>
          <p className="field-note">You will confirm the files and storage required before downloading.</p>
        </article>
        <article className="panel storage-mini"><span className="card-kicker">Storage location</span><h3>/mnt/raid0/models</h3><div className="capacity"><span style={{ width: "2%" }} /></div><div className="capacity-labels"><span>2% used</span><strong>1.4 TB free</strong></div></article>
      </section>
      <section className="panel library-panel">
        <div className="section-heading compact"><div><span className="card-kicker">Installed models</span><h2>Your model library</h2></div><div className="segmented"><button className="active">All</button><button>Language</button><button>Images</button></div></div>
        <div className="library-empty"><span className="large-glyph">◫</span><h3>Your library is waiting.</h3><p>Downloaded language and diffusion models will be easy to search, inspect, and launch from here.</p></div>
      </section>
    </>
  );
}

function Chat() {
  const [message, setMessage] = useState("");
  return (
    <section className="chat-shell">
      <aside className="chat-history"><button className="button button-primary wide">＋ New conversation</button><span className="card-kicker">Recent</span><div className="history-empty">Your conversations will stay on this machine.</div></aside>
      <div className="chat-main">
        <div className="chat-model"><div><span className="pulse amber" /><strong>No model selected</strong></div><button className="button button-small">Choose model</button></div>
        <div className="chat-empty"><span className="chat-star">✦</span><h2>What are we thinking about?</h2><p>Select a language model to begin a private conversation powered by the MI50.</p></div>
        <div className="composer"><textarea aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message your local model…" rows={2} /><button aria-label="Send message" disabled={!message.trim()}>↑</button><small>Messages remain on the Cheesegrater.</small></div>
      </div>
    </section>
  );
}

function Images() {
  const [prompt, setPrompt] = useState("");
  return (
    <section className="studio-grid">
      <article className="panel controls-panel"><span className="card-kicker">Generation setup</span><h2>Describe your image</h2><label className="field-label" htmlFor="image-prompt">Prompt</label><textarea id="image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic photograph of…" rows={6} /><div className="control-pair"><div className="control-field"><span>Model</span><button className="select-button">Choose a model <b>⌄</b></button></div><div className="control-field"><span>Size</span><button className="select-button">512 × 512 <b>⌄</b></button></div></div><button className="button button-primary wide" disabled={!prompt.trim()}>Generate image <span>✦</span></button><p className="field-note">Images will be saved to the RAID output folder.</p></article>
      <article className="canvas-panel"><div className="canvas-empty"><div className="canvas-glyph">◇</div><h2>Your canvas is ready.</h2><p>Choose a diffusion model and enter a prompt to create locally.</p><span>MI50 accelerated</span></div></article>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const activeLabel = useMemo(() => navigation.find((item) => item.id === view)?.label, [view]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("overview")} aria-label="Cheesegrater AI Lab overview"><span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span><span><strong>Cheesegrater</strong><small>AI LAB</small></span></button>
        <nav aria-label="Lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-bottom"><div className="mini-status"><span className="pulse" /><div><strong>Lab online</strong><small>192.168.111.100</small></div></div><button className="settings-button"><span>⚙</span>Settings</button></div>
      </aside>
      <main className="main-content">
        <div className="mobile-topbar"><button className="brand" onClick={() => setView("overview")}><span className="brand-mark small"><i /><i /><i /><i /></span><strong>AI Lab</strong></button><span>{activeLabel}</span></div>
        <Header view={view} />
        {view === "overview" && <Overview goTo={setView} />}
        {view === "models" && <Models />}
        {view === "chat" && <Chat />}
        {view === "images" && <Images />}
      </main>
      <nav className="mobile-nav" aria-label="Mobile lab navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
