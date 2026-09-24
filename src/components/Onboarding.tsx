"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, GraduationCap, Moon, MonitorSmartphone, Sun, X } from "lucide-react";
import { useVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";

/* Small live demos, one per step, drawn with the app's own styles. */

function DemoWelcome() {
  return (
    <div className="ob-demo ob-demo-bubbles" aria-hidden>
      <span className="bubble b1">[[Hallo]]</span>
      <span className="bubble b2">Hund :: dog</span>
      <span className="bubble b3">#deutsch</span>
      <span className="bubble b4">Tschüss!</span>
    </div>
  );
}

function DemoLinks() {
  return (
    <div className="ob-demo ob-demo-editor" aria-hidden>
      <div className="ob-line">
        Heute lerne ich <span className="ob-bracket">[[</span>
        <span className="ed-link">Verben</span>
        <span className="ob-bracket">]]</span>
        <span className="ob-caret" />
      </div>
      <div className="ob-suggest">
        <span className="ob-suggest-row is-active">Create note “Verben”</span>
        <span className="ob-suggest-row">Verbs – sein &amp; haben</span>
      </div>
    </div>
  );
}

function DemoCards() {
  const rows: Array<[string, string, string]> = [
    ["Hallo :: Hello", "one card", "sun"],
    ["der Hund ::: the dog", "two cards, both ways", "sky"],
    ["Ich ==bin== müde", "fill the gap", "lilac"],
    ["Question / ? / Answer", "multi-line card", "peach"],
  ];
  return (
    <div className="ob-demo ob-demo-list" aria-hidden>
      {rows.map(([code, label, tint]) => (
        <div key={code} className="ob-syntax">
          <code>{code}</code>
          <span className={`ob-pill tint-${tint}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function DemoStudy() {
  return (
    <div className="ob-demo ob-demo-study" aria-hidden>
      <div className="ob-flip">
        <div className="ob-face ob-front">Hallo</div>
        <div className="ob-face ob-back">Hello</div>
      </div>
      <div className="ob-keys">
        <kbd>Space</kbd> flip <kbd>←</kbd>
        <kbd>→</kbd> move <span className="ob-no-grade">No grading. Just flip through.</span>
      </div>
    </div>
  );
}

function DemoGraph() {
  const nodes: Array<[number, number, number, string]> = [
    [150, 80, 11, "Greetings"],
    [60, 50, 7, "Welcome"],
    [240, 45, 7, "Verbs"],
    [85, 140, 8, "Cases"],
    [230, 140, 6, "Daily"],
  ];
  const links: Array<[number, number]> = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 3], [2, 3]];
  return (
    <div className="ob-demo ob-demo-graph" aria-hidden>
      <svg viewBox="0 0 300 180">
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            className={a === 0 ? "ob-edge is-hot" : "ob-edge"}
          />
        ))}
        {nodes.map(([x, y, r, label], i) => (
          <g key={label}>
            <circle cx={x} cy={y} r={r} className={i === 0 ? "ob-node is-active" : "ob-node"} />
            <text x={x} y={y + r + 13} textAnchor="middle" className="ob-label">
              {label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function DemoShortcuts() {
  const keys: Array<[string, string]> = [
    ["⌘K", "Commands"],
    ["⌘O", "Jump to a note"],
    ["⌘E", "Read / edit"],
    ["⌘⇧F", "Search"],
  ];
  const gestures: Array<[string, string]> = [
    ["Swipe right", "Files"],
    ["Swipe left", "Links & outline"],
    ["Pull down", "Commands"],
    ["Long-press", "File actions"],
  ];
  return (
    <div className="ob-demo ob-demo-grid" aria-hidden>
      <div>
        <b>On a computer</b>
        {keys.map(([k, v]) => (
          <span key={k}>
            <kbd>{k}</kbd> {v}
          </span>
        ))}
      </div>
      <div>
        <b>On a phone</b>
        {gestures.map(([k, v]) => (
          <span key={k}>
            <em>{k}</em> {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function DemoTheme() {
  const { settings } = useVault();
  const options = [
    { id: "paper", label: "Paper", icon: <Sun size={18} /> },
    { id: "graphite", label: "Graphite", icon: <Moon size={18} /> },
    { id: "system", label: "System", icon: <MonitorSmartphone size={18} /> },
  ] as const;
  return (
    <div className="ob-demo">
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
          </button>
        ))}
      </div>
      <p className="ob-fine">
        Tip: add Green Graphite to your home screen from Settings → Install the app. It works offline.
      </p>
    </div>
  );
}

interface Step {
  eyebrow: string;
  title: string;
  body: ReactNode;
  demo: ReactNode;
}

const STEPS: Step[] = [
  {
    eyebrow: "Welcome",
    title: "Notes that connect.",
    body: "Green Graphite is a notebook for learning languages. Your notes link together like Obsidian, and your flashcards live right inside them.",
    demo: <DemoWelcome />,
  },
  {
    eyebrow: "Step 1 · Links",
    title: "Link your ideas.",
    body: (
      <>
        Type <b>[[</b> and a note name. If the note doesn&apos;t exist yet, pick <b>Create note</b>. Links show up green,
        and a tap opens them.
      </>
    ),
    demo: <DemoLinks />,
  },
  {
    eyebrow: "Step 2 · Flashcards",
    title: "Write cards as you write notes.",
    body: "Any line can be a flashcard. Cards are gathered into decks automatically, named after the note's folder.",
    demo: <DemoCards />,
  },
  {
    eyebrow: "Step 3 · Study",
    title: "Flip through your decks.",
    body: "Open Flashcards and pick a deck. Tap or press Space to flip, swipe or use the arrows to move. Your study days fill the activity heatmap.",
    demo: <DemoStudy />,
  },
  {
    eyebrow: "Step 4 · Connections",
    title: "See how it all fits.",
    body: "The right sidebar shows which notes link to the one you're reading. Graph view draws your whole vault. Tap any dot to open that note.",
    demo: <DemoGraph />,
  },
  {
    eyebrow: "Step 5 · Speed",
    title: "Move fast.",
    body: "A few shortcuts and gestures get you anywhere in a second.",
    demo: <DemoShortcuts />,
  },
  {
    eyebrow: "Last step",
    title: "Make it yours.",
    body: "Pick a look. You can change it any time from the ribbon or Settings.",
    demo: <DemoTheme />,
  },
];

function Tour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];
  const close = () => setUI({ onboarding: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUI({ onboarding: false });
      else if (e.key === "ArrowRight") setStep((n) => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setStep((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const finish = () => {
    close();
    setUI({ pendingRename: vault.createNote() });
    if (pathname !== "/") router.push("/");
  };

  return (
    <div className="ob-layer" data-no-swipe role="dialog" aria-modal="true" aria-label="Learn Green Graphite">
      <div className="ob-backdrop" onClick={close} />
      <div className="ob-card">
        <div className="ob-top">
          <button className="icon-btn" onClick={() => setStep((n) => Math.max(n - 1, 0))} disabled={step === 0} aria-label="Previous step">
            <ArrowLeft size={18} />
          </button>
          <div className="ob-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ob-body" key={step}>
          <p className="eyebrow">
            <span className="dot" /> {s.eyebrow}
          </p>
          <h1 className="ob-title">{s.title}</h1>
          <p className="ob-text">{s.body}</p>
          {s.demo}
        </div>
        <div className="ob-foot">
          {last ? (
            <>
              <button className="btn btn-lg" onClick={close}>
                Explore first
              </button>
              <button className="btn btn-primary btn-lg" onClick={finish}>
                Create my first note
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-lg" onClick={close}>
                Skip
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(step + 1)}>
                {step === 0 ? "Show me" : "Next"} <ArrowRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { onboarding } = useUI();
  return onboarding ? <Tour /> : null;
}

/** The "Learn" button that opens the tour. */
export function LearnButton({
  className = "learn-btn",
  label = true,
  text = "Learn",
}: {
  className?: string;
  label?: boolean;
  text?: string;
}) {
  return (
    <button className={className} onClick={() => setUI({ onboarding: true, mobileLeft: false, sheet: null })} title="Learn the basics" aria-label="Learn the basics">
      <GraduationCap size={17} />
      {label && <span>{text}</span>}
    </button>
  );
}
