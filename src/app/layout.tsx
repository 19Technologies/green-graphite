import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const ui = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-ui" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });
const serif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});

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
  themeColor: "#0b0e0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
