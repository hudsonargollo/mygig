import { useState, useRef, useCallback } from "react";
import type { Song } from "@/data/songs";

interface SetlistSidebarProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (id: string) => void;
  onReorder: (songs: Song[]) => void;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
  // New props for controls
  onSongChange?: (direction: 'prev' | 'next') => void;
  onTogglePerformanceMode?: () => void;
  performanceMode?: boolean;
  onToggleAutoScroll?: () => void;
  autoScrollMode?: boolean;
  isAutoScrolling?: boolean;
  // Additional props for megamenu functionality
  onShowAudioSync?: () => void;
  onShowNotes?: () => void;
  onToggleVocalistMode?: () => void;
  onShowBackup?: () => void;
  onShowPageBreaks?: () => void;
  onShowYouTube?: () => void;
  onToggleLoopMode?: () => void;
}

const SetlistSidebar = ({ 
  songs, 
  selectedSongId, 
  onSelectSong, 
  onReorder, 
  onToggleCollapse, 
  isCollapsed,
  onSongChange,
  onTogglePerformanceMode,
  performanceMode = false,
  onToggleAutoScroll,
  autoScrollMode = false,
  isAutoScrolling = false,
  onShowAudioSync,
  onShowNotes,
  onToggleVocalistMode,
  onShowBackup,
  onShowPageBreaks,
  onShowYouTube,
  onToggleLoopMode
}: SetlistSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragItem.current === null) return;
    
    const newSongs = [...songs];
    const [removed] = newSongs.splice(dragItem.current, 1);
    newSongs.splice(dropIndex, 0, removed);
    onReorder(newSongs);
    
    setDragIndex(null);
    setOverIndex(null);
    dragItem.current = null;
  }, [songs, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragItem.current = null;
  }, []);

  // Minimized sidebar when collapsed - with hover expansion
  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-surface border-l border-border flex flex-col group hover:w-80 hover:shadow-xl transition-all duration-300 ease-out overflow-hidden">
        {/* Minimized header */}
        <div className="p-2 border-b border-border flex items-center justify-center">
          <button
            onClick={onToggleCollapse}
            className="w-12 h-8 flex items-center justify-center font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
            title="Pin sidebar open"
          >
            📌
          </button>
        </div>

        {/* Minimized: Show only numbers */}
        <div className="flex-1 overflow-y-auto group-hover:hidden">
          {songs.map((song, index) => {
            const isActive = song.id === selectedSongId;
            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song.id)}
                className={`
                  w-full h-12 flex items-center justify-center cursor-pointer
                  border-b border-border font-mono-ui text-sm font-bold
                  transition-none
                  ${isActive ? "bg-muted text-primary" : "text-muted-foreground hover:text-accent hover:bg-muted/30"}
                `}
                title={`${index + 1}. ${song.title}`}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
            );
          })}
        </div>

        {/* Expanded content on hover */}
        <div className="hidden group-hover:flex group-hover:flex-col group-hover:flex-1 group-hover:overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono-ui text-xs text-muted-foreground">SETLIST</span>
                <div className="font-mono-ui text-xs text-muted-foreground/70 mt-0.5">TOCA DO RAUL</div>
              </div>
              <button
                onClick={onToggleCollapse}
                className="w-8 h-6 flex items-center justify-center font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
                title="Pin sidebar open"
              >
                📌
              </button>
            </div>
          </div>

          {/* Compact Controls */}
          <div className="p-3 border-b border-border space-y-2">
            {/* Navigation */}
            <div className="flex gap-1">
              <button
                onClick={() => onSongChange?.('prev')}
                className="flex-1 px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Previous Song"
              >
                ⏮️
              </button>
              <button
                onClick={() => onSongChange?.('next')}
                className="flex-1 px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Next Song"
              >
                ⏭️
              </button>
            </div>

            {/* Primary Modes */}
            <div className="flex gap-1">
              <button
                onClick={onTogglePerformanceMode}
                className={`flex-1 px-2 py-1 font-mono-ui text-xs border transition-none ${
                  performanceMode
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-border text-muted-foreground hover:text-accent hover:bg-muted/30"
                }`}
                title="Performance Mode"
              >
                🎭
              </button>
              <button
                onClick={onToggleAutoScroll}
                className={`flex-1 px-2 py-1 font-mono-ui text-xs border transition-none ${
                  autoScrollMode
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-border text-muted-foreground hover:text-accent hover:bg-muted/30"
                }`}
                title="Auto-scroll"
              >
                📜
              </button>
            </div>

            {/* Tools Grid - Compact 3x2 */}
            <div className="grid grid-cols-3 gap-1">
              <button 
                onClick={onShowNotes}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Notes"
              >
                📝
              </button>
              <button 
                onClick={onToggleVocalistMode}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Vocalist Mode"
              >
                🎤
              </button>
              <button 
                onClick={onShowYouTube}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="YouTube Player"
              >
                📺
              </button>
              <button 
                onClick={onToggleLoopMode}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Loop Mode"
              >
                🔁
              </button>
              <button 
                onClick={onShowAudioSync}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Audio Sync"
              >
                🎵
              </button>
              <button 
                onClick={onShowBackup}
                className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Cloud Backup"
              >
                💾
              </button>
            </div>

            {/* Auto-scroll Status */}
            {autoScrollMode && (
              <div className="text-center">
                <span className={`font-mono-ui text-xs ${
                  isAutoScrolling ? "text-green-500" : "text-orange-500"
                }`}>
                  {isAutoScrolling ? "🟢 SCROLLING" : "⏸️ PAUSED"}
                </span>
              </div>
            )}
          </div>

          {/* Compact Song List */}
          <div className="flex-1 overflow-y-auto">
            {songs.map((song, index) => {
              const isActive = song.id === selectedSongId;
              const isDragging = dragIndex === index;
              const isOver = overIndex === index;

              return (
                <div
                  key={song.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectSong(song.id)}
                  className={`px-3 py-2 cursor-pointer transition-colors border-l-2 ${
                    isActive
                      ? "bg-accent text-accent-foreground border-l-accent"
                      : "text-muted-foreground hover:text-accent hover:bg-muted/30 border-l-transparent"
                  } ${isDragging ? "opacity-50" : ""} ${
                    isOver ? "bg-muted/50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-ui text-xs text-muted-foreground min-w-[2ch]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono-ui text-xs truncate">
                      {song.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Full sidebar when expanded
  return (
    <div className="w-full h-full bg-surface border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl tracking-wider text-foreground">SETLIST</h2>
            <p className="font-mono-ui text-xs text-muted-foreground mt-1">TOCA DO RAUL — 21/03</p>
          </div>
          <button
            onClick={onToggleCollapse}
            className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
            title="Collapse sidebar"
          >
            ⬅️
          </button>
        </div>

        {/* Control Sections */}
        <div className="space-y-4">
          {/* Navigation */}
          <div className="space-y-2">
            <div className="text-xs font-mono-ui text-muted-foreground uppercase tracking-wider">Navigation</div>
            <div className="flex gap-2">
              <button
                onClick={() => onSongChange?.('prev')}
                className="flex-1 px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Previous Song"
              >
                ⏮️ PREV
              </button>
              <button
                onClick={() => onSongChange?.('next')}
                className="flex-1 px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Next Song"
              >
                NEXT ⏭️
              </button>
            </div>
          </div>

          {/* Performance Modes */}
          <div className="space-y-2">
            <div className="text-xs font-mono-ui text-muted-foreground uppercase tracking-wider">Modes</div>
            <div className="flex gap-2">
              <button
                onClick={onTogglePerformanceMode}
                className={`flex-1 px-3 py-2 font-mono-ui text-xs border transition-none ${
                  performanceMode
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-border text-muted-foreground hover:text-accent hover:bg-muted/30"
                }`}
                title="Performance Mode"
              >
                🎭 PERFORM
              </button>
              <button
                onClick={onToggleAutoScroll}
                className={`flex-1 px-3 py-2 font-mono-ui text-xs border transition-none ${
                  autoScrollMode
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-border text-muted-foreground hover:text-accent hover:bg-muted/30"
                }`}
                title="Auto-scroll"
              >
                📜 SCROLL
              </button>
            </div>
            
            {/* Auto-scroll Status */}
            {autoScrollMode && (
              <div className="text-center py-1">
                <span className={`font-mono-ui text-xs ${
                  isAutoScrolling ? "text-green-500" : "text-orange-500"
                }`}>
                  {isAutoScrolling ? "🟢 SCROLLING" : "⏸️ PAUSED"}
                </span>
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="space-y-2">
            <div className="text-xs font-mono-ui text-muted-foreground uppercase tracking-wider">Tools</div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={onShowNotes}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Notes Panel"
              >
                📝 NOTES
              </button>
              <button 
                onClick={onToggleVocalistMode}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Vocalist Marking"
              >
                🎤 VOCALS
              </button>
              <button 
                onClick={onShowYouTube}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="YouTube Player"
              >
                📺 YOUTUBE
              </button>
              <button 
                onClick={onToggleLoopMode}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Loop Practice"
              >
                🔁 LOOPS
              </button>
              <button 
                onClick={onShowAudioSync}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Audio Sync"
              >
                🎵 AUDIO
              </button>
              <button 
                onClick={onShowBackup}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Cloud Backup"
              >
                💾 BACKUP
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {songs.map((song, index) => {
          const isActive = song.id === selectedSongId;
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== index;

          return (
            <div key={song.id}>
              {/* Gap indicator */}
              {isOver && dragIndex !== null && dragIndex < index && (
                <div className="h-8 bg-background" />
              )}
              
              <div
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectSong(song.id)}
                className={`
                  px-4 py-3 cursor-pointer select-none border-b border-border
                  font-mono-ui text-xs tracking-wide
                  transition-none
                  ${isDragging ? "opacity-50" : "opacity-100"}
                  ${isActive ? "bg-muted text-primary" : "text-muted-foreground hover:text-accent"}
                `}
              >
                <span className="text-muted-foreground mr-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {song.title.toUpperCase()}
              </div>

              {/* Gap indicator */}
              {isOver && dragIndex !== null && dragIndex > index && (
                <div className="h-8 bg-background" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SetlistSidebar;
