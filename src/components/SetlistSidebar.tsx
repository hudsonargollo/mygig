import { useState, useRef, useCallback } from "react";
import type { Song } from "@/data/songs";

interface SetlistSidebarProps {
  songs: Song[];
  selectedSongId: string | null;
  onSelectSong: (id: string) => void;
  onReorder: (songs: Song[]) => void;
}

const SetlistSidebar = ({ songs, selectedSongId, onSelectSong, onReorder }: SetlistSidebarProps) => {
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

  return (
    <div className="w-full h-full bg-surface border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-2xl tracking-wider text-foreground">SETLIST</h2>
        <p className="font-mono-ui text-xs text-muted-foreground mt-1">TOCA DO RAUL — 21/03</p>
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

      {/* Legend */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-cyan inline-block" />
          <span className="font-mono-ui text-xs text-foreground">LADY ELEKTRA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow inline-block" />
          <span className="font-mono-ui text-xs text-foreground">HUDS CHINODA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-orange inline-block" />
          <span className="font-mono-ui text-xs text-foreground">LUAN DELSON</span>
        </div>
      </div>
    </div>
  );
};

export default SetlistSidebar;
