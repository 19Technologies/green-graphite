"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getVault, vault } from "@/lib/store";

// The old Dictionary page now lives in a note, where every "word :: meaning" line is a flashcard.
export default function DictionaryRedirect() {
  const router = useRouter();
  useEffect(() => {
    const note = Object.values(getVault().notes).find((n) => n.path === "Vocabulary/Dictionary");
    if (note) vault.openNote(note.id);
    else vault.createNote({ folder: "Vocabulary", title: "Dictionary", content: "#vocabulary\n\nword :: meaning\n" });
    router.replace("/");
  }, [router]);
  return null;
}
