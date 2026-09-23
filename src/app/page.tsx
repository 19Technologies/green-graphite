"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Workspace from "@/components/Workspace";
import { indexOf, getVault, vault } from "@/lib/store";
import { setUI } from "@/lib/ui";

/**
 * Supports links like /?note=German/Cases (by path, title or id), plus the
 * home-screen shortcuts /?daily=1 and /?new=1.
 */
function NoteParam() {
  const params = useSearchParams();
  const router = useRouter();
  const target = params.get("note");
  const daily = params.has("daily");
  const fresh = params.has("new");
  useEffect(() => {
    if (!target && !daily && !fresh) return;
    if (target) {
      const { notes } = getVault();
      const note = notes[target] ?? indexOf(notes).resolve(target);
      if (note) vault.openNote(note.id);
    } else if (daily) vault.openDaily();
    else setUI({ pendingRename: vault.createNote() });
    router.replace("/");
  }, [target, daily, fresh, router]);
  return null;
}

export default function NotesPage() {
  return (
    <>
      <Suspense fallback={null}>
        <NoteParam />
      </Suspense>
      <Workspace />
    </>
  );
}
