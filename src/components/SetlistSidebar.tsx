import { useState, useRef, useCallback } from "react";
import type { Song } from "@/data/songs";

interface SetlistSidebarProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (id: string) => void;
  onReorder: (songs: Song[]) => void;
  onAddSong?: (title: string, lyrics: string) => void;
  onDeleteSong?: (id: string) => void;
  customSongIds?: string[];
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
  onShowYouTube?: () => void;
  onToggleLoopMode?: () => void;
  onToggleEditMode?: () => void;
  onTogglePaginationMode?: () => void;
}

const SetlistSidebar = ({ 
  songs, 
  selectedSongId, 
  onSelectSong, 
  onReorder,
  onAddSong,
  onDeleteSong,
  customSongIds = [],
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
  onShowYouTube,
  onToggleLoopMode,
  onToggleEditMode,
  onTogglePaginationMode
}: SetlistSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const customSongIdSet = new Set(customSongIds);

  const [showAddSong, setShowAddSong] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLyrics, setNewLyrics] = useState("");

  const handleSubmitNewSong = useCallback(() => {
    if (!newTitle.trim() || !newLyrics.trim()) return;
    onAddSong?.(newTitle.trim(), newLyrics);
    setNewTitle("");
    setNewLyrics("");
    setShowAddSong(false);
  }, [newTitle, newLyrics, onAddSong]);

  const handleDeleteSong = useCallback((e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Remove "${title}" from the setlist? This can't be undone.`)) {
      onDeleteSong?.(id);
    }
  }, [onDeleteSong]);

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

  // Minimized sidebar when collapsed - no hover expansion
  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-surface border-l border-border flex flex-col">
        {/* Minimized header */}
        <div className="p-2 border-b border-border flex items-center justify-center">
          <button
            onClick={onToggleCollapse}
            className="w-12 h-8 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
            title="Expand sidebar"
          >
            <div className="flex flex-col gap-0.5">
              <div className="w-3 h-0.5 bg-current" />
              <div className="w-3 h-0.5 bg-current" />
              <div className="w-3 h-0.5 bg-current" />
            </div>
          </button>
        </div>

        {/* Minimized: Show only numbers */}
        <div className="flex-1 overflow-y-auto">
          {songs.map((song, index) => {
            const isActive = song.id === selectedSongId;
            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song.id)}
                className={`
                  w-full h-12 flex items-center justify-center cursor-pointer
                  border-b border-border font-mono text-sm font-bold
                  transition-colors duration-200
                  ${isActive ? "bg-muted text-primary" : "text-muted-foreground hover:text-accent hover:bg-muted/30"}
                `}
                title={`${index + 1}. ${song.title}`}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
            );
          })}
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
            className="text-muted-foreground hover:text-accent transition-colors"
            title="Collapse sidebar"
          >
            <div className="flex flex-col gap-0.5">
              <div className="w-3 h-0.5 bg-current" />
              <div className="w-3 h-0.5 bg-current" />
              <div className="w-3 h-0.5 bg-current" />
            </div>
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

          {/* Add song */}
          <button
            onClick={() => setShowAddSong(true)}
            className="w-full px-3 py-2 font-mono-ui text-xs border border-dashed border-border text-muted-foreground hover:text-accent hover:border-accent transition-none"
          >
            + ADD SONG
          </button>

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
                onClick={onToggleEditMode}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Edit Lyrics"
              >
                ✏️ EDIT
              </button>
              <button 
                onClick={onTogglePaginationMode}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent hover:bg-muted/30 transition-none"
                title="Pagination Mode"
              >
                📄 PAGES
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
          const isCustom = customSongIdSet.has(song.id);

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
                  group px-4 py-3 cursor-pointer select-none border-b border-border
                  font-mono-ui text-xs tracking-wide flex items-center justify-between
                  transition-none
                  ${isDragging ? "opacity-50" : "opacity-100"}
                  ${isActive ? "bg-muted text-primary" : "text-muted-foreground hover:text-accent"}
                `}
              >
                <span>
                  <span className="text-muted-foreground mr-3">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {song.title.toUpperCase()}
                </span>
                {isCustom && (
                  <button
                    onClick={(e) => handleDeleteSong(e, song.id, song.title)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity px-1"
                    title="Remove song"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Gap indicator */}
              {isOver && dragIndex !== null && dragIndex > index && (
                <div className="h-8 bg-background" />
              )}
            </div>
          );
        })}
      </div>

      {/* Add song modal */}
      {showAddSong && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowAddSong(false)}
        >
          <div
            className="w-full max-w-lg bg-surface border border-border p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-mono-ui text-sm text-foreground tracking-wide">ADD SONG</h3>
              <button
                onClick={() => setShowAddSong(false)}
                className="text-muted-foreground hover:text-accent"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-mono-ui text-muted-foreground">Title</label>
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Song title"
                className="w-full bg-transparent border border-border px-3 py-2 text-sm text-foreground font-mono-ui focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-mono-ui text-muted-foreground">Lyrics</label>
              <textarea
                value={newLyrics}
                onChange={(e) => setNewLyrics(e.target.value)}
                placeholder={"Paste the raw lyrics here, one line per line.\nOptional: wrap section labels in brackets, e.g. [Chorus]"}
                className="w-full h-56 bg-transparent border border-border px-3 py-2 text-sm text-foreground font-mono resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddSong(false)}
                className="px-3 py-2 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitNewSong}
                disabled={!newTitle.trim() || !newLyrics.trim()}
                className="px-3 py-2 font-mono-ui text-xs border border-accent text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-none"
              >
                SAVE SONG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetlistSidebar;