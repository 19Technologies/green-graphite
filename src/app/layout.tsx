import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

// Tutora brand type: Bricolage Grotesque for display, Instrument Sans for text.
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display", axes: ["opsz"] });
const ui = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-ui" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Green Graphite",
  applicationName: "Green Graphite",
  description: "A linked-notes vault for language learning, with flashcards written right inside your notes.",
  appleWebApp: { capable: true, title: "Graphite", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1e" },
  ],
};

// Applies the saved theme before first paint so the page never flashes the wrong one.
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("green-graphite-vault")||"{}").settings||{};var t=s.theme||"paper";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"graphite":"paper";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="paper"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`} data-theme="paper" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
