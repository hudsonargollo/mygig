import { useState } from "react";
import type { Song } from "@/data/songs";

interface LyricViewerProps {
  song: Song | null;
  songIndex: number;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  onSongChange: (direction: 'prev' | 'next') => void;
  totalSongs: number;
}

const LyricViewer = ({ song, songIndex, onSidebarToggle, sidebarCollapsed, onSongChange, totalSongs }: LyricViewerProps) => {
  const [performanceMode, setPerformanceMode] = useState(false);

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

  if (performanceMode) {
    return (
      <div className="flex-1 bg-black text-white flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{song.title}</h1>
              <p className="text-sm text-gray-400">Song {songIndex + 1} of {totalSongs}</p>
            </div>
            <button
              onClick={() => setPerformanceMode(false)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Exit Performance Mode
            </button>
          </div>
        </div>

        {/* Lyrics */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <pre className="whitespace-pre-wrap font-mono text-2xl leading-relaxed text-white">
              {song.lyrics}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{song.title}</h1>
          <p className="text-sm text-muted-foreground">Song {songIndex + 1} of {totalSongs}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSongChange('prev')}
            disabled={songIndex === 0}
            className="px-3 py-1 border border-border text-foreground disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => onSongChange('next')}
            disabled={songIndex === totalSongs - 1}
            className="px-3 py-1 border border-border text-foreground disabled:opacity-50"
          >
            Next →
          </button>
          <button
            onClick={() => setPerformanceMode(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Performance Mode
          </button>
        </div>
      </div>

      {/* Lyrics */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <pre className="whitespace-pre-wrap font-mono text-foreground leading-relaxed">
            {song.lyrics}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LyricViewer;