import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Cranoly",
    short_name: "Cranoly",
    description: "Linked notes for language learning, with flashcards inside your notes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1b1b1e",
    theme_color: "#1b1b1e",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's daily note", short_name: "Daily note", url: "/?daily=1" },
      { name: "New note", url: "/?new=1" },
      { name: "Study flashcards", short_name: "Study", url: "/flashcards/study" },
      { name: "Graph view", short_name: "Graph", url: "/graph" },
    ],
  };
}
