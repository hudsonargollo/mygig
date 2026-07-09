import { songs as builtInSongs } from "@/data/songs";
import type { Song } from "@/data/songs";

export interface Setlist {
  id: string;
  name: string;
  songs: Song[];
}

const SETLISTS_KEY = "lp-setlists";
const LEGACY_ORDER_KEY = "lp-setlist-order";
const LEGACY_CUSTOM_KEY = "lp-setlist-custom-songs";
const DEFAULT_SETLIST_NAME = "Toca do Raul — 21/03";

// Songs every setlist can pull from without retyping lyrics.
export const librarySongs = builtInSongs;

const readLegacyCustomSongs = (): Song[] => {
  try {
    const stored = localStorage.getItem(LEGACY_CUSTOM_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const readLegacyOrder = (allSongs: Song[]): Song[] => {
  try {
    const stored = localStorage.getItem(LEGACY_ORDER_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      const ordered = ids.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean) as Song[];
      const missing = allSongs.filter((s) => !ids.includes(s.id));
      return [...ordered, ...missing];
    }
  } catch {
    // fallthrough
  }
  return allSongs;
};

// One-time migration from the pre-multi-setlist storage shape into the
// first Setlist record, so nobody loses the setlist they already built.
const buildMigratedSetlist = (): Setlist => {
  const allSongs = [...builtInSongs, ...readLegacyCustomSongs()];
  return {
    id: "default",
    name: DEFAULT_SETLIST_NAME,
    songs: readLegacyOrder(allSongs),
  };
};

export const loadSetlists = (): Setlist[] => {
  try {
    const stored = localStorage.getItem(SETLISTS_KEY);
    if (stored) {
      const parsed: Setlist[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallthrough
  }
  const migrated = [buildMigratedSetlist()];
  saveSetlists(migrated);
  return migrated;
};

export const saveSetlists = (setlists: Setlist[]) => {
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists));
};

export const createSetlist = (name: string): Setlist => ({
  id: `setlist-${Date.now()}`,
  name,
  songs: [],
});
