import { useState, useRef, useCallback } from "react";
import type { Song } from "@/data/songs";

interface SetlistSidebarProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (id: string) => void;
  onReorder: (songs: Song[]) => void;
  onToggleCollapse: () => void;
  isCollapsed: boolean;
}

const SetlistSidebar = ({ songs, selectedSongId, onSelectSong, onReorder, onToggleCollapse, isCollapsed }: SetlistSidebarProps) => {
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

  // Minimized sidebar when collapsed
  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-surface border-r border-border flex flex-col">
        {/* Minimized header with hamburger */}
        <div className="p-2 border-b border-border flex items-center justify-center">
          <button
            onClick={onToggleCollapse}
            className="w-12 h-8 flex items-center justify-center font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
            title="Expand sidebar"
          >
            ☰
          </button>
        </div>

        {/* Minimized song list - just numbers */}
        <div className="flex-1 overflow-y-auto">
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
      </div>
    );
  }

  // Full sidebar when expanded
  return (
    <div className="w-full h-full bg-surface border-r border-border flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-wider text-foreground">SETLIST</h2>
          <p className="font-mono-ui text-xs text-muted-foreground mt-1">TOCA DO RAUL — 21/03</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="px-2 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent transition-none"
          title="Collapse sidebar"
        >
          ☰
        </button>
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
