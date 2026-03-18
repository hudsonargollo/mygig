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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLoadingComplete = useCallback(() => {
    setLoading(false);
    setSelectedSongId(songs[0]?.id ?? null);
  }, [songs]);

  const handleReorder = useCallback((newSongs: Song[]) => {
    setSongs(newSongs);
    localStorage.setItem(SETLIST_ORDER_KEY, JSON.stringify(newSongs.map((s) => s.id)));
  }, []);

  const handleSongChange = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = songs.findIndex(s => s.id === selectedSongId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(songs.length - 1, currentIndex + 1);
    }
    
    setSelectedSongId(songs[newIndex].id);
  }, [songs, selectedSongId]);

  const selectedSong = songs.find((s) => s.id === selectedSongId) ?? null;
  const selectedIndex = songs.findIndex((s) => s.id === selectedSongId);

  if (loading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Setlist - Collapsible */}
      <div className={`transition-all duration-300 h-full overflow-hidden ${
        sidebarCollapsed ? 'w-0' : 'w-1/4 min-w-[240px] max-w-[360px]'
      }`}>
        <SetlistSidebar
          songs={songs}
          selectedSongId={selectedSongId}
          onSelectSong={setSelectedSongId}
          onReorder={handleReorder}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          isCollapsed={sidebarCollapsed}
        />
      </div>

      {/* Lyrics - remaining width */}
      <LyricViewer 
        song={selectedSong} 
        songIndex={selectedIndex}
        onSidebarToggle={() => setSidebarCollapsed(prev => !prev)}
        sidebarCollapsed={sidebarCollapsed}
        onSongChange={handleSongChange}
        totalSongs={songs.length}
      />
    </div>
  );
};

export default Index;
