import { useState, useCallback, useEffect, useRef } from "react";
import type { Song } from "@/data/songs";

// Vocalist types
type Vocalist = "elektra" | "chinoda" | "luan";
type VocalistOrAll = Vocalist | "all";
type VocalistOrNull = VocalistOrAll | null;

// Annotation interface
interface TextAnnotation {
  songId: string;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  vocalist: Vocalist;
}

// Storage keys
const STORAGE_KEY = "lp-setlist-annotations-v2";
const NOTES_KEY = "lp-setlist-notes";
const YOUTUBE_KEY = "lp-setlist-youtube";

// Vocalist colors and labels
const VOCALIST_COLORS: Record<Vocalist, { text: string; bg: string; border: string; css: string }> = {
  elektra: { text: "text-cyan-400", bg: "bg-cyan-400/15", border: "border-cyan-400", css: "#22d3ee" },
  chinoda: { text: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400", css: "#facc15" },
  luan: { text: "text-orange-400", bg: "bg-orange-400/15", border: "border-orange-400", css: "#fb923c" },
};

const VOCALIST_LABELS: Record<Vocalist, string> = {
  elektra: "🎤", // Microphone for lead singer (Giulia/Lady Elektra)
  chinoda: "🎙️", // Studio microphone for co-lead (Huds)
  luan: "🎶", // Musical note for harmonics (Luan)
};

// Utility functions
const load = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

// Line segment interface for rendering
interface LineSegment {
  text: string;
  vocalists: Vocalist[];
  startOffset: number;
  endOffset: number;
}

// Get line segments with annotations
const getLineSegments = (
  lineText: string,
  annotations: TextAnnotation[],
  songId: string,
  lineIndex: number
): LineSegment[] => {
  const lineAnnotations = annotations.filter(
    (a) => a.songId === songId && a.lineIndex === lineIndex
  );

  if (lineAnnotations.length === 0) {
    return [{ text: lineText, vocalists: [], startOffset: 0, endOffset: lineText.length }];
  }

  // Create segments
  const segments: LineSegment[] = [];
  let currentOffset = 0;

  // Sort annotations by start offset
  const sortedAnnotations = [...lineAnnotations].sort((a, b) => a.startOffset - b.startOffset);

  for (const annotation of sortedAnnotations) {
    // Add text before annotation if any
    if (currentOffset < annotation.startOffset) {
      segments.push({
        text: lineText.slice(currentOffset, annotation.startOffset),
        vocalists: [],
        startOffset: currentOffset,
        endOffset: annotation.startOffset,
      });
    }

    // Find existing segment that overlaps or create new one
    const existingSegmentIndex = segments.findIndex(
      (seg) => seg.startOffset <= annotation.startOffset && seg.endOffset >= annotation.endOffset
    );

    if (existingSegmentIndex >= 0) {
      // Add vocalist to existing segment
      segments[existingSegmentIndex].vocalists.push(annotation.vocalist);
    } else {
      // Create new segment
      segments.push({
        text: lineText.slice(annotation.startOffset, annotation.endOffset),
        vocalists: [annotation.vocalist],
        startOffset: annotation.startOffset,
        endOffset: annotation.endOffset,
      });
    }

    currentOffset = Math.max(currentOffset, annotation.endOffset);
  }

  // Add remaining text
  if (currentOffset < lineText.length) {
    segments.push({
      text: lineText.slice(currentOffset),
      vocalists: [],
      startOffset: currentOffset,
      endOffset: lineText.length,
    });
  }

  return segments;
};

// Remove overlapping annotations for same vocalist
const removeSameVocalistOverlap = (existing: TextAnnotation[], newAnn: TextAnnotation): TextAnnotation[] => {
  const result: TextAnnotation[] = [];
  for (const ann of existing) {
    if (
      ann.songId !== newAnn.songId ||
      ann.lineIndex !== newAnn.lineIndex ||
      ann.vocalist !== newAnn.vocalist
    ) {
      result.push(ann);
      continue;
    }
    if (ann.endOffset <= newAnn.startOffset || ann.startOffset >= newAnn.endOffset) {
      result.push(ann);
      continue;
    }
    if (ann.startOffset < newAnn.startOffset) {
      result.push({ ...ann, endOffset: newAnn.startOffset });
    }
    if (ann.endOffset > newAnn.endOffset) {
      result.push({ ...ann, startOffset: newAnn.endOffset });
    }
  }
  return result;
};

// Remove all overlapping annotations
const removeAllOverlap = (existing: TextAnnotation[], songId: string, lineIndex: number, startOffset: number, endOffset: number): TextAnnotation[] => {
  const result: TextAnnotation[] = [];
  for (const ann of existing) {
    if (ann.songId !== songId || ann.lineIndex !== lineIndex) {
      result.push(ann);
      continue;
    }
    if (ann.endOffset <= startOffset || ann.startOffset >= endOffset) {
      result.push(ann);
      continue;
    }
    if (ann.startOffset < startOffset) {
      result.push({ ...ann, endOffset: startOffset });
    }
    if (ann.endOffset > endOffset) {
      result.push({ ...ann, startOffset: endOffset });
    }
  }
  return result;
};

// Segment rendering components
const SegmentSpan = ({ segment }: { segment: LineSegment }) => {
  if (segment.vocalists.length === 0) {
    return <span>{segment.text}</span>;
  }

  if (segment.vocalists.length === 1) {
    const colors = VOCALIST_COLORS[segment.vocalists[0]];
    return (
      <span className={`${colors.text} ${colors.bg} px-0.5 rounded-sm`}>
        {segment.text}
      </span>
    );
  }

  // Multi-vocalist: gradient background
  const bgColors = segment.vocalists.map((v) => VOCALIST_COLORS[v].css);
  return (
    <span
      className="px-0.5 rounded-sm text-white font-medium"
      style={{
        background: `linear-gradient(90deg, ${bgColors.join(", ")})`,
      }}
    >
      {segment.text}
    </span>
  );
};

const PerformanceSegmentSpan = ({ segment }: { segment: LineSegment }) => {
  if (segment.vocalists.length === 0) {
    return <span>{segment.text}</span>;
  }

  if (segment.vocalists.length === 1) {
    const colors = VOCALIST_COLORS[segment.vocalists[0]];
    return (
      <span
        className="font-bold"
        style={{
          color: colors.css,
          textShadow: `0 0 8px ${colors.css}66, 0 0 4px ${colors.css}88`,
        }}
      >
        {segment.text}
      </span>
    );
  }

  // Multi-vocalist: enhanced gradient
  const bgColors = segment.vocalists.map((v) => VOCALIST_COLORS[v].css);
  return (
    <span
      className="font-bold"
      style={{
        background: `linear-gradient(90deg, ${bgColors.join(", ")})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        textShadow: `0 0 12px ${bgColors[0]}88, 0 0 6px ${bgColors[0]}66`,
      }}
    >
      {segment.text}
    </span>
  );
};

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

  // Vocalist annotation states
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(() => load(STORAGE_KEY, []));
  const [activeVocalist, setActiveVocalist] = useState<VocalistOrNull>(null);
  const [eraserMode, setEraserMode] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(() => load(NOTES_KEY, {}));
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>(() => load(YOUTUBE_KEY, {}));

  // Refs
  const lyricsRef = useRef<HTMLDivElement>(null);

  // Save data to localStorage
  useEffect(() => { save(STORAGE_KEY, annotations); }, [annotations]);
  useEffect(() => { save(NOTES_KEY, notes); }, [notes]);
  useEffect(() => { save(YOUTUBE_KEY, youtubeLinks); }, [youtubeLinks]);

  // Mouse selection handler for vocalist annotations
  const handleMouseUp = useCallback(() => {
    if (!song) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = lyricsRef.current;
    if (!container || !container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    const startLine = range.startContainer.parentElement?.closest("[data-line-index]");
    const endLine = range.endContainer.parentElement?.closest("[data-line-index]");
    if (!startLine || !endLine) return;

    const startLineIdx = parseInt(startLine.getAttribute("data-line-index") || "-1");
    const endLineIdx = parseInt(endLine.getAttribute("data-line-index") || "-1");
    if (startLineIdx < 0 || endLineIdx < 0) return;

    // Helper to get offsets for a line
    const getOffsets = (li: number, isStart: boolean, isEnd: boolean) => {
      const lineEl = container.querySelector(`[data-line-index="${li}"]`);
      if (!lineEl) return null;
      const lineText = lineEl.textContent || "";
      let startOffset = 0;
      let endOffset = lineText.length;
      if (isStart) {
        const preRange = document.createRange();
        preRange.selectNodeContents(lineEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        startOffset = preRange.toString().length;
      }
      if (isEnd) {
        const preRange = document.createRange();
        preRange.selectNodeContents(lineEl);
        preRange.setEnd(range.endContainer, range.endOffset);
        endOffset = preRange.toString().length;
      }
      return startOffset < endOffset ? { lineIndex: li, startOffset, endOffset } : null;
    };

    if (eraserMode) {
      setAnnotations((prev) => {
        let updated = [...prev];
        
        // Remove all existing annotations in the selected range (all vocalists)
        for (let li = startLineIdx; li <= endLineIdx; li++) {
          const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
          if (offsets) {
            updated = removeAllOverlap(updated, song.id, offsets.lineIndex, offsets.startOffset, offsets.endOffset);
          }
        }
        
        return updated;
      });
      selection.removeAllRanges();
      return;
    }

    if (activeVocalist) {
      const newAnnotations: TextAnnotation[] = [];
      for (let li = startLineIdx; li <= endLineIdx; li++) {
        const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
        if (offsets) {
          if (activeVocalist === "all") {
            // Mark for all three vocalists
            const allVocalists: Vocalist[] = ["elektra", "chinoda", "luan"];
            for (const vocalist of allVocalists) {
              newAnnotations.push({ 
                songId: song.id, 
                lineIndex: offsets.lineIndex, 
                startOffset: offsets.startOffset, 
                endOffset: offsets.endOffset, 
                vocalist 
              });
            }
          } else {
            newAnnotations.push({ 
              songId: song.id, 
              lineIndex: offsets.lineIndex, 
              startOffset: offsets.startOffset, 
              endOffset: offsets.endOffset, 
              vocalist: activeVocalist 
            });
          }
        }
      }
      if (newAnnotations.length > 0) {
        setAnnotations((prev) => {
          let updated = [...prev];
          for (const newAnn of newAnnotations) {
            // Only remove same-vocalist overlaps — other vocalists stay!
            updated = removeSameVocalistOverlap(updated, newAnn);
            updated.push(newAnn);
          }
          return updated;
        });
      }
      selection.removeAllRanges();
    }
  }, [song, activeVocalist, eraserMode]);

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
    // Toggle between no vocalist and first vocalist (elektra)
    setActiveVocalist(prev => prev === null ? "elektra" : null);
    setEraserMode(false);
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

  // Vocalist toggle functions
  const toggleVocalist = (v: VocalistOrNull) => {
    setEraserMode(false);
    setActiveVocalist((prev) => (prev === v ? null : v));
  };

  const toggleEraserMode = () => {
    setActiveVocalist(null);
    setEraserMode((prev) => !prev);
  };

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
    // Performance mode - full screen lyrics with annotations
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white relative">
        <div className="w-full max-w-6xl text-center p-8">
          <div className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {(() => {
              const lines = song.lyrics.split("\n");
              return lines.map((line, index) => {
                const trimmed = line.trim();
                const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
                const isEmpty = trimmed === "";

                if (isEmpty) return <div key={index} className="h-8" />;

                if (isSection) {
                  return (
                    <div key={index} className="text-center my-12">
                      <span className="text-blue-400 text-2xl md:text-3xl uppercase tracking-wider font-medium">
                        {trimmed.slice(1, -1)}
                      </span>
                    </div>
                  );
                }

                const segments = getLineSegments(trimmed, annotations, song.id, index);
                return (
                  <div key={index} className="text-center mb-6">
                    <div className="text-2xl md:text-3xl lg:text-4xl font-normal text-white leading-relaxed">
                      {segments.map((seg, si) => (
                        <PerformanceSegmentSpan key={si} segment={seg} />
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
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

  const currentNote = notes[song.id] || "";
  const currentYouTube = youtubeLinks[song.id] || "";

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

          {/* Vocalist buttons */}
          <button
            onClick={() => toggleVocalist("all")}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              activeVocalist === "all"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            ALL
          </button>
          
          {(["elektra", "chinoda", "luan"] as const).map((v) => {
            const labels: Record<Vocalist, string> = { elektra: "LADY", chinoda: "HUDS", luan: "LUAN" };
            const colors = VOCALIST_COLORS[v];
            const symbol = VOCALIST_LABELS[v];
            return (
              <button
                key={v}
                onClick={() => toggleVocalist(v)}
                className={`px-3 py-1 font-mono text-xs border transition-none flex items-center gap-2 ${
                  activeVocalist === v
                    ? `${colors.border} ${colors.text} ${colors.bg}`
                    : "border-border text-muted-foreground hover:text-accent"
                }`}
                style={{
                  borderLeft: `4px solid ${colors.css}`,
                  backgroundColor: activeVocalist === v 
                    ? `${colors.css}15` 
                    : `${colors.css}05`,
                }}
              >
                <span className="text-sm">{symbol}</span>
                {labels[v]}
              </button>
            );
          })}

          <button
            onClick={toggleEraserMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              eraserMode
                ? "border-red-500 text-red-500 bg-red-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            🗑️ ERASER
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

      {/* Instruction banner */}
      {activeVocalist && (
        <div className={`px-6 py-2 text-xs font-mono border-b border-border ${
          activeVocalist === "all" 
            ? "text-primary bg-muted/30"
            : `${VOCALIST_COLORS[activeVocalist as Vocalist].text} bg-muted/30`
        }`}>
          ✎ Select text to mark as{" "}
          {activeVocalist === "all" 
            ? "ALL VOCALISTS" 
            : activeVocalist === "elektra" ? "LADY 🎤 (Lead Singer)" 
            : activeVocalist === "chinoda" ? "HUDS 🎙️ (Rap/Co-Lead)" 
            : "LUAN 🎶 (Harmonics)"}.
          {" "}Can overlap with other vocalists.
        </div>
      )}
      {eraserMode && (
        <div className="px-6 py-2 text-xs font-mono border-b border-border text-red-500 bg-muted/30">
          🗑️ Select text to remove vocalist markings.
        </div>
      )}

      {/* Notes panel */}
      {showNotes && (
        <div className="border-b border-blue-500 bg-blue-500/10 p-4">
          <div className="text-sm text-blue-400 mb-2">📝 Notes for {song.title}</div>
          <textarea
            value={currentNote}
            onChange={(e) => setNotes(prev => ({ ...prev, [song.id]: e.target.value }))}
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
            value={currentYouTube}
            onChange={(e) => setYoutubeLinks(prev => ({ ...prev, [song.id]: e.target.value }))}
            className="w-full bg-transparent border border-red-500/30 rounded p-2 text-sm text-foreground focus:outline-none focus:border-red-500"
            placeholder="Paste YouTube URL here..."
          />
        </div>
      )}

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:px-10 md:py-8">
          <div className={`${sidebarCollapsed ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`} ref={lyricsRef} onMouseUp={handleMouseUp}>
            {song.lyrics.split("\n").map((line, i) => {
              const trimmed = line.trim();
              const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
              const isEmpty = trimmed === "";

              if (isEmpty) return <div key={i} className="h-6" />;

              if (isSection) {
                return (
                  <div key={i} className="text-center my-8">
                    <span className="text-blue-400 text-xl md:text-2xl uppercase tracking-wider font-medium">
                      {trimmed.slice(1, -1)}
                    </span>
                  </div>
                );
              }

              const segments = getLineSegments(trimmed, annotations, song.id, i);
              return (
                <div key={i} data-line-index={i} className="mb-4 text-2xl md:text-4xl leading-relaxed font-mono">
                  {segments.map((seg, si) => (
                    <SegmentSpan key={si} segment={seg} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LyricViewerSimple;