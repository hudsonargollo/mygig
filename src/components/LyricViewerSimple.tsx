import { useState, useCallback, useEffect } from "react";
import type { Song } from "@/data/songs";

interface LyricViewerSimpleProps {
  song: Song | null;
  songIndex: number;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  onSongChange?: (direction: 'prev' | 'next') => void;
  totalSongs?: number;
  onGetToggleFunctions?: (functions: {
    togglePerformanceMode: () => void;
    toggleAutoScrollMode: () => void;
    toggleNotes: () => void;
    toggleVocalistMode: () => void;
    toggleYouTube: () => void;
    toggleLoopMode: () => void;
    toggleAudioSync: () => void;
    toggleBackup: () => void;
  }) => void;
  onPerformanceModeChange?: (enabled: boolean) => void;
  onAutoScrollModeChange?: (enabled: boolean) => void;
  onAutoScrollingChange?: (scrolling: boolean) => void;
}

const LyricViewerSimple = ({ 
  song, 
  songIndex, 
  onSidebarToggle, 
  sidebarCollapsed, 
  onSongChange, 
  totalSongs = 0, 
  onGetToggleFunctions,
  onPerformanceModeChange,
  onAutoScrollModeChange,
  onAutoScrollingChange
}: LyricViewerSimpleProps) => {
  // Basic states
  const [performanceMode, setPerformanceMode] = useState(false);
  const [autoScrollMode, setAutoScrollMode] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);

  // Toggle functions
  const togglePerformanceMode = useCallback(() => {
    const newMode = !performanceMode;
    setPerformanceMode(newMode);
    onPerformanceModeChange?.(newMode);
  }, [performanceMode, onPerformanceModeChange]);

  const toggleAutoScrollMode = useCallback(() => {
    const newMode = !autoScrollMode;
    setAutoScrollMode(newMode);
    onAutoScrollModeChange?.(newMode);
  }, [autoScrollMode, onAutoScrollModeChange]);

  const toggleNotes = useCallback(() => {
    setShowNotes(prev => !prev);
  }, []);

  const toggleVocalistMode = useCallback(() => {
    // Placeholder for vocalist mode
    console.log('Vocalist mode toggled');
  }, []);

  const toggleYouTube = useCallback(() => {
    setShowYouTube(prev => !prev);
  }, []);

  const toggleLoopMode = useCallback(() => {
    // Placeholder for loop mode
    console.log('Loop mode toggled');
  }, []);

  const toggleAudioSync = useCallback(() => {
    // Placeholder for audio sync
    console.log('Audio sync toggled');
  }, []);

  const toggleBackup = useCallback(() => {
    // Placeholder for backup
    console.log('Backup toggled');
  }, []);

  // Expose toggle functions to parent
  useEffect(() => {
    if (onGetToggleFunctions) {
      onGetToggleFunctions({
        togglePerformanceMode,
        toggleAutoScrollMode,
        toggleNotes,
        toggleVocalistMode,
        toggleYouTube,
        toggleLoopMode,
        toggleAudioSync,
        toggleBackup
      });
    }
  }, [onGetToggleFunctions, togglePerformanceMode, toggleAutoScrollMode, toggleNotes, toggleVocalistMode, toggleYouTube, toggleLoopMode, toggleAudioSync, toggleBackup]);

  // Notify parent of state changes
  useEffect(() => {
    onAutoScrollingChange?.(isAutoScrolling);
  }, [isAutoScrolling, onAutoScrollingChange]);

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-mono text-sm">
          No song selected
        </div>
      </div>
    );
  }

  if (performanceMode) {
    // Performance mode - full screen lyrics
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white relative">
        <div className="w-full max-w-6xl text-center p-8">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            <pre className="whitespace-pre-wrap font-mono">
              {song.lyrics}
            </pre>
          </div>
        </div>
        
        {/* Exit button */}
        <button
          onClick={togglePerformanceMode}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-red-600/30 text-red-300 hover:bg-red-600/50 hover:text-white transition-all duration-300 flex items-center justify-center text-xl font-bold border border-red-500/50"
          title="Exit Performance Mode"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="border-b border-border p-6 flex items-end justify-between shrink-0 flex-wrap gap-2">
        <div>
          <span className="font-mono text-xs text-muted-foreground">
            TRACK {String(songIndex + 1).padStart(2, "0")}
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wide text-foreground leading-none mt-1">
            {song.title.toUpperCase()}
          </h1>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={togglePerformanceMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              performanceMode
                ? "border-purple-500 text-purple-500 bg-purple-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            🎤 PERFORMANCE
          </button>
          
          <button
            onClick={toggleAutoScrollMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              autoScrollMode
                ? "border-orange-500 text-orange-500 bg-orange-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            📜 AUTO SCROLL
          </button>
          
          <button
            onClick={toggleYouTube}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              showYouTube
                ? "border-red-500 text-red-500 bg-red-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            📺 YOUTUBE
          </button>
          
          <button
            onClick={toggleNotes}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              showNotes
                ? "border-blue-500 text-blue-500 bg-blue-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            📝 NOTES
          </button>
        </div>
      </div>

      {/* Notes panel */}
      {showNotes && (
        <div className="border-b border-blue-500 bg-blue-500/10 p-4">
          <div className="text-sm text-blue-400 mb-2">📝 Notes for {song.title}</div>
          <textarea
            className="w-full h-20 bg-transparent border border-blue-500/30 rounded p-2 text-sm text-foreground resize-none focus:outline-none focus:border-blue-500"
            placeholder="Add your notes here..."
          />
        </div>
      )}

      {/* YouTube panel */}
      {showYouTube && (
        <div className="border-b border-red-500 bg-red-500/10 p-4">
          <div className="text-sm text-red-400 mb-2">📺 YouTube for {song.title}</div>
          <input
            type="url"
            className="w-full bg-transparent border border-red-500/30 rounded p-2 text-sm text-foreground focus:outline-none focus:border-red-500"
            placeholder="Paste YouTube URL here..."
          />
        </div>
      )}

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:px-10 md:py-8">
          <div className={`${sidebarCollapsed ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
            <pre className="whitespace-pre-wrap font-mono text-2xl md:text-4xl leading-relaxed text-foreground">
              {song.lyrics}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LyricViewerSimple;