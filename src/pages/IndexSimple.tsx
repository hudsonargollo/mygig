import { useState } from "react";
import { songs as initialSongs } from "@/data/songs";

const IndexSimple = () => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSongs[0]?.id ?? null);
  const selectedSong = initialSongs.find((s) => s.id === selectedSongId) ?? null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {selectedSong?.title || "No Song Selected"}
        </h1>
        <div className="text-lg text-muted-foreground">
          {selectedSong?.lyrics ? (
            <pre className="whitespace-pre-wrap font-mono">
              {selectedSong.lyrics}
            </pre>
          ) : (
            "No lyrics available"
          )}
        </div>
      </div>
      
      <div className="w-80 bg-surface border-l border-border p-4">
        <h2 className="text-xl font-bold mb-4">Songs</h2>
        {initialSongs.map((song, index) => (
          <div
            key={song.id}
            onClick={() => setSelectedSongId(song.id)}
            className={`p-2 cursor-pointer border-b border-border ${
              song.id === selectedSongId ? "bg-muted" : "hover:bg-muted/50"
            }`}
          >
            <span className="text-sm text-muted-foreground mr-2">
              {String(index + 1).padStart(2, "0")}
            </span>
            {song.title}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexSimple;