import { useState, useCallback, useEffect, useRef } from "react";
import type { Song } from "@/data/songs";
import { saveToDatabase, loadFromDatabase, loadTimingData } from "@/utils/cloud-storage";
import type { DatabaseData, TimingData } from "@/utils/cloud-storage";
import YouTubePlayer, { formatTime, parseTime } from "./YouTubePlayer";
import type { LoopRegion } from "./YouTubePlayer";
import { AudioSync } from "./AudioSync";
import { CloudBackup } from "./CloudBackup";
import { toast } from "sonner";

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
const LOOPS_KEY = "lp-setlist-loops";
const TIMINGS_KEY = "lp-setlist-timings";
const SCROLL_SPEEDS_KEY = "lp-setlist-scroll-speeds";

// Vocalist colors and labels - Using inline styles for better compatibility
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

// Maps the real names used in raw lyric cues (e.g. "(Luan+Giulia)") to vocalist ids
const VOCALIST_NAME_MAP: Record<string, Vocalist> = {
  giulia: "elektra",
  elektra: "elektra",
  "lady elektra": "elektra",
  hudson: "chinoda",
  huds: "chinoda",
  chinoda: "chinoda",
  luan: "luan",
};

// A line like "(Luan+Giulia)" or "(Giulia, Hudson e Luan)" is a vocalist cue if every
// comma/plus/"e"/"and"-separated token inside the parens resolves to a known name.
// Lines like "(Oh)" or "(ahhh)" fall through and are treated as ordinary lyric text.
const parseVocalistCue = (trimmedLine: string): Vocalist[] | null => {
  if (!trimmedLine.startsWith("(") || !trimmedLine.endsWith(")")) return null;
  const inner = trimmedLine.slice(1, -1).trim();
  if (!inner) return null;

  const tokens = inner
    .split(/\+|,|\be\b|\band\b/i)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const vocalists: Vocalist[] = [];
  for (const token of tokens) {
    const vocalist = VOCALIST_NAME_MAP[token];
    if (!vocalist) return null;
    if (!vocalists.includes(vocalist)) vocalists.push(vocalist);
  }
  return vocalists;
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

// Merge helpers for reconciling cloud data with local state when multiple
// devices share the same synced identity. These are additive/union merges —
// local wins on key/id conflicts, but nothing present only on one side is
// dropped. Deletions (e.g. the eraser) still only apply to the device that
// made them until that device's own next sync overwrites the cloud copy.
const annotationKey = (a: TextAnnotation) =>
  `${a.songId}|${a.lineIndex}|${a.startOffset}|${a.endOffset}|${a.vocalist}`;

const mergeAnnotations = (local: TextAnnotation[], remote: TextAnnotation[]): TextAnnotation[] => {
  const map = new Map<string, TextAnnotation>();
  for (const a of remote) map.set(annotationKey(a), a);
  for (const a of local) map.set(annotationKey(a), a);
  return Array.from(map.values());
};

const mergeById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) map.set(item.id, item);
  return Array.from(map.values());
};

const mergeRecord = <T,>(local: Record<string, T>, remote: Record<string, T>): Record<string, T> => ({
  ...remote,
  ...local,
});

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

  // Create a map of all unique positions where annotations start or end
  const positions = new Set<number>();
  positions.add(0);
  positions.add(lineText.length);
  
  for (const ann of lineAnnotations) {
    positions.add(ann.startOffset);
    positions.add(ann.endOffset);
  }
  
  const sortedPositions = Array.from(positions).sort((a, b) => a - b);
  const segments: LineSegment[] = [];
  
  // Create segments between consecutive positions
  for (let i = 0; i < sortedPositions.length - 1; i++) {
    const segmentStart = sortedPositions[i];
    const segmentEnd = sortedPositions[i + 1];
    
    if (segmentStart >= segmentEnd) continue;
    
    // Find vocalists whose annotations EXACTLY match or contain this segment
    const vocalists: Vocalist[] = [];
    for (const ann of lineAnnotations) {
      // Only include vocalist if their annotation actually covers this EXACT segment
      // The annotation must start at or before segment start AND end at or after segment end
      if (ann.startOffset <= segmentStart && ann.endOffset >= segmentEnd) {
        vocalists.push(ann.vocalist);
      }
    }
    
    // Only create segment if it has text
    const segmentText = lineText.slice(segmentStart, segmentEnd);
    if (segmentText.length > 0) {
      segments.push({
        text: segmentText,
        vocalists,
        startOffset: segmentStart,
        endOffset: segmentEnd,
      });
    }
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
      <span 
        className="px-1 py-0.5 rounded-sm"
        style={{
          color: colors.css,
          backgroundColor: `${colors.css}20`,
          border: `1px solid ${colors.css}40`
        }}
      >
        {segment.text}
      </span>
    );
  }

  // Multi-vocalist: gradient background
  const bgColors = segment.vocalists.map((v) => VOCALIST_COLORS[v].css);
  return (
    <span
      className="px-1 py-0.5 rounded-sm text-white font-medium"
      style={{
        background: `linear-gradient(90deg, ${bgColors.join(", ")})`,
        border: `1px solid ${bgColors[0]}60`
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
    toggleEditMode: () => void;
    togglePaginationMode: () => void;
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
  const [showAudioSync, setShowAudioSync] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [paginationMode, setPaginationMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [editedLyrics, setEditedLyrics] = useState<Record<string, string>>(() => load('edited-lyrics', {}));
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Vocalist annotation states
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(() => load(STORAGE_KEY, []));
  const [activeVocalist, setActiveVocalist] = useState<VocalistOrNull>(null);
  const [eraserMode, setEraserMode] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>(() => load(NOTES_KEY, {}));
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>(() => load(YOUTUBE_KEY, {}));

  // Loop practice states
  const [loops, setLoops] = useState<LoopRegion[]>(() => load(LOOPS_KEY, []));
  const [activeLoop, setActiveLoop] = useState<LoopRegion | null>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [pendingLoop, setPendingLoop] = useState<{ lineStart: number; lineEnd: number; label: string } | null>(null);
  const [editingLoop, setEditingLoop] = useState<LoopRegion | null>(null);
  const [loopStartInput, setLoopStartInput] = useState("0:00");
  const [loopEndInput, setLoopEndInput] = useState("0:30");
  const [loopLabelInput, setLoopLabelInput] = useState("");

  // Audio sync states
  const [timings, setTimings] = useState<Record<string, TimingData[]>>(() => load(TIMINGS_KEY, {}));
  const [audioActiveLine, setAudioActiveLine] = useState<number | null>(null);

  // Auto-scroll states
  const [scrollSpeeds, setScrollSpeeds] = useState<Record<string, number>>(() => load(SCROLL_SPEEDS_KEY, {}));

  // Refs
  const lyricsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Save data to localStorage
  useEffect(() => { save(STORAGE_KEY, annotations); }, [annotations]);
  useEffect(() => { save(NOTES_KEY, notes); }, [notes]);
  useEffect(() => { save(YOUTUBE_KEY, youtubeLinks); }, [youtubeLinks]);
  useEffect(() => { save('edited-lyrics', editedLyrics); }, [editedLyrics]);
  useEffect(() => { save(LOOPS_KEY, loops); }, [loops]);
  useEffect(() => { save(TIMINGS_KEY, timings); }, [timings]);
  useEffect(() => { save(SCROLL_SPEEDS_KEY, scrollSpeeds); }, [scrollSpeeds]);

  // Pull per-song timing data from the cloud the first time a song is opened locally
  useEffect(() => {
    if (!song) return;
    if (timings[song.id]?.length) return;
    loadTimingData(song.id).then((remote) => {
      if (remote.length > 0) {
        setTimings((prev) => ({ ...prev, [song.id]: remote }));
      }
    });
  }, [song?.id]);

  // Database sync functionality
  const syncToDatabase = useCallback(async () => {
    try {
      console.log('Starting database sync...');
      const result = await saveToDatabase({
        annotations,
        notes,
        youtubeLinks,
        loops,
        customLyrics: editedLyrics,
        timings,
        scrollSpeeds
      });

      if (result.success) {
        console.log('✅ Successfully synced to database');
      } else {
        console.error('❌ Database sync failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Database sync error:', error);
    }
  }, [annotations, notes, youtubeLinks, loops, editedLyrics, timings, scrollSpeeds]);

  // Auto-sync to database when annotations change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (annotations.length > 0) {
        console.log('Auto-syncing annotations to database:', annotations.length, 'annotations');
        syncToDatabase();
      }
    }, 2000); // Sync 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [annotations, syncToDatabase]);

  // Load data from database on component mount, merging with whatever is
  // already local rather than only pulling when local storage is empty —
  // otherwise a device that already has any of its own data would never see
  // annotations/loops/notes added by another band member on a different device.
  useEffect(() => {
    const loadFromCloud = async () => {
      try {
        console.log('Loading data from database...');
        const result = await loadFromDatabase();
        if (result.success && result.data) {
          const cloud = result.data;
          console.log('Database data loaded:', {
            annotations: cloud.annotations.length,
            notes: Object.keys(cloud.notes).length,
            youtubeLinks: Object.keys(cloud.youtubeLinks).length,
            customLyrics: Object.keys(cloud.customLyrics).length
          });

          setAnnotations((prev) => mergeAnnotations(prev, cloud.annotations));
          setNotes((prev) => mergeRecord(prev, cloud.notes));
          setYoutubeLinks((prev) => mergeRecord(prev, cloud.youtubeLinks));
          setEditedLyrics((prev) => mergeRecord(prev, cloud.customLyrics));
          setLoops((prev) => mergeById(prev, cloud.loops as LoopRegion[]));
          setScrollSpeeds((prev) => mergeRecord(prev, cloud.scrollSpeeds || {}));
        } else {
          console.log('No database data found or load failed:', result.error);
        }
      } catch (error) {
        console.error('Failed to load from database:', error);
      }
    };

    loadFromCloud();
  }, []); // Only run on mount

  // Mouse selection handler for vocalist annotations
  const handleMouseUp = useCallback(() => {
    if (!song || editMode) return; // Don't handle selection in edit mode
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    try {
      const range = selection.getRangeAt(0);
      const container = lyricsRef.current;
      if (!container || !container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

      // Find the line elements that contain the selection
      let startLineElement = range.startContainer.nodeType === Node.TEXT_NODE 
        ? range.startContainer.parentElement 
        : range.startContainer as Element;
      let endLineElement = range.endContainer.nodeType === Node.TEXT_NODE 
        ? range.endContainer.parentElement 
        : range.endContainer as Element;

      // Traverse up to find the data-line-index elements
      while (startLineElement && !startLineElement.hasAttribute('data-line-index')) {
        startLineElement = startLineElement.parentElement;
      }
      while (endLineElement && !endLineElement.hasAttribute('data-line-index')) {
        endLineElement = endLineElement.parentElement;
      }

      if (!startLineElement || !endLineElement) {
        console.log('Could not find line elements');
        return;
      }

      const startLineIdx = parseInt(startLineElement.getAttribute("data-line-index") || "-1");
      const endLineIdx = parseInt(endLineElement.getAttribute("data-line-index") || "-1");
      
      if (startLineIdx < 0 || endLineIdx < 0) {
        console.log('Invalid line indices:', startLineIdx, endLineIdx);
        return;
      }

      console.log('Selection detected:', { startLineIdx, endLineIdx, activeVocalist, eraserMode });

      // Helper to get offsets for a line
      const getOffsets = (li: number, isStart: boolean, isEnd: boolean) => {
        const lineEl = container.querySelector(`[data-line-index="${li}"]`);
        if (!lineEl) return null;
        const lineText = lineEl.textContent || "";
        let startOffset = 0;
        let endOffset = lineText.length;
        
        if (isStart) {
          try {
            const preRange = document.createRange();
            preRange.selectNodeContents(lineEl);
            preRange.setEnd(range.startContainer, range.startOffset);
            startOffset = preRange.toString().length;
          } catch (e) {
            console.warn('Error calculating start offset:', e);
          }
        }
        if (isEnd) {
          try {
            const preRange = document.createRange();
            preRange.selectNodeContents(lineEl);
            preRange.setEnd(range.endContainer, range.endOffset);
            endOffset = preRange.toString().length;
          } catch (e) {
            console.warn('Error calculating end offset:', e);
          }
        }
        
        console.log(`Line ${li} offsets: start=${startOffset}, end=${endOffset}, text="${lineText.slice(startOffset, endOffset)}"`);
        return startOffset < endOffset ? { lineIndex: li, startOffset, endOffset } : null;
      };

      if (loopMode) {
        const selectedText = selection.toString().slice(0, 60);
        setPendingLoop({ lineStart: startLineIdx, lineEnd: endLineIdx, label: selectedText });
        selection.removeAllRanges();
        return;
      }

      if (eraserMode) {
        console.log('Eraser mode: removing annotations');
        setAnnotations((prev) => {
          let updated = [...prev];
          
          // Remove all existing annotations in the selected range (all vocalists)
          for (let li = startLineIdx; li <= endLineIdx; li++) {
            const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
            if (offsets) {
              console.log('Removing annotations for line', li, offsets);
              updated = removeAllOverlap(updated, song.id, offsets.lineIndex, offsets.startOffset, offsets.endOffset);
            }
          }
          
          console.log('Updated annotations after eraser:', updated.length);
          return updated;
        });
        selection.removeAllRanges();
        return;
      }

      if (activeVocalist) {
        console.log('Adding vocalist annotations for:', activeVocalist);
        const newAnnotations: TextAnnotation[] = [];
        
        for (let li = startLineIdx; li <= endLineIdx; li++) {
          const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
          if (offsets) {
            console.log('Adding annotation for line', li, offsets);
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
          console.log('Adding new annotations:', newAnnotations);
          setAnnotations((prev) => {
            let updated = [...prev];
            for (const newAnn of newAnnotations) {
              // Only remove same-vocalist overlaps — other vocalists stay!
              updated = removeSameVocalistOverlap(updated, newAnn);
              updated.push(newAnn);
            }
            console.log('Total annotations after adding:', updated.length);
            return updated;
          });
        }
        selection.removeAllRanges();
      }
    } catch (error) {
      console.error('Error in handleMouseUp:', error);
    }
  }, [song, activeVocalist, eraserMode, loopMode]);

  // Toggle functions
  const togglePerformanceMode = useCallback(() => {
    const newMode = !performanceMode;
    setPerformanceMode(newMode);
    onPerformanceModeChange?.(newMode);
  }, [performanceMode, onPerformanceModeChange]);

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setIsAutoScrolling(false);
  }, []);

  const startAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current || !song) return;
    setIsAutoScrolling(true);
    const speed = scrollSpeeds[song.id] || 20; // 1-100, default a gentle pace
    const intervalMs = Math.max(10, 110 - speed);
    scrollIntervalRef.current = window.setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        stopAutoScroll();
        return;
      }
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        stopAutoScroll();
        return;
      }
      container.scrollTop += 1;
    }, intervalMs);
  }, [song, scrollSpeeds, stopAutoScroll]);

  const getCurrentScrollSpeed = useCallback(() => {
    return song ? (scrollSpeeds[song.id] || 20) : 20;
  }, [song, scrollSpeeds]);

  const setCurrentScrollSpeed = useCallback((speed: number) => {
    if (!song) return;
    setScrollSpeeds(prev => ({ ...prev, [song.id]: speed }));
  }, [song]);

  const toggleAutoScrollMode = useCallback(() => {
    const newMode = !autoScrollMode;
    setAutoScrollMode(newMode);
    onAutoScrollModeChange?.(newMode);
    stopAutoScroll();
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [autoScrollMode, onAutoScrollModeChange, stopAutoScroll]);

  // Stop scrolling and reset position whenever the song changes, and on unmount
  useEffect(() => {
    stopAutoScroll();
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    return () => stopAutoScroll();
  }, [song?.id]);

  const toggleNotes = useCallback(() => {
    setShowNotes(prev => !prev);
  }, []);

  const toggleVocalistMode = useCallback(() => {
    // Toggle between no vocalist and first vocalist (elektra)
    setActiveVocalist(prev => prev === null ? "elektra" : null);
    setEraserMode(false);
    setLoopMode(false);
    setPendingLoop(null);
  }, []);

  const toggleYouTube = useCallback(() => {
    setShowYouTube(prev => !prev);
  }, []);

  const toggleLoopMode = useCallback(() => {
    setActiveVocalist(null);
    setEraserMode(false);
    setPendingLoop(null);
    setLoopMode(prev => {
      const next = !prev;
      if (next) setShowYouTube(true);
      return next;
    });
  }, []);

  const toggleAudioSync = useCallback(() => {
    setShowAudioSync(prev => !prev);
  }, []);

  const toggleBackup = useCallback(() => {
    setShowBackup(prev => !prev);
  }, []);

  const getBackupData = useCallback((): DatabaseData => ({
    annotations,
    notes,
    youtubeLinks,
    loops,
    customLyrics: editedLyrics,
    timings,
    scrollSpeeds,
  }), [annotations, notes, youtubeLinks, loops, editedLyrics, timings, scrollSpeeds]);

  const handleRestoreFromBackup = useCallback((data: DatabaseData) => {
    setAnnotations(data.annotations);
    setNotes(data.notes);
    setYoutubeLinks(data.youtubeLinks);
    setLoops(data.loops as LoopRegion[]);
    setScrollSpeeds(data.scrollSpeeds || {});
    setEditedLyrics(data.customLyrics);
    setTimings(data.timings);
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

  const togglePaginationMode = useCallback(() => {
    setPaginationMode(prev => !prev);
    setCurrentPage(0); // Reset to first page when toggling
  }, []);

  // Pagination helper functions
  const LINES_PER_PAGE = 15; // Increased from 12 to 15 lines per page
  
  const getCurrentLyrics = () => {
    if (!song) return '';
    return editedLyrics[song.id] || song.lyrics;
  };

  const getLyricsLines = () => {
    return getCurrentLyrics().split('\n');
  };

  const getTotalPages = () => {
    if (!paginationMode) return 1;
    const lines = getLyricsLines();
    // Count only non-blank lines for pagination
    const nonBlankCount = lines.filter(line => line.trim() !== "").length;
    return Math.max(1, Math.ceil(nonBlankCount / LINES_PER_PAGE));
  };

  const getCurrentPageLines = () => {
    if (!paginationMode) return getLyricsLines();
    const lines = getLyricsLines();
    
    // Filter out blank lines for pagination counting, but keep track of their positions
    const nonBlankLines: { line: string; originalIndex: number }[] = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed !== "") {
        nonBlankLines.push({ line, originalIndex: index });
      }
    });
    
    const startIndex = currentPage * LINES_PER_PAGE;
    const endIndex = startIndex + LINES_PER_PAGE;
    const pageNonBlankLines = nonBlankLines.slice(startIndex, endIndex);
    
    // Reconstruct the page with original blank lines in their positions
    const result: string[] = [];
    let lastOriginalIndex = -1;
    
    for (const { line, originalIndex } of pageNonBlankLines) {
      // Add any blank lines that were between the last line and this one
      for (let i = lastOriginalIndex + 1; i < originalIndex; i++) {
        if (lines[i].trim() === "") {
          result.push(lines[i]);
        }
      }
      result.push(line);
      lastOriginalIndex = originalIndex;
    }
    
    return result;
  };

  const handleLyricsEdit = (newLyrics: string) => {
    if (!song) return;
    setEditedLyrics(prev => ({
      ...prev,
      [song.id]: newLyrics
    }));
  };

  const resetLyrics = () => {
    if (!song) return;
    setEditedLyrics(prev => {
      const updated = { ...prev };
      delete updated[song.id];
      return updated;
    });
  };

  const startEditingLine = (lineIndex: number, currentText: string) => {
    if (!editMode) return;
    setEditingLineIndex(lineIndex);
    setEditingText(currentText);
  };

  const saveLineEdit = () => {
    if (!song || editingLineIndex === null) return;
    
    const lines = getCurrentLyrics().split('\n');
    const actualLineIndex = paginationMode ? (currentPage * LINES_PER_PAGE) + editingLineIndex : editingLineIndex;
    
    if (actualLineIndex >= 0 && actualLineIndex < lines.length) {
      const originalLine = lines[actualLineIndex];
      const editedLines = editingText.split('\n');
      
      // Check if we're splitting lines and if there are vocalist annotations
      const hasAnnotationsOnLine = annotations.some(ann => 
        ann.songId === song.id && ann.lineIndex === actualLineIndex
      );
      
      if (editedLines.length > 1 && hasAnnotationsOnLine) {
        // Warn user about potential annotation loss
        const confirmSplit = window.confirm(
          "This line has vocalist markings. Splitting it into multiple lines will remove the markings to avoid conflicts. Continue?"
        );
        
        if (!confirmSplit) {
          // User cancelled, don't save
          setEditingLineIndex(null);
          setEditingText('');
          return;
        }
        
        // Remove annotations for this line since we're splitting it
        setAnnotations(prev => prev.filter(ann => 
          !(ann.songId === song.id && ann.lineIndex === actualLineIndex)
        ));
      }
      
      // Update line indices for annotations after this line
      if (editedLines.length !== 1) {
        const lineDifference = editedLines.length - 1; // How many lines we're adding/removing
        
        setAnnotations(prev => prev.map(ann => {
          if (ann.songId === song.id && ann.lineIndex > actualLineIndex) {
            return {
              ...ann,
              lineIndex: ann.lineIndex + lineDifference
            };
          }
          return ann;
        }));
      }
      
      // Update the lyrics
      lines.splice(actualLineIndex, 1, ...editedLines);
      handleLyricsEdit(lines.join('\n'));
    }
    
    setEditingLineIndex(null);
    setEditingText('');
  };

  const cancelLineEdit = () => {
    setEditingLineIndex(null);
    setEditingText('');
  };

  const handleLineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Regular Enter saves the edit
      e.preventDefault();
      saveLineEdit();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter adds a line break within the text
      // This is handled naturally by the textarea
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelLineEdit();
    }
  };

  // Vocalist toggle functions
  const toggleVocalist = (v: VocalistOrNull) => {
    setEraserMode(false);
    setLoopMode(false);
    setPendingLoop(null);
    setActiveVocalist((prev) => (prev === v ? null : v));
  };

  const toggleEraserMode = () => {
    setActiveVocalist(null);
    setLoopMode(false);
    setPendingLoop(null);
    setEraserMode((prev) => !prev);
  };

  // Auto-mark vocalist annotations from "(Name+Name)" cues already present in the raw lyrics
  const handleAutoMarkFromCues = () => {
    if (!song) return;
    const lines = getCurrentLyrics().split('\n');
    let activeCue: Vocalist[] | null = null;
    let taggedLines = 0;
    let skippedLines = 0;

    setAnnotations((prev) => {
      let updated = [...prev];
      lines.forEach((line, lineIndex) => {
        const trimmed = line.trim();
        if (trimmed === "") return;

        const cue = parseVocalistCue(trimmed);
        if (cue) {
          activeCue = cue;
          return; // cue line itself is a stage direction, not sung text
        }
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) return; // section header
        if (!activeCue) return;

        const alreadyAnnotated = updated.some((a) => a.songId === song.id && a.lineIndex === lineIndex);
        if (alreadyAnnotated) {
          skippedLines++;
          return;
        }

        for (const vocalist of activeCue) {
          const newAnnotation: TextAnnotation = {
            songId: song.id,
            lineIndex,
            startOffset: 0,
            endOffset: trimmed.length,
            vocalist,
          };
          updated = removeSameVocalistOverlap(updated, newAnnotation);
          updated.push(newAnnotation);
        }
        taggedLines++;
      });
      return updated;
    });

    if (taggedLines === 0) {
      toast.info(skippedLines > 0
        ? `No new lines to mark — ${skippedLines} already annotated.`
        : "No vocalist cues found in this song's lyrics.");
    } else {
      toast.success(`Marked ${taggedLines} line${taggedLines === 1 ? '' : 's'} from lyric cues${skippedLines > 0 ? ` (${skippedLines} already annotated, left untouched)` : ''}.`);
    }
  };

  // Loop CRUD handlers
  const handleSaveLoop = () => {
    if (!song || !pendingLoop) return;
    const newLoop: LoopRegion = {
      id: Date.now().toString(),
      songId: song.id,
      label: loopLabelInput || pendingLoop.label || "Loop",
      startTime: parseTime(loopStartInput),
      endTime: parseTime(loopEndInput),
      lineStart: pendingLoop.lineStart,
      lineEnd: pendingLoop.lineEnd,
    };
    setLoops((prev) => [...prev, newLoop]);
    setActiveLoop(newLoop);
    setPendingLoop(null);
    setLoopMode(false);
    setLoopLabelInput("");
  };

  const handleCancelPendingLoop = () => {
    setPendingLoop(null);
    setLoopLabelInput("");
  };

  const handleStartEditLoop = (loop: LoopRegion) => {
    setEditingLoop(loop);
    setLoopStartInput(formatTime(loop.startTime));
    setLoopEndInput(formatTime(loop.endTime));
    setLoopLabelInput(loop.label);
    setPendingLoop(null);
  };

  const handleSaveEditLoop = () => {
    if (!editingLoop) return;
    const updated: LoopRegion = {
      ...editingLoop,
      label: loopLabelInput || editingLoop.label,
      startTime: parseTime(loopStartInput),
      endTime: parseTime(loopEndInput),
    };
    setLoops((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (activeLoop?.id === updated.id) setActiveLoop(updated);
    setEditingLoop(null);
    setLoopLabelInput("");
  };

  const handleCancelEditLoop = () => {
    setEditingLoop(null);
    setLoopLabelInput("");
  };

  const handleDeleteLoop = (id: string) => {
    setLoops((prev) => prev.filter((l) => l.id !== id));
    if (activeLoop?.id === id) setActiveLoop(null);
    if (editingLoop?.id === id) setEditingLoop(null);
  };

  const songLoops = song ? loops.filter((l) => l.songId === song.id) : [];

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
        toggleBackup,
        toggleEditMode,
        togglePaginationMode
      });
    }
  }, [onGetToggleFunctions, togglePerformanceMode, toggleAutoScrollMode, toggleNotes, toggleVocalistMode, toggleYouTube, toggleLoopMode, toggleAudioSync, toggleBackup, toggleEditMode, togglePaginationMode]);

  // Notify parent of state changes
  useEffect(() => {
    onAutoScrollingChange?.(isAutoScrolling);
  }, [isAutoScrolling, onAutoScrollingChange]);

  // Keyboard navigation for song changes and pagination
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys if no input/textarea is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      if (isInputFocused) return;
      
      // Debug logging for MIDI controller
      console.log('Key pressed:', event.key, 'Pagination mode:', paginationMode, 'Current page:', currentPage, 'Total pages:', getTotalPages());
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        event.stopPropagation();
        console.log('Left arrow - changing to previous song');
        onSongChange?.('prev');
        setCurrentPage(0); // Reset to first page when changing songs
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        console.log('Right arrow - changing to next song');
        onSongChange?.('next');
        setCurrentPage(0); // Reset to first page when changing songs
      } else if (event.key === 'ArrowUp' && paginationMode) {
        event.preventDefault();
        event.stopPropagation();
        const newPage = Math.max(0, currentPage - 1);
        console.log('Up arrow - changing page from', currentPage, 'to', newPage);
        setCurrentPage(newPage);
      } else if (event.key === 'ArrowDown' && paginationMode) {
        event.preventDefault();
        event.stopPropagation();
        const totalPages = getTotalPages();
        const newPage = Math.min(totalPages - 1, currentPage + 1);
        console.log('Down arrow - changing page from', currentPage, 'to', newPage, 'total pages:', totalPages);
        setCurrentPage(newPage);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onSongChange, paginationMode, currentPage, getTotalPages]);

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
    // Performance mode - full screen lyrics with annotations and pagination
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white relative">
        <div className="w-full max-w-6xl text-center p-8">
          <div className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
            {(() => {
              const lines = getCurrentPageLines();
              return lines.map((line, index) => {
                const actualLineIndex = paginationMode ? (currentPage * LINES_PER_PAGE) + index : index;
                const trimmed = line.trim();
                const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
                const isEmpty = trimmed === "";
                const cue = parseVocalistCue(trimmed);

                if (isEmpty) return <div key={actualLineIndex} className="h-4" />; // Reduced spacing in performance mode

                if (isSection) {
                  return (
                    <div key={actualLineIndex} className="text-center my-6"> {/* Reduced from my-12 to my-6 */}
                      <span className="text-blue-400 text-base md:text-lg uppercase tracking-wider font-medium"> {/* Reduced from text-lg md:text-xl */}
                        {trimmed.slice(1, -1)}
                      </span>
                    </div>
                  );
                }

                if (cue) {
                  return (
                    <div key={actualLineIndex} className="text-center my-3 flex justify-center gap-2">
                      {cue.map((v) => (
                        <span
                          key={v}
                          className="text-xs uppercase tracking-wider font-mono px-2 py-0.5 rounded-sm"
                          style={{ color: VOCALIST_COLORS[v].css, border: `1px solid ${VOCALIST_COLORS[v].css}60` }}
                        >
                          {VOCALIST_LABELS[v]} {v}
                        </span>
                      ))}
                    </div>
                  );
                }

                const segments = getLineSegments(trimmed, annotations, song.id, actualLineIndex);
                return (
                  <div key={actualLineIndex} className="text-center mb-6">
                    <div className="text-xl md:text-2xl lg:text-3xl font-normal text-white leading-relaxed">
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
        
        {/* Performance mode controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {paginationMode && (
            <div className="bg-black/70 text-green-300 px-3 py-2 rounded text-sm font-mono flex items-center gap-3">
              <span>Page {currentPage + 1}/{getTotalPages()}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                  className="px-2 py-1 text-xs border border-green-500/30 text-green-300 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(getTotalPages() - 1, prev + 1))}
                  disabled={currentPage === getTotalPages() - 1}
                  className="px-2 py-1 text-xs border border-green-500/30 text-green-300 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          )}
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
      {/* Header - Compact when sidebar is collapsed */}
      <div className={`border-b border-border flex items-end justify-between shrink-0 flex-wrap gap-2 transition-all duration-300 ${
        sidebarCollapsed ? 'p-3' : 'p-6'
      }`}>
        <div>
          <span className={`font-mono text-xs text-muted-foreground ${sidebarCollapsed ? 'hidden' : ''}`}>
            TRACK {String(songIndex + 1).padStart(2, "0")}
          </span>
          <h1 className={`font-display tracking-wide text-foreground leading-none transition-all duration-300 ${
            sidebarCollapsed 
              ? 'text-2xl md:text-3xl mt-0' 
              : 'text-5xl md:text-7xl mt-1'
          }`}>
            {song.title.toUpperCase()}
          </h1>
        </div>
        
        <div className={`flex gap-2 flex-wrap ${sidebarCollapsed ? 'hidden' : ''}`}>
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
            onClick={toggleEditMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              editMode
                ? "border-blue-500 text-blue-500 bg-blue-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            ✏️ EDIT
          </button>

          <button
            onClick={togglePaginationMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              paginationMode
                ? "border-green-500 text-green-500 bg-green-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            📄 PAGINATION
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
            const isActive = activeVocalist === v;
            return (
              <button
                key={v}
                onClick={() => toggleVocalist(v)}
                className="px-3 py-1 font-mono text-xs border transition-none flex items-center gap-2"
                style={{
                  borderColor: isActive ? colors.css : '#374151',
                  color: isActive ? colors.css : '#9ca3af',
                  backgroundColor: isActive ? `${colors.css}20` : `${colors.css}08`,
                  borderLeft: `4px solid ${colors.css}`,
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
            onClick={handleAutoMarkFromCues}
            className="px-3 py-1 font-mono text-xs border border-border text-muted-foreground hover:text-accent transition-none"
            title="Auto-mark vocalists from (Name+Name) cues already in the lyrics"
          >
            🎯 AUTO-MARK
          </button>

          <button
            onClick={async () => {
              console.log('Manual sync triggered');
              await syncToDatabase();
            }}
            className="px-3 py-1 font-mono text-xs border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-none"
            title="Sync to cloud database"
          >
            ☁️ SYNC
          </button>

          {import.meta.env.DEV && (
            <>
              <button
                onClick={() => {
                  // Debug: Clear all annotations
                  setAnnotations([]);
                  console.log('All annotations cleared');
                }}
                className="px-3 py-1 font-mono text-xs border border-red-500 text-red-500 hover:bg-red-500/10 transition-none"
                title="Clear all annotations (debug)"
              >
                🗑️ CLEAR ALL ({annotations.length})
              </button>

              <button
                onClick={() => {
                  // Debug: Show current annotations for this song
                  const songAnnotations = annotations.filter(a => a.songId === song.id);
                  console.log('Current annotations for song:', songAnnotations);
                  songAnnotations.forEach((ann, i) => {
                    const lineText = getCurrentLyrics().split('\n')[ann.lineIndex] || '';
                    const selectedText = lineText.slice(ann.startOffset, ann.endOffset);
                    console.log(`${i + 1}. Line ${ann.lineIndex}: "${selectedText}" (${ann.startOffset}-${ann.endOffset}) → ${ann.vocalist}`);
                  });
                }}
                className="px-3 py-1 font-mono text-xs border border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 transition-none"
                title="Debug annotations"
              >
                🐛 DEBUG
              </button>

              <button
                onClick={async () => {
                  console.log('Testing database connection...');
                  try {
                    const response = await fetch('/api/database/test');
                    const result = await response.json();
                    console.log('Database test result:', result);
                    alert(`Database test: ${result.success ? 'SUCCESS' : 'FAILED'}\n${result.message}`);
                  } catch (error) {
                    console.error('Database test error:', error);
                    alert(`Database test FAILED: ${error}`);
                  }
                }}
                className="px-3 py-1 font-mono text-xs border border-purple-500 text-purple-500 hover:bg-purple-500/10 transition-none"
                title="Test database connection"
              >
                🔌 TEST DB
              </button>

              <button
                onClick={async () => {
                  console.log('Initializing database...');
                  try {
                    const response = await fetch('/api/database/init');
                    const result = await response.json();
                    console.log('Database init result:', result);
                    alert(`Database init: ${result.success ? 'SUCCESS' : 'FAILED'}\n${result.message}`);
                  } catch (error) {
                    console.error('Database init error:', error);
                    alert(`Database init FAILED: ${error}`);
                  }
                }}
                className="px-3 py-1 font-mono text-xs border border-green-500 text-green-500 hover:bg-green-500/10 transition-none"
                title="Initialize database schema"
              >
                🏗️ INIT DB
              </button>
            </>
          )}

          {/* Multi-vocalist example */}
          {(activeVocalist || eraserMode) && (
            <div className="px-3 py-1 font-mono text-xs border border-muted-foreground/30 text-muted-foreground">
              Example: <span className="px-1 rounded-sm" style={{backgroundColor: '#06b6d420', color: '#06b6d4', border: '1px solid #06b6d440'}}>LADY part</span> <span className="px-1 rounded-sm" style={{backgroundColor: '#eab30820', color: '#eab308', border: '1px solid #eab30840'}}>HUDS part</span> <span className="px-1 rounded-sm" style={{background: 'linear-gradient(90deg, #06b6d4, #eab308)', color: 'white'}}>both sing</span>
            </div>
          )}
          
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
            onClick={toggleLoopMode}
            className={`px-3 py-1 font-mono text-xs border transition-none ${
              loopMode
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            🔁 LOOPS
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
      {(activeVocalist || eraserMode) && (
        <div 
          className="px-6 py-2 text-xs font-mono border-b border-border"
          style={{
            color: eraserMode 
              ? '#ef4444'
              : activeVocalist === "all" 
                ? '#3b82f6'
                : activeVocalist ? VOCALIST_COLORS[activeVocalist as Vocalist].css : '#3b82f6',
            backgroundColor: eraserMode 
              ? '#ef444420'
              : activeVocalist === "all" 
                ? '#3b82f620'
                : activeVocalist ? `${VOCALIST_COLORS[activeVocalist as Vocalist].css}20` : '#3b82f620'
          }}
        >
          {eraserMode ? (
            <>🗑️ Select any text to remove vocalist markings from that exact selection only. Current annotations: {annotations.filter(a => a.songId === song.id).length}</>
          ) : (
            <>✎ Select any text to mark ONLY that selection as{" "}
            {activeVocalist === "all" 
              ? "ALL VOCALISTS" 
              : activeVocalist === "elektra" ? "LADY 🎤 (Lead Singer)" 
              : activeVocalist === "chinoda" ? "HUDS 🎙️ (Rap/Co-Lead)" 
              : "LUAN 🎶 (Harmonics)"}.
            {" "}Each selection is independent. Current annotations: {annotations.filter(a => a.songId === song.id).length}</>
          )}
        </div>
      )}

      {/* Auto-scroll control panel */}
      {autoScrollMode && !performanceMode && (
        <div className="border-b border-orange-500 bg-orange-500/10 px-6 py-3 flex items-center gap-4 flex-wrap">
          <button
            onClick={isAutoScrolling ? stopAutoScroll : startAutoScroll}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              isAutoScrolling
                ? "border-red-500 text-red-500 hover:bg-red-500/10"
                : "border-green-500 text-green-500 hover:bg-green-500/10"
            }`}
          >
            {isAutoScrolling ? "⏸️ PAUSE" : "▶️ START"}
          </button>
          <button
            onClick={() => {
              stopAutoScroll();
              if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
            }}
            className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
          >
            ⏮️ RESET
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono-ui text-xs text-muted-foreground">SLOW</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={getCurrentScrollSpeed()}
              onChange={(e) => setCurrentScrollSpeed(Number(e.target.value))}
              className="w-32 accent-orange-500"
            />
            <span className="font-mono-ui text-xs text-muted-foreground">FAST</span>
            <span className="font-mono-ui text-xs text-orange-500 ml-1">{getCurrentScrollSpeed()}</span>
          </div>
          <span className="text-xs text-muted-foreground">Speed is saved per song</span>
        </div>
      )}

      {/* Loop mode instruction banner */}
      {loopMode && !pendingLoop && (
        <div className="px-6 py-2 text-xs font-mono border-b border-border text-primary bg-primary/10">
          🔁 Select the lyric lines you want to loop. A dialog will appear to set the start/end timestamps.
        </div>
      )}

      {/* Pending loop dialog */}
      {pendingLoop && (
        <div className="px-6 py-3 border-b border-primary bg-primary/10 flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-primary">
            🔁 New loop — lines {pendingLoop.lineStart + 1}–{pendingLoop.lineEnd + 1}
          </span>
          <input
            type="text"
            value={loopLabelInput}
            onChange={(e) => setLoopLabelInput(e.target.value)}
            placeholder={pendingLoop.label || "Label"}
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-40"
          />
          <input
            type="text"
            value={loopStartInput}
            onChange={(e) => setLoopStartInput(e.target.value)}
            placeholder="0:00"
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-16"
          />
          <span className="text-xs font-mono text-muted-foreground">→</span>
          <input
            type="text"
            value={loopEndInput}
            onChange={(e) => setLoopEndInput(e.target.value)}
            placeholder="0:30"
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-16"
          />
          <button
            onClick={handleSaveLoop}
            className="px-3 py-1 font-mono text-xs border border-primary text-primary hover:bg-primary/20"
          >
            SAVE
          </button>
          <button
            onClick={handleCancelPendingLoop}
            className="px-3 py-1 font-mono text-xs border border-border text-muted-foreground hover:text-accent"
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Editing loop dialog */}
      {editingLoop && (
        <div className="px-6 py-3 border-b border-primary bg-primary/10 flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-primary">✏️ Edit loop</span>
          <input
            type="text"
            value={loopLabelInput}
            onChange={(e) => setLoopLabelInput(e.target.value)}
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-40"
          />
          <input
            type="text"
            value={loopStartInput}
            onChange={(e) => setLoopStartInput(e.target.value)}
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-16"
          />
          <span className="text-xs font-mono text-muted-foreground">→</span>
          <input
            type="text"
            value={loopEndInput}
            onChange={(e) => setLoopEndInput(e.target.value)}
            className="bg-transparent border border-primary/30 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary w-16"
          />
          <button
            onClick={handleSaveEditLoop}
            className="px-3 py-1 font-mono text-xs border border-primary text-primary hover:bg-primary/20"
          >
            SAVE
          </button>
          <button
            onClick={handleCancelEditLoop}
            className="px-3 py-1 font-mono text-xs border border-border text-muted-foreground hover:text-accent"
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Pagination status */}
      {paginationMode && (
        <div className="px-6 py-2 text-xs font-mono border-b border-green-500 bg-green-500/10 text-green-400 flex justify-between items-center">
          <span>📄 PAGINATION MODE - Use ↑↓ arrows to navigate pages</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 font-mono text-xs border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="font-mono text-sm">Page {currentPage + 1} of {getTotalPages()}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(getTotalPages() - 1, prev + 1))}
              disabled={currentPage === getTotalPages() - 1}
              className="px-3 py-1 font-mono text-xs border border-green-500/30 text-green-400 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Edit mode interface - simplified */}
      {editMode && (
        <div className="border-b border-blue-500 bg-blue-500/10 p-4">
          <div className="text-sm text-blue-400 mb-2 flex justify-between items-center">
            <span>✏️ Edit Mode Active - Click on lyrics below to edit directly</span>
            <div className="flex gap-2">
              <button
                onClick={resetLyrics}
                className="px-2 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Reset to Original
              </button>
            </div>
          </div>
          <div className="text-xs text-blue-400/70">
            Tip: Click any line to edit it. Use Shift+Enter for line breaks within the editor. Press Enter to save, Escape to cancel. 
            <br />
            <span className="text-yellow-400">⚠️ Warning: Splitting lines with vocalist markings will remove the markings to avoid conflicts.</span>
          </div>
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

      {/* Audio sync panel */}
      {showAudioSync && (
        <div className="px-4 py-3 border-b border-border bg-background">
          <AudioSync
            key={song.id}
            songId={song.id}
            songTitle={song.title}
            lyrics={getCurrentLyrics()}
            initialTimings={timings[song.id] || []}
            onTimingUpdate={(newTimings) => setTimings(prev => ({ ...prev, [song.id]: newTimings }))}
            onCurrentLineChange={setAudioActiveLine}
            currentLineIndex={audioActiveLine ?? -1}
          />
        </div>
      )}

      {/* Cloud backup panel */}
      {showBackup && (
        <div className="px-4 py-3 border-b border-border bg-background">
          <CloudBackup onRestore={handleRestoreFromBackup} getCurrentData={getBackupData} />
        </div>
      )}

      {/* YouTube panel */}
      {showYouTube && (
        <>
          <YouTubePlayer
            youtubeUrl={currentYouTube}
            onUrlChange={(url) => setYoutubeLinks(prev => ({ ...prev, [song.id]: url }))}
            songTitle={song.title}
            activeLoop={activeLoop}
            onClearLoop={() => setActiveLoop(null)}
          />
          {songLoops.length > 0 && (
            <div className="border-b border-border bg-surface px-4 py-2 flex flex-wrap items-center gap-2">
              <span className="font-mono-ui text-xs text-muted-foreground shrink-0">SAVED LOOPS</span>
              {songLoops.map((loop) => (
                <div
                  key={loop.id}
                  className={`flex items-center gap-1 border rounded px-2 py-1 text-xs font-mono ${
                    activeLoop?.id === loop.id
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <button
                    onClick={() =>
                      activeLoop?.id === loop.id ? setActiveLoop(null) : setActiveLoop(loop)
                    }
                    title={loop.label}
                  >
                    {loop.label.slice(0, 20)} · {formatTime(loop.startTime)}–{formatTime(loop.endTime)}
                  </button>
                  <button
                    onClick={() => handleStartEditLoop(loop)}
                    className="text-muted-foreground hover:text-accent"
                    title="Edit loop"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteLoop(loop.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete loop"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lyrics */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div className="p-6 md:px-10 md:py-8">
          <div className={`${sidebarCollapsed ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`} ref={lyricsRef} onMouseUp={handleMouseUp}>
            {getCurrentPageLines().map((line, i) => {
              const actualLineIndex = paginationMode ? (currentPage * LINES_PER_PAGE) + i : i;
              const trimmed = line.trim();
              const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
              const isEmpty = trimmed === "";
              const isEditing = editingLineIndex === i;
              const cue = !isEditing ? parseVocalistCue(trimmed) : null;

              if (isEmpty) return <div key={actualLineIndex} className="h-3" />; // Reduced from h-6 to h-3 for less space

              if (cue) {
                return (
                  <div
                    key={actualLineIndex}
                    className={`my-3 flex gap-2 ${editMode ? 'cursor-pointer hover:bg-muted/20 rounded px-2 py-1' : ''}`}
                    onClick={() => editMode && startEditingLine(i, line)}
                  >
                    {cue.map((v) => (
                      <span
                        key={v}
                        className="text-xs uppercase tracking-wider font-mono px-2 py-0.5 rounded-sm"
                        style={{ color: VOCALIST_COLORS[v].css, border: `1px solid ${VOCALIST_COLORS[v].css}60` }}
                      >
                        {VOCALIST_LABELS[v]} {v}
                      </span>
                    ))}
                  </div>
                );
              }

              if (isSection) {
                if (isEditing) {
                  return (
                    <div key={actualLineIndex} className="text-center my-4"> {/* Reduced from my-8 to my-4 */}
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleLineKeyDown}
                        onBlur={saveLineEdit}
                        className="bg-blue-500/20 border border-blue-500 rounded px-2 py-1 text-blue-400 text-base md:text-lg uppercase tracking-wider font-medium text-center focus:outline-none focus:border-blue-400" // Reduced text size
                        autoFocus
                      />
                    </div>
                  );
                }
                return (
                  <div 
                    key={actualLineIndex} 
                    className={`text-center my-4 ${editMode ? 'cursor-pointer hover:bg-blue-500/10 rounded px-2 py-1 transition-colors' : ''}`} // Reduced from my-8 to my-4
                    onClick={() => editMode && startEditingLine(i, line)}
                  >
                    <span className="text-blue-400 text-base md:text-lg uppercase tracking-wider font-medium"> {/* Reduced from text-lg md:text-xl */}
                      {trimmed.slice(1, -1)}
                    </span>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <div key={actualLineIndex} className="mb-4">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={handleLineKeyDown}
                      onBlur={saveLineEdit}
                      className="w-full bg-blue-500/20 border border-blue-500 rounded p-2 text-xl md:text-2xl leading-relaxed font-mono text-foreground resize-none focus:outline-none focus:border-blue-400"
                      rows={Math.max(2, editingText.split('\n').length + 1)}
                      autoFocus
                      placeholder="Type lyrics here... Use Shift+Enter for line breaks, Enter to save"
                    />
                    <div className="text-xs text-blue-400/70 mt-1">
                      Shift+Enter: New line | Enter: Save | Escape: Cancel
                    </div>
                  </div>
                );
              }

              const segments = getLineSegments(trimmed, annotations, song.id, actualLineIndex);
              const inLoop = !!activeLoop && actualLineIndex >= activeLoop.lineStart && actualLineIndex <= activeLoop.lineEnd;
              const isAudioActive = showAudioSync && audioActiveLine === actualLineIndex;
              return (
                <div
                  key={actualLineIndex}
                  data-line-index={actualLineIndex}
                  className={`mb-4 text-xl md:text-2xl leading-relaxed font-mono transition-colors ${
                    editMode
                      ? 'cursor-pointer hover:bg-muted/20 rounded px-2 py-1'
                      : activeVocalist || eraserMode || loopMode
                        ? 'cursor-pointer hover:bg-muted/20'
                        : ''
                  } ${inLoop ? 'border-l-4 border-primary pl-4 bg-primary/5 rounded-r' : ''} ${
                    isAudioActive ? 'bg-blue-500/10 rounded' : ''
                  }`}
                  onClick={(e) => {
                    if (editMode) {
                      startEditingLine(i, line);
                    } else if (loopMode) {
                      setPendingLoop({ lineStart: actualLineIndex, lineEnd: actualLineIndex, label: trimmed.slice(0, 60) });
                    } else if (activeVocalist && !eraserMode) {
                      // Existing vocalist annotation logic
                      console.log('Line clicked:', actualLineIndex, trimmed);
                      const newAnnotation: TextAnnotation = {
                        songId: song.id,
                        lineIndex: actualLineIndex,
                        startOffset: 0,
                        endOffset: trimmed.length,
                        vocalist: activeVocalist === "all" ? "elektra" : activeVocalist as Vocalist
                      };
                      setAnnotations(prev => {
                        const updated = removeSameVocalistOverlap(prev, newAnnotation);
                        updated.push(newAnnotation);
                        console.log('Added annotation via click:', newAnnotation);
                        return updated;
                      });
                    }
                  }}
                >
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