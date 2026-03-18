import { useState } from "react";
import type { Song } from "@/data/songs";

interface LyricViewerTestProps {
  song: Song | null;
}

const LyricViewerTest = ({ song }: LyricViewerTestProps) => {
  const [loading, setLoading] = useState(false);

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">No Song Selected</h2>
          <p className="text-muted-foreground">Select a song from the setlist to view lyrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">{song.title}</h1>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <pre className="whitespace-pre-wrap font-mono text-foreground">
            {song.lyrics}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LyricViewerTest;