import { useState, useCallback } from "react";
import SetlistSidebar from "@/components/SetlistSidebar";
import { songs as initialSongs } from "@/data/songs";
import type { Song } from "@/data/songs";

const Index = () => {
  const [songs] = useState<Song[]>(initialSongs);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id ?? null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const selectedSong = songs.find((s) => s.id === selectedSongId) ?? null;

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Lyrics Panel */}
      <div className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {selectedSong?.title || "No Song Selected"}
        </h1>
        <div className="text-lg text-muted-foreground">
          {selectedSong?.lyrics ? (
            <pre className="whitespace-pre-wrap font-mono text-2xl md:text-4xl">
              {selectedSong.lyrics}
            </pre>
          ) : (
            "No lyrics available"
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className={`transition-all duration-300 h-full overflow-hidden ${
        sidebarCollapsed ? 'w-16' : 'w-1/4 min-w-[240px] max-w-[360px]'
      }`}>
        <SetlistSidebar
          songs={songs}
          selectedSongId={selectedSongId}
          onSelectSong={setSelectedSongId}
          onReorder={() => {}} // Disabled for now
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          isCollapsed={sidebarCollapsed}
          onSongChange={handleSongChange}
          onTogglePerformanceMode={() => {}}
          performanceMode={false}
          onToggleAutoScroll={() => {}}
          autoScrollMode={false}
          isAutoScrolling={false}
          onShowAudioSync={() => {}}
          onShowNotes={() => {}}
          onToggleVocalistMode={() => {}}
          onShowBackup={() => {}}
          onShowPageBreaks={() => {}}
          onShowYouTube={() => {}}
          onToggleLoopMode={() => {}}
        />
      </div>
    </div>
  );
};

export default Index;
