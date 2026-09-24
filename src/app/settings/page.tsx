"use client";

import { useRef, useState } from "react";
import { Download, ClipboardCopy, Upload, RotateCcw, Smartphone, Share, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { download } from "@/components/CommandPalette";
import { toast, useVault, vault } from "@/lib/store";
import type { Settings } from "@/lib/vault";
import { setUI, useUI } from "@/lib/ui";

function Appearance() {
  const { settings } = useVault();
  const options = [
    { id: "paper", label: "Paper", hint: "Warm and light", icon: <Sun size={18} /> },
    { id: "graphite", label: "Graphite", hint: "Obsidian black", icon: <Moon size={18} /> },
    { id: "system", label: "System", hint: "Follow device", icon: <MonitorSmartphone size={18} /> },
  ] as const;
  return (
    <section className="card-panel">
      <div className="card-panel-head"><h2>Appearance</h2></div>
      <div className="seg seg-tall" role="radiogroup" aria-label="Theme">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={settings.theme === o.id}
            className={settings.theme === o.id ? "is-on" : ""}
            onClick={() => vault.updateSettings({ theme: o.id })}
          >
            {o.icon}
            <span>{o.label}</span>
            <small>{o.hint}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function InstallApp() {
  const { installPrompt } = useUI();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  return (
    <section className="card-panel">
      <div className="card-panel-head"><h2>Install the app</h2></div>
      {standalone ? (
        <p className="setting-note">Green Graphite is installed on this device and works offline.</p>
      ) : installPrompt ? (
        <>
          <p className="setting-note">Add Green Graphite to your home screen. It opens full-screen and works offline.</p>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              setUI({ installPrompt: null });
              if (outcome === "accepted") toast("Installing Green Graphite…");
            }}
          >
            <Smartphone size={14} /> Install Green Graphite
          </button>
        </>
      ) : ios ? (
        <p className="setting-note install-steps">
          In Safari, tap <Share size={14} /> <b>Share</b>, then <b>Add to Home Screen</b>. Green Graphite then opens
          full-screen like a regular app and works offline.
        </p>
      ) : (
        <p className="setting-note">
          Use your browser&apos;s <b>Install app</b> or <b>Add to Home screen</b> option. Green Graphite then opens in its own
          window and works offline.
        </p>
      )}
    </section>
  );
}

function Toggle({ label, hint, field }: { label: string; hint: string; field: Exclude<keyof Settings, "theme"> }) {
  const { settings } = useVault();
  return (
    <label className="setting">
      <span className="setting-text">
        <b>{label}</b>
        <span>{hint}</span>
      </span>
      <span className="switch">
        <input type="checkbox" checked={settings[field]} onChange={(e) => vault.updateSettings({ [field]: e.target.checked })} />
        <span className="switch-track" />
      </span>
    </label>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ["⌘K", "Command palette"],
  ["⌘O", "Quick switcher: open or create a note"],
  ["⌘E", "Switch between reading and editing"],
  ["⌘⇧F", "Search every note"],
  ["⌘\\", "Show or hide the file explorer"],
  ["⌘⌥← / →", "Back and forward"],
  ["[[", "Link to a note while typing"],
  ["⌘-click", "Open a link in a new tab"],
];

export default function SettingsPage() {
  const { notes, activity } = useVault();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const bytes = vault.exportJSON().length;

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <p className="eyebrow"><span className="dot" /> Settings</p>
        <h1>Settings</h1>
      </header>

      <Appearance />
      <InstallApp />

      <section className="card-panel">
        <div className="card-panel-head"><h2>Flashcards</h2></div>
        <Toggle field="shuffle" label="Shuffle decks" hint="Mix up the card order each time you start studying." />
        <Toggle field="startWithBack" label="Answer side first" hint="Show the back of each card first, to practise recall the other way round." />
        <Toggle field="blurAnswersInNotes" label="Blur answers in notes" hint="Card answers in reading view stay blurred until you hover over them." />
      </section>

      <section className="card-panel">
        <div className="card-panel-head"><h2>Graph</h2></div>
        <Toggle field="showTagsInGraph" label="Show tags" hint="Draw #tags as rings linked to the notes that use them." />
        <Toggle field="showOrphansInGraph" label="Show orphans" hint="Include notes that don't link to anything." />
      </section>

      <section className="card-panel">
        <div className="card-panel-head"><h2>Your data</h2></div>
        <p className="setting-note">
          Your vault is stored in this browser: {Object.keys(notes).length} notes, {Object.keys(activity).length} days of
          study history, {(bytes / 1024).toFixed(1)} KB. Export it now and then so you have a backup.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => download("green-graphite-vault.json", vault.exportJSON())}>
            <Download size={14} /> Export vault
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(vault.exportMarkdown());
                toast("All notes copied as Markdown");
              } catch {
                download("green-graphite-notes.md", vault.exportMarkdown(), "text/markdown");
              }
            }}
          >
            <ClipboardCopy size={14} /> Copy all as Markdown
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> Import vault
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const err = vault.importJSON(await file.text());
              if (err) toast(err);
            }}
          />
        </div>
      </section>

      <section className="card-panel">
        <div className="card-panel-head"><h2>Keyboard</h2></div>
        <dl className="shortcuts">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt><kbd>{k}</kbd></dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card-panel danger">
        <div className="card-panel-head"><h2>Reset</h2></div>
        <p className="setting-note">Delete every note and start again with an empty vault. Export first if you want to keep your notes.</p>
        {confirmReset ? (
          <div className="btn-row">
            <span className="confirm-text">This deletes all {Object.keys(notes).length} notes.</span>
            <button
              className="btn btn-danger"
              onClick={() => {
                vault.reset();
                setConfirmReset(false);
                toast("All notes deleted");
              }}
            >
              Yes, delete everything
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-danger-outline" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Delete all notes…
          </button>
        )}
      </section>
    </div>
  );
}
