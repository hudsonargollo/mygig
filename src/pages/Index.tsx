import { useState, useCallback } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import SetlistSidebar from "@/components/SetlistSidebar";
import LyricViewer from "@/components/LyricViewer";
import { songs as initialSongs } from "@/data/songs";
import type { Song } from "@/data/songs";

const SETLIST_ORDER_KEY = "lp-setlist-order";

const loadOrder = (): Song[] => {
  try {
    const stored = localStorage.getItem(SETLIST_ORDER_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      const ordered = ids
        .map((id) => initialSongs.find((s) => s.id === id))
        .filter(Boolean) as Song[];
      // Add any new songs not in stored order
      const missing = initialSongs.filter((s) => !ids.includes(s.id));
      return [...ordered, ...missing];
    }
  } catch {
    // fallthrough
  }
  return initialSongs;
};

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<Song[]>(loadOrder);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const handleLoadingComplete = useCallback(() => {
    setLoading(false);
    setSelectedSongId(songs[0]?.id ?? null);
  }, [songs]);

  const handleReorder = useCallback((newSongs: Song[]) => {
    setSongs(newSongs);
    localStorage.setItem(SETLIST_ORDER_KEY, JSON.stringify(newSongs.map((s) => s.id)));
  }, []);

  const selectedSong = songs.find((s) => s.id === selectedSongId) ?? null;
  const selectedIndex = songs.findIndex((s) => s.id === selectedSongId);

  if (loading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Setlist - 25% width */}
      <div className="w-1/4 min-w-[240px] max-w-[360px] h-full overflow-hidden">
        <SetlistSidebar
          songs={songs}
          selectedSongId={selectedSongId}
          onSelectSong={setSelectedSongId}
          onReorder={handleReorder}
        />
      </div>

      {/* Lyrics - remaining width */}
      <LyricViewer song={selectedSong} songIndex={selectedIndex} />
    </div>
  );
};

export default Index;
