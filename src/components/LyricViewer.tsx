import { useState, useCallback, useEffect, useRef } from "react";
import { Eraser, Pencil } from "lucide-react";
import type { Song } from "@/data/songs";
import YouTubePlayer, { formatTime, parseTime } from "./YouTubePlayer";
import type { LoopRegion } from "./YouTubePlayer";

type Vocalist = "elektra" | "chinoda" | "luan";
type VocalistOrAll = Vocalist | "all";
type VocalistOrNull = VocalistOrAll | null;

interface TextAnnotation {
  songId: string;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  vocalist: Vocalist;
}

interface LyricViewerProps {
  song: Song | null;
  songIndex: number;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  onSongChange?: (direction: 'prev' | 'next') => void;
  totalSongs?: number;
}

const STORAGE_KEY = "lp-setlist-annotations-v2";
const NOTES_KEY = "lp-setlist-notes";
const YOUTUBE_KEY = "lp-setlist-youtube";
const LOOPS_KEY = "lp-setlist-loops";
const LYRICS_KEY = "lp-setlist-custom-lyrics";

// Default annotations based on HTML voice divisions
// ⚫️ giulia (white in HTML) = elektra (Giulia), 🔴 hudson (red) = chinoda (Hudson), 🔵 everyone (blue) = all three
const DEFAULT_ANNOTATIONS: TextAnnotation[] = [
  // 1. SOMEWHERE I BELONG - Based on HTML markings
  { songId: "somewhere-i-belong", lineIndex: 2, startOffset: 1, endOffset: 16, vocalist: "elektra" }, // "(When this began)"
  { songId: "somewhere-i-belong", lineIndex: 2, startOffset: 17, endOffset: -1, vocalist: "chinoda" }, // Hudson part
  { songId: "somewhere-i-belong", lineIndex: 11, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "I wanna heal..."
  { songId: "somewhere-i-belong", lineIndex: 18, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Somewhere I belong" - everyone
  { songId: "somewhere-i-belong", lineIndex: 18, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "somewhere-i-belong", lineIndex: 18, startOffset: 0, endOffset: -1, vocalist: "luan" },

  // 2. THE EMPTINESS MACHINE - Based on HTML markings
  { songId: "the-emptiness-machine", lineIndex: 2, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // Hudson verses
  { songId: "the-emptiness-machine", lineIndex: 13, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // "Let you cut me open..."
  { songId: "the-emptiness-machine", lineIndex: 14, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Gave up who I am..."
  { songId: "the-emptiness-machine", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Fallin' for the promise..." - everyone
  { songId: "the-emptiness-machine", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "the-emptiness-machine", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "luan" },

  // 6. FAINT - Based on HTML markings  
  { songId: "faint", lineIndex: 2, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // Hudson verses
  { songId: "faint", lineIndex: 11, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "I can't feel..." - Giulia chorus
  { songId: "faint", lineIndex: 12, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Don't turn your back..."
  { songId: "faint", lineIndex: 25, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // "Hear me out now..." - Hudson
  { songId: "faint", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "I WON'T BE IGNORED!" - everyone
  { songId: "faint", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "faint", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "luan" },

  // 12. ONE STEP CLOSER - Based on HTML markings
  { songId: "one-step-closer", lineIndex: 2, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // Hudson verses
  { songId: "one-step-closer", lineIndex: 11, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "'Cause I am one step closer..." - Giulia
  { songId: "one-step-closer", lineIndex: 25, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // "SHUT UP..." - Hudson
  { songId: "one-step-closer", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "SHUT UP! SHUT UP!" - everyone
  { songId: "one-step-closer", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "one-step-closer", lineIndex: 26, startOffset: 0, endOffset: -1, vocalist: "luan" },

  // 23. HEAVY IS THE CROWN - Based on HTML markings
  { songId: "heavy-is-the-crown", lineIndex: 11, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "This is what you asked for..." - Giulia
  { songId: "heavy-is-the-crown", lineIndex: 15, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // "Today's gonna be the day..." - Hudson
  { songId: "heavy-is-the-crown", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "HEAVY IS THE CROWN!" - everyone
  { songId: "heavy-is-the-crown", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "heavy-is-the-crown", lineIndex: 16, startOffset: 0, endOffset: -1, vocalist: "luan" },

  // 28. FRIENDLY FIRE - Based on HTML markings
  { songId: "friendly-fire", lineIndex: 2, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Waiting for the fire..." - Giulia
  { songId: "friendly-fire", lineIndex: 5, startOffset: 0, endOffset: -1, vocalist: "chinoda" }, // "We're pulling a trigger..." - Hudson
  { songId: "friendly-fire", lineIndex: 8, startOffset: 0, endOffset: -1, vocalist: "elektra" }, // "Why are we fighting..." - everyone
  { songId: "friendly-fire", lineIndex: 8, startOffset: 0, endOffset: -1, vocalist: "chinoda" },
  { songId: "friendly-fire", lineIndex: 8, startOffset: 0, endOffset: -1, vocalist: "luan" },
];

// Function to merge default annotations with user annotations
const mergeAnnotations = (userAnnotations: TextAnnotation[]): TextAnnotation[] => {
  // Create a map of existing user annotations for quick lookup
  const userAnnotationMap = new Set(
    userAnnotations.map(ann => `${ann.songId}-${ann.lineIndex}-${ann.startOffset}-${ann.endOffset}-${ann.vocalist}`)
  );
  
  // Add default annotations that don't conflict with user annotations
  const mergedAnnotations = [...userAnnotations];
  
  for (const defaultAnn of DEFAULT_ANNOTATIONS) {
    const key = `${defaultAnn.songId}-${defaultAnn.lineIndex}-${defaultAnn.startOffset}-${defaultAnn.endOffset}-${defaultAnn.vocalist}`;
    if (!userAnnotationMap.has(key)) {
      mergedAnnotations.push(defaultAnn);
    }
  }
  
  console.log('Merged annotations:', mergedAnnotations.length, 'total annotations');
  console.log('Default annotations:', DEFAULT_ANNOTATIONS.length);
  console.log('User annotations:', userAnnotations.length);
  console.log('Sample merged annotations for debugging:', mergedAnnotations.slice(0, 5));
  
  return mergedAnnotations;
};

type InteractionMode = "vocalist" | "loop" | "eraser" | null;

const load = <T,>(key: string, fallback: T): T => {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key: string, data: unknown) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const VOCALIST_COLORS: Record<Vocalist, { text: string; bg: string; border: string; css: string }> = {
  elektra: { text: "text-cyan", bg: "bg-cyan/15", border: "border-cyan", css: "hsl(var(--cyan))" },
  chinoda: { text: "text-yellow", bg: "bg-yellow/15", border: "border-yellow", css: "hsl(var(--yellow))" },
  luan: { text: "text-orange", bg: "bg-orange/15", border: "border-orange", css: "hsl(var(--orange))" },
};

const VOCALIST_LABELS: Record<Vocalist, string> = {
  elektra: "🎤", // Microphone for lead singer (Giulia/Lady Elektra) - sings and screams
  chinoda: "🎙️", // Studio microphone for co-lead (Huds) - raps, backing vocals, singing
  luan: "🎶", // Multiple notes for backing harmonics (Luan)
};

// Segments now carry an array of vocalists
interface LineSegment {
  text: string;
  vocalists: Vocalist[];
  start: number;
  end: number;
}

const getLineSegments = (
  text: string,
  annotations: TextAnnotation[],
  songId: string,
  lineIndex: number
): LineSegment[] => {
  const lineAnns = annotations.filter(
    (a) => a.songId === songId && a.lineIndex === lineIndex
  );
  if (lineAnns.length === 0) {
    return [{ text, vocalists: [], start: 0, end: text.length }];
  }
  // Build a set of vocalists per character
  const charMap: Set<Vocalist>[] = Array.from({ length: text.length }, () => new Set());
  for (const ann of lineAnns) {
    for (let i = ann.startOffset; i < ann.endOffset && i < text.length; i++) {
      charMap[i].add(ann.vocalist);
    }
  }
  // Group consecutive chars with same vocalist set
  const key = (s: Set<Vocalist>) => [...s].sort().join(",");
  const segments: LineSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const k = key(charMap[i]);
    let j = i;
    while (j < text.length && key(charMap[j]) === k) j++;
    segments.push({ text: text.slice(i, j), vocalists: [...charMap[i]].sort(), start: i, end: j });
    i = j;
  }
  return segments;
};

/** Remove annotations of the SAME vocalist that overlap with newAnn */
const removeSameVocalistOverlap = (existing: TextAnnotation[], newAnn: TextAnnotation): TextAnnotation[] => {
  const result: TextAnnotation[] = [];
  for (const ann of existing) {
    if (ann.songId !== newAnn.songId || ann.lineIndex !== newAnn.lineIndex || ann.vocalist !== newAnn.vocalist) {
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

/** Remove ALL vocalist annotations that overlap with the given range */
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

const LyricViewer = ({ song, songIndex, onSidebarToggle, sidebarCollapsed, onSongChange, totalSongs = 0 }: LyricViewerProps) => {
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(() => {
    const userAnnotations = load(STORAGE_KEY, []);
    return mergeAnnotations(userAnnotations);
  });

  // Re-merge annotations when user annotations change
  useEffect(() => {
    const userAnnotations = load(STORAGE_KEY, []);
    const merged = mergeAnnotations(userAnnotations);
    setAnnotations(merged);
  }, []);

  // Save only user annotations (not defaults) to localStorage
  const saveUserAnnotations = useCallback((newAnnotations: TextAnnotation[]) => {
    // Filter out default annotations before saving
    const userOnly = newAnnotations.filter(ann => {
      const key = `${ann.songId}-${ann.lineIndex}-${ann.startOffset}-${ann.endOffset}-${ann.vocalist}`;
      return !DEFAULT_ANNOTATIONS.some(def => 
        `${def.songId}-${def.lineIndex}-${def.startOffset}-${def.endOffset}-${def.vocalist}` === key
      );
    });
    save(STORAGE_KEY, userOnly);
    const merged = mergeAnnotations(userOnly);
    setAnnotations(merged);
  }, []);
  const [activeVocalist, setActiveVocalist] = useState<VocalistOrNull>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => load(NOTES_KEY, {}));
  const [showNotes, setShowNotes] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>(() => load(YOUTUBE_KEY, {}));
  const [loops, setLoops] = useState<LoopRegion[]>(() => load(LOOPS_KEY, []));
  const [customLyrics, setCustomLyrics] = useState<Record<string, string>>(() => load(LYRICS_KEY, {}));
  const [activeLoop, setActiveLoop] = useState<LoopRegion | null>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [pendingLoop, setPendingLoop] = useState<{ lineStart: number; lineEnd: number; label: string } | null>(null);
  const [editingLoop, setEditingLoop] = useState<LoopRegion | null>(null);
  const [loopStartInput, setLoopStartInput] = useState("0:00");
  const [loopEndInput, setLoopEndInput] = useState("0:30");
  const [loopLabelInput, setLoopLabelInput] = useState("");
  const [eraserMode, setEraserMode] = useState(false);
  
  // Performance mode states (formerly karaoke)
  const [performanceMode, setPerformanceMode] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(true); // true = auto, false = manual
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const lyricsRef = useRef<HTMLDivElement>(null);
  const performanceContainerRef = useRef<HTMLDivElement>(null);

  const mode: InteractionMode = eraserMode ? "eraser" : loopMode ? "loop" : activeVocalist ? "vocalist" : null;

  // Update annotations when they change - save only user annotations
  useEffect(() => {
    saveUserAnnotations(annotations);
  }, [annotations, saveUserAnnotations]);
  useEffect(() => { save(NOTES_KEY, notes); }, [notes]);
  useEffect(() => { save(YOUTUBE_KEY, youtubeLinks); }, [youtubeLinks]);
  useEffect(() => { save(LOOPS_KEY, loops); }, [loops]);
  useEffect(() => { save(LYRICS_KEY, customLyrics); }, [customLyrics]);

  // Simple timing data for demo - in production this would come from a timing file
  const getLineTimings = (songId: string) => {
    // Demo timings for "Somewhere I Belong" - each line appears every 4 seconds
    const baseTiming: Record<string, number[]> = {
      "somewhere-i-belong": [
        0,    // [Verse 1]
        2,    // (When this began)...
        6,    // And I'd get lost...
        10,   // (I was confused)...
        14,   // That I'm not...
        18,   // (Inside of me)...
        22,   // Is the only real...
        26,   // (Nothing to lose)...
        30,   // And the fault...
        34,   // [Chorus]
        36,   // I wanna heal...
        40,   // What I thought...
        44,   // I wanna let go...
        48,   // Erase all the pain...
        52,   // I wanna heal...
        56,   // Like I'm close...
        60,   // I wanna find...
        64,   // Somewhere I belong
      ],
    };
    return baseTiming[songId] || [];
  };

  // YouTube time update handler
  const handleYouTubeTimeUpdate = (currentTime: number) => {
    setYoutubeCurrentTime(currentTime);
    
    if (performanceMode && isAutoMode && song) {
      const timings = getLineTimings(song.id);
      const currentLyrics = getCurrentLyrics();
      const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
      
      // Find the current line based on timing
      let newLineIndex = 0;
      for (let i = 0; i < timings.length; i++) {
        if (currentTime >= timings[i]) {
          newLineIndex = i;
        } else {
          break;
        }
      }
      
      if (newLineIndex !== currentLineIndex && newLineIndex < lines.length) {
        setCurrentLineIndex(newLineIndex);
      }
    }
  };

  // YouTube play state handler
  const handleYouTubePlayStateChange = (playing: boolean) => {
    if (performanceMode && isAutoMode) {
      setIsPlaying(playing);
    }
  };

  // Keyboard shortcuts for lyrics editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + E to toggle lyrics editor
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !performanceMode) {
        e.preventDefault();
        setShowLyricsEditor(prev => !prev);
      }
      // Ctrl/Cmd + S to save lyrics when editor is open
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && showLyricsEditor && hasUnsavedChanges) {
        e.preventDefault();
        saveLyricsChanges();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLyricsEditor, hasUnsavedChanges, performanceMode]);

  // Arrow key controls for manual performance mode
  useEffect(() => {
    if (!performanceMode || !song) return;

    const currentLyrics = getCurrentLyrics();
    const handleKeyDown = (e: KeyboardEvent) => {
      const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
      
      // Song navigation (works in both auto and manual modes)
      if (e.key === "PageUp" || (e.ctrlKey && e.key === "ArrowLeft")) {
        e.preventDefault();
        onSongChange?.('prev');
        return;
      }
      if (e.key === "PageDown" || (e.ctrlKey && e.key === "ArrowRight")) {
        e.preventDefault();
        onSongChange?.('next');
        return;
      }
      
      // ESC to exit performance mode or fullscreen
      if (e.key === "Escape") {
        e.preventDefault();
        if (isFullscreen) {
          document.exitFullscreen?.();
        } else {
          setPerformanceMode(false);
        }
        return;
      }
      
      // F11 for fullscreen toggle
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      
      // F1 for help
      if (e.key === "F1") {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
      
      // Line navigation (only in manual mode)
      if (isAutoMode) return;
      
      switch (e.key) {
        case "ArrowRight":
        case " ": // Spacebar
          e.preventDefault();
          setCurrentLineIndex(prev => Math.min(prev + 1, lines.length - 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentLineIndex(prev => Math.max(prev - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          setCurrentLineIndex(0);
          break;
        case "End":
          e.preventDefault();
          setCurrentLineIndex(lines.length - 1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [performanceMode, isAutoMode, song, customLyrics, onSongChange]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      performanceContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePerformanceMode = () => {
    const newMode = !performanceMode;
    setPerformanceMode(newMode);
    setCurrentLineIndex(0);
    setIsPlaying(false);
    
    if (newMode) {
      // Entering performance mode - show YouTube player and collapse sidebar if not already collapsed
      setShowYouTube(true);
      if (!sidebarCollapsed) {
        onSidebarToggle(); // Auto-collapse sidebar
      }
    }
  };

  const toggleAutoMode = () => {
    setIsAutoMode(prev => !prev);
    setIsPlaying(false);
  };

  // Initialize edited lyrics when song changes
  useEffect(() => {
    if (song) {
      const currentLyrics = customLyrics[song.id] || song.lyrics;
      setEditedLyrics(currentLyrics);
      setHasUnsavedChanges(false);
    }
  }, [song, customLyrics]);

  // Handle lyrics editing
  const handleLyricsChange = (newLyrics: string) => {
    setEditedLyrics(newLyrics);
    setHasUnsavedChanges(true);
  };

  const saveLyricsChanges = () => {
    if (!song) return;
    setCustomLyrics(prev => ({
      ...prev,
      [song.id]: editedLyrics
    }));
    setHasUnsavedChanges(false);
  };

  const discardLyricsChanges = () => {
    if (!song) return;
    const originalLyrics = customLyrics[song.id] || song.lyrics;
    setEditedLyrics(originalLyrics);
    setHasUnsavedChanges(false);
  };

  const resetToOriginalLyrics = () => {
    if (!song) return;
    setEditedLyrics(song.lyrics);
    setCustomLyrics(prev => {
      const updated = { ...prev };
      delete updated[song.id];
      return updated;
    });
    setHasUnsavedChanges(false);
  };

  const exportLyrics = () => {
    if (!song) return;
    const lyrics = getCurrentLyrics();
    const blob = new Blob([lyrics], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}_lyrics.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importLyrics = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
            setEditedLyrics(content);
            setHasUnsavedChanges(true);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Get current lyrics (custom or original)
  const getCurrentLyrics = () => {
    if (!song) return "";
    return customLyrics[song.id] || song.lyrics;
  };

  const togglePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

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

    if (mode === "loop") {
      const selectedText = selection.toString().slice(0, 60);
      setPendingLoop({ lineStart: startLineIdx, lineEnd: endLineIdx, label: selectedText });
      selection.removeAllRanges();
      return;
    }

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

    if (mode === "eraser") {
      setAnnotations((prev) => {
        let updated = [...prev];
        for (let li = startLineIdx; li <= endLineIdx; li++) {
          const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
          if (offsets) {
            updated = removeAllOverlap(updated, song.id, offsets.lineIndex, offsets.startOffset, offsets.endOffset);
          }
        }
        // Save and merge with defaults
        saveUserAnnotations(updated);
        return updated;
      });
      selection.removeAllRanges();
      return;
    }

    if (mode === "vocalist" && activeVocalist) {
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
          // Save and merge with defaults
          saveUserAnnotations(updated);
          return updated;
        });
      }
      selection.removeAllRanges();
    }
  }, [song, mode, activeVocalist]);

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

  const handleDeleteLoop = (id: string) => {
    setLoops((prev) => prev.filter((l) => l.id !== id));
    if (activeLoop?.id === id) setActiveLoop(null);
    if (editingLoop?.id === id) setEditingLoop(null);
  };

  const clearLineAnnotations = useCallback(
    (lineIndex: number) => {
      if (!song) return;
      const updated = annotations.filter((a) => !(a.songId === song.id && a.lineIndex === lineIndex));
      saveUserAnnotations(updated);
    },
    [song, annotations, saveUserAnnotations]
  );

  const toggleVocalist = (v: VocalistOrNull) => {
    setLoopMode(false);
    setEraserMode(false);
    setPendingLoop(null);
    setActiveVocalist((prev) => (prev === v ? null : v));
  };

  const toggleLoopMode = () => {
    setActiveVocalist(null);
    setEraserMode(false);
    setPendingLoop(null);
    setLoopMode((prev) => !prev);
  };

  const toggleEraserMode = () => {
    setActiveVocalist(null);
    setLoopMode(false);
    setPendingLoop(null);
    setEraserMode((prev) => !prev);
  };

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-mono-body text-sm">
          <span className="inline-block w-[2px] h-4 bg-muted-foreground animate-pulse" />
        </div>
      </div>
    );
  }

  const currentLyrics = getCurrentLyrics();
  const lines = currentLyrics.split("\n");
  const currentNote = notes[song.id] || "";
  const currentYouTube = youtubeLinks[song.id] || "";
  const songLoops = loops.filter((l) => l.songId === song.id);

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Header */}
      <div className="border-b border-border p-6 flex items-end justify-between shrink-0 flex-wrap gap-2">
        <div>
          <span className="font-mono-ui text-xs text-muted-foreground">
            TRACK {String(songIndex + 1).padStart(2, "0")}
            {customLyrics[song.id] && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">CUSTOM LYRICS</span>
            )}
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wide text-foreground leading-none mt-1">
            {song.title.toUpperCase()}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Performance Mode Controls */}
          <button
            onClick={togglePerformanceMode}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              performanceMode
                ? "border-purple-500 text-purple-500 bg-purple-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            🎤 PERFORMANCE
          </button>
          
          {performanceMode && (
            <>
              <button
                onClick={toggleAutoMode}
                className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
                  isAutoMode
                    ? "border-blue-500 text-blue-500 bg-blue-500/10"
                    : "border-orange-500 text-orange-500 bg-orange-500/10"
                }`}
              >
                {isAutoMode ? "🤖 AUTO" : "👤 MANUAL"}
              </button>
              
              {isAutoMode && (
                <button
                  onClick={togglePlayPause}
                  className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
                    isPlaying
                      ? "border-red-500 text-red-500 bg-red-500/10"
                      : "border-green-500 text-green-500 bg-green-500/10"
                  }`}
                >
                  {isPlaying ? "⏸️ PAUSE" : "▶️ PLAY"}
                </button>
              )}
              
              {!isAutoMode && (
                <span className="px-3 py-1 font-mono-ui text-xs text-muted-foreground border border-border">
                  ← → LINES | PgUp/PgDn SONGS | SPACE | HOME/END
                </span>
              )}
            </>
          )}

          <button
            onClick={() => toggleVocalist("all")}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              activeVocalist === "all"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            ALL
          </button>
          {(["elektra", "chinoda", "luan"] as const).map((v) => {
            const labels: Record<Vocalist, string> = { elektra: "LADY", chinoda: "HUDS", luan: "LUAN" };
            const colorKey: Record<Vocalist, string> = { elektra: "cyan", chinoda: "yellow", luan: "orange" };
            const c = colorKey[v];
            const symbol = VOCALIST_LABELS[v];
            return (
              <button
                key={v}
                onClick={() => toggleVocalist(v)}
                className={`px-3 py-1 font-mono-ui text-xs border transition-none flex items-center gap-2 ${
                  activeVocalist === v
                    ? `border-${c} text-${c} bg-${c}/10`
                    : "border-border text-muted-foreground hover:text-accent"
                }`}
                style={{
                  // Add colored left border for color reference
                  borderLeft: `4px solid ${VOCALIST_COLORS[v].css}`,
                  // Add subtle background tint
                  backgroundColor: activeVocalist === v 
                    ? `${VOCALIST_COLORS[v].css}15` 
                    : `${VOCALIST_COLORS[v].css}05`,
                }}
              >
                <span className="text-sm">{symbol}</span>
                {labels[v]}
              </button>
            );
          })}
          <button
            onClick={toggleEraserMode}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              eraserMode
                ? "border-destructive text-destructive bg-destructive/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            <Eraser size={14} className="inline mr-1" />LIMPAR
          </button>
          <button
            onClick={toggleLoopMode}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              loopMode
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            🔁 LOOP
          </button>
          <button
            onClick={() => setShowYouTube(!showYouTube)}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              showYouTube
                ? "border-destructive text-destructive"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            ▶ YT
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              showNotes
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            NOTES
          </button>
          <button
            onClick={() => setShowLyricsEditor(!showLyricsEditor)}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              showLyricsEditor
                ? "border-green-500 text-green-500 bg-green-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
            title="Edit lyrics (Ctrl+E)"
          >
            ✏️ EDIT LYRICS
          </button>
        </div>
      </div>

      {/* YouTube Player */}
      {(showYouTube || performanceMode) && (
        <YouTubePlayer
          youtubeUrl={currentYouTube}
          songTitle={song.title}
          onUrlChange={(url) => setYoutubeLinks((prev) => ({ ...prev, [song.id]: url }))}
          activeLoop={activeLoop}
          onClearLoop={() => setActiveLoop(null)}
          onTimeUpdate={handleYouTubeTimeUpdate}
          onPlayStateChange={handleYouTubePlayStateChange}
        />
      )}

      {/* Pending loop dialog */}
      {pendingLoop && (
        <div className="border-b border-primary bg-muted/50 px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-mono-ui text-xs text-primary">🔁 DEFINIR LOOP:</span>
          <input
            value={loopLabelInput || pendingLoop.label}
            onChange={(e) => setLoopLabelInput(e.target.value)}
            className="w-40 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary"
            placeholder="Label"
          />
          <div className="flex items-center gap-1">
            <span className="font-mono-ui text-xs text-muted-foreground">DE</span>
            <input
              value={loopStartInput}
              onChange={(e) => setLoopStartInput(e.target.value)}
              className="w-16 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary text-center"
              placeholder="0:00"
            />
            <span className="font-mono-ui text-xs text-muted-foreground">ATÉ</span>
            <input
              value={loopEndInput}
              onChange={(e) => setLoopEndInput(e.target.value)}
              className="w-16 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary text-center"
              placeholder="0:30"
            />
          </div>
          <button
            onClick={handleSaveLoop}
            className="px-3 py-1 font-mono-ui text-xs border border-primary text-primary hover:bg-primary/10"
          >
            SALVAR
          </button>
          <button
            onClick={() => { setPendingLoop(null); setLoopLabelInput(""); }}
            className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
          >
            ✕
          </button>
        </div>
      )}

      {/* Editing loop dialog */}
      {editingLoop && (
        <div className="border-b border-primary bg-muted/50 px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-mono-ui text-xs text-primary">✏️ EDITAR LOOP:</span>
          <input
            value={loopLabelInput}
            onChange={(e) => setLoopLabelInput(e.target.value)}
            className="w-40 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary"
            placeholder="Label"
          />
          <div className="flex items-center gap-1">
            <span className="font-mono-ui text-xs text-muted-foreground">DE</span>
            <input
              value={loopStartInput}
              onChange={(e) => setLoopStartInput(e.target.value)}
              className="w-16 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary text-center"
              placeholder="0:00"
            />
            <span className="font-mono-ui text-xs text-muted-foreground">ATÉ</span>
            <input
              value={loopEndInput}
              onChange={(e) => setLoopEndInput(e.target.value)}
              className="w-16 bg-transparent border border-border px-1 py-0.5 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary text-center"
              placeholder="0:30"
            />
          </div>
          <button
            onClick={handleSaveEditLoop}
            className="px-3 py-1 font-mono-ui text-xs border border-primary text-primary hover:bg-primary/10"
          >
            SALVAR
          </button>
          <button
            onClick={() => { setEditingLoop(null); setLoopLabelInput(""); }}
            className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
          >
            ✕
          </button>
        </div>
      )}

      {/* Instruction banner */}
      {mode === "vocalist" && activeVocalist && (
        <div className={`px-6 py-2 text-xs font-mono-ui border-b border-border ${
          activeVocalist === "all" 
            ? "text-primary bg-muted/30"
            : `${VOCALIST_COLORS[activeVocalist as Vocalist].text} bg-muted/30`
        }`}>
          ✎ Selecione texto para marcar como{" "}
          {activeVocalist === "all" 
            ? "TODOS OS VOCALISTAS" 
            : activeVocalist === "elektra" ? "LADY 🎤 (Lead Singer)" 
            : activeVocalist === "chinoda" ? "HUDS 🎙️ (Rap/Co-Lead)" 
            : "LUAN 🎶 (Harmonics)"}.
          {" "}Pode sobrepor com outros vocalistas. Clique duplo numa linha para limpar tudo.
        </div>
      )}
      {mode === "eraser" && (
        <div className="px-6 py-2 text-xs font-mono-ui border-b border-border text-destructive bg-muted/30">
          <Eraser size={12} className="inline mr-1" /> Selecione texto para limpar marcações de vocalista.
        </div>
      )}
      {mode === "loop" && !pendingLoop && (
        <div className="px-6 py-2 text-xs font-mono-ui border-b border-border text-primary bg-muted/30">
          🔁 Selecione um trecho da letra ou clique num título de seção para criar um loop.
        </div>
      )}

      {/* Saved loops bar */}
      {songLoops.length > 0 && (
        <div className="px-6 py-2 border-b border-border flex items-center gap-2 flex-wrap bg-muted/20">
          <span className="font-mono-ui text-xs text-muted-foreground shrink-0">LOOPS:</span>
          {songLoops.map((loop) => (
            <div key={loop.id} className="flex items-center gap-0">
              <button
                onClick={() => {
                  if (activeLoop?.id === loop.id) {
                    setActiveLoop(null);
                  } else {
                    setActiveLoop(loop);
                    setShowYouTube(true);
                  }
                }}
                className={`px-2 py-0.5 font-mono-ui text-xs border border-r-0 transition-none flex items-center gap-1 max-w-[200px] ${
                  activeLoop?.id === loop.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-accent"
                }`}
              >
                <span className="truncate">{loop.label.slice(0, 25)}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatTime(loop.startTime)}–{formatTime(loop.endTime)}
                </span>
              </button>
              <button
                onClick={() => handleStartEditLoop(loop)}
                className="px-1.5 py-0.5 font-mono-ui text-xs border border-r-0 border-border text-muted-foreground hover:text-primary"
                title="Editar loop"
              >
                <Pencil size={10} />
              </button>
              <button
                onClick={() => handleDeleteLoop(loop.id)}
                className="px-1.5 py-0.5 font-mono-ui text-xs border border-border text-muted-foreground hover:text-destructive"
                title="Deletar loop"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Lyrics */}
        <div className="flex-1 overflow-hidden">
          {performanceMode ? (
            // Performance Mode - Minimalist Design with Focus on Lyrics
            <div 
              ref={performanceContainerRef}
              className="h-full flex flex-col bg-background relative"
            >
              {/* Discreet Top Controls - Only visible on hover */}
              <div className="absolute top-0 left-0 right-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="flex justify-between items-center p-3 bg-background/80 backdrop-blur-sm">
                  {/* Song Navigation - Minimalist */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSongChange?.('prev')}
                      disabled={songIndex === 0}
                      className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-colors ${
                        songIndex === 0
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Previous Song (PgUp)"
                    >
                      ‹
                    </button>
                    <div className="px-2 py-1 text-xs font-mono-ui text-muted-foreground bg-muted/30 rounded">
                      {songIndex + 1}/{totalSongs}
                    </div>
                    <button
                      onClick={() => onSongChange?.('next')}
                      disabled={songIndex >= totalSongs - 1}
                      className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-colors ${
                        songIndex >= totalSongs - 1
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Next Song (PgDn)"
                    >
                      ›
                    </button>
                  </div>

                  {/* Exit Controls - Minimalist */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHelp(true)}
                      className="w-8 h-8 rounded flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Help (F1)"
                    >
                      ?
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="w-8 h-8 rounded flex items-center justify-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
                    >
                      {isFullscreen ? "⌐" : "⌐"}
                    </button>
                    <button
                      onClick={togglePerformanceMode}
                      className="w-8 h-8 rounded flex items-center justify-center text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Exit Performance Mode (ESC)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Lyrics Display - Full Focus */}
              <div className="flex-1 flex flex-col justify-center items-center px-8">
                <div className="w-full max-w-6xl">
                  {(() => {
                    const lines = currentLyrics.split("\n");
                    const nonEmptyLines = lines.filter(line => line.trim() !== "");
                    const currentLine = nonEmptyLines[currentLineIndex] || "";
                    const nextLine = nonEmptyLines[currentLineIndex + 1] || "";
                    const prevLine = nonEmptyLines[currentLineIndex - 1] || "";

                    return (
                      <div className="space-y-8">
                        {/* Previous Line - Subtle */}
                        <div className="text-center opacity-30 transition-all duration-500">
                          <div className="font-mono-body text-xl md:text-2xl font-medium text-muted-foreground">
                            {prevLine}
                          </div>
                        </div>

                        {/* Current Line - Main Focus */}
                        <div className="text-center transition-all duration-700 ease-out">
                          <div className="font-mono-body text-6xl md:text-8xl lg:text-9xl xl:text-[12rem] font-bold text-foreground leading-tight tracking-wide"
                               style={{
                                 textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                 filter: 'contrast(1.1)',
                               }}>
                            {currentLine.startsWith("[") && currentLine.endsWith("]") ? (
                              <span className="text-primary text-3xl md:text-4xl lg:text-5xl xl:text-6xl uppercase tracking-widest font-medium">
                                {currentLine.slice(1, -1)}
                              </span>
                            ) : (
                              <span>
                                {currentLine}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Next Line - Subtle */}
                        <div className="text-center opacity-50 transition-all duration-500">
                          <div className="font-mono-body text-xl md:text-2xl font-medium text-muted-foreground">
                            {nextLine}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Discreet Bottom Controls - Only visible on hover */}
              <div className="absolute bottom-0 left-0 right-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="p-4 bg-background/80 backdrop-blur-sm">
                  <div className="flex justify-center items-center gap-4">
                    {/* Line Navigation - Minimalist */}
                    <button
                      onClick={() => {
                        const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                        setCurrentLineIndex(prev => Math.max(prev - 1, 0));
                      }}
                      disabled={currentLineIndex === 0}
                      className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-colors ${
                        currentLineIndex === 0
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Previous Line (←)"
                    >
                      ‹
                    </button>

                    {/* Play/Pause for Auto Mode - Minimalist */}
                    {isAutoMode && (
                      <button
                        onClick={togglePlayPause}
                        className={`w-12 h-12 rounded flex items-center justify-center text-lg transition-colors ${
                          isPlaying
                            ? "text-red-500 hover:bg-red-500/10"
                            : "text-green-500 hover:bg-green-500/10"
                        }`}
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? "⏸" : "▶"}
                      </button>
                    )}

                    {/* Mode Toggle - Minimalist */}
                    <button
                      onClick={toggleAutoMode}
                      className={`w-10 h-10 rounded flex items-center justify-center text-xs font-mono-ui transition-colors ${
                        isAutoMode
                          ? "text-blue-500 hover:bg-blue-500/10"
                          : "text-orange-500 hover:bg-orange-500/10"
                      }`}
                      title={isAutoMode ? "Switch to Manual" : "Switch to Auto"}
                    >
                      {isAutoMode ? "A" : "M"}
                    </button>

                    <button
                      onClick={() => {
                        const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                        setCurrentLineIndex(prev => Math.min(prev + 1, lines.length - 1));
                      }}
                      disabled={(() => {
                        const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                        return currentLineIndex >= lines.length - 1;
                      })()}
                      className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-colors ${
                        (() => {
                          const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                          return currentLineIndex >= lines.length - 1;
                        })()
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title="Next Line (→)"
                    >
                      ›
                    </button>
                  </div>

                  {/* Progress Bar - Minimalist */}
                  <div className="flex justify-center items-center mt-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-ui text-xs text-muted-foreground">
                        {currentLineIndex + 1}/{currentLyrics.split("\n").filter(line => line.trim() !== "").length}
                      </span>
                      <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/60 transition-all duration-300"
                          style={{ 
                            width: `${((currentLineIndex + 1) / currentLyrics.split("\n").filter(line => line.trim() !== "").length) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="font-mono-ui text-xs text-muted-foreground">
                        {isAutoMode ? (isPlaying ? "AUTO" : "PAUSED") : "MANUAL"}
                      </span>
                      {isAutoMode && (
                        <span className="font-mono-ui text-xs text-primary/70">
                          {Math.floor(youtubeCurrentTime / 60)}:{String(Math.floor(youtubeCurrentTime % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-screen click areas for line navigation (invisible) */}
              <div className="absolute inset-0 flex pointer-events-none">
                {/* Left third - Previous line */}
                <div 
                  className="w-1/3 h-full pointer-events-auto cursor-pointer"
                  onClick={() => {
                    if (!isAutoMode) {
                      const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                      setCurrentLineIndex(prev => Math.max(prev - 1, 0));
                    }
                  }}
                  title={!isAutoMode ? "Previous Line (Click left side)" : ""}
                />
                {/* Right third - Next line */}
                <div 
                  className="w-1/3 h-full ml-auto pointer-events-auto cursor-pointer"
                  onClick={() => {
                    if (!isAutoMode) {
                      const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                      setCurrentLineIndex(prev => Math.min(prev + 1, lines.length - 1));
                    }
                  }}
                  title={!isAutoMode ? "Next Line (Click right side)" : ""}
                />
              </div>

              {/* Help Overlay - Updated for minimalist design */}
              {showHelp && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="bg-background/95 border border-border rounded-lg p-8 max-w-2xl">
                    <div className="text-center mb-6">
                      <h2 className="font-display text-3xl text-foreground mb-2">PERFORMANCE MODE</h2>
                      <p className="text-muted-foreground">Minimalist design focused on lyrics</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <h3 className="font-mono-ui text-primary mb-3">🎵 SONG NAVIGATION</h3>
                        <div className="space-y-2 text-muted-foreground">
                          <div>‹ › <strong>Previous/Next Song:</strong> PgUp/PgDn or Ctrl+←/→</div>
                          <div>⌐ <strong>Fullscreen:</strong> F11 key</div>
                          <div>× <strong>Exit:</strong> ESC key</div>
                          <div>? <strong>This Help:</strong> F1 key</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-mono-ui text-primary mb-3">📝 LINE NAVIGATION</h3>
                        <div className="space-y-2 text-muted-foreground">
                          <div>‹ › <strong>Previous/Next Line:</strong> ← → keys or click screen sides</div>
                          <div><strong>First Line:</strong> Home key</div>
                          <div><strong>Last Line:</strong> End key</div>
                          <div><strong>Quick Jump:</strong> Space bar (next line)</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-mono-ui text-primary mb-3">🎮 PLAYBACK MODES</h3>
                        <div className="space-y-2 text-muted-foreground">
                          <div>A <strong>Auto Mode:</strong> Syncs with YouTube timing</div>
                          <div>M <strong>Manual Mode:</strong> Full keyboard control</div>
                          <div>▶ ⏸ <strong>Play/Pause:</strong> Auto mode only</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-mono-ui text-primary mb-3">💡 DESIGN FEATURES</h3>
                        <div className="space-y-2 text-muted-foreground">
                          <div><strong>Hover Controls:</strong> UI appears on mouse hover</div>
                          <div><strong>Clean Focus:</strong> Lyrics take center stage</div>
                          <div><strong>Click Areas:</strong> Left/right screen for navigation</div>
                          <div><strong>Progress Bar:</strong> Shows song position</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center mt-6">
                      <button
                        onClick={() => setShowHelp(false)}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Got it!
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Normal Mode - Traditional Lyrics
            <div className="overflow-y-auto p-6 md:px-10 md:py-6">
              <div className={`${sidebarCollapsed ? 'max-w-5xl' : 'max-w-3xl'} transition-all duration-300`} ref={lyricsRef} onMouseUp={handleMouseUp}>
                {lines.map((line, i) => {
                  const trimmed = line.trim();
                  const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
                  const isEmpty = trimmed === "";

                  if (isEmpty) return <div key={i} className="h-2" />;

                  if (isSection) {
                    const sectionName = trimmed.slice(1, -1);
                    return (
                      <div
                        key={i}
                        data-line-index={i}
                        className={`mt-4 mb-1 first:mt-0 flex items-center gap-2 ${mode === "loop" ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (mode === "loop") {
                            setPendingLoop({ lineStart: i, lineEnd: i, label: sectionName });
                            setLoopStartInput("0:00");
                            setLoopEndInput("0:30");
                            setLoopLabelInput(sectionName);
                          }
                        }}
                      >
                        <span className={`font-mono-ui text-[10px] tracking-widest text-primary/70 uppercase bg-primary/5 px-2 py-0.5 border border-primary/20 ${mode === "loop" ? "hover:bg-primary/15 hover:border-primary/40" : ""}`}>
                          {sectionName}
                        </span>
                      </div>
                    );
                  }

                  const inLoop = activeLoop && i >= activeLoop.lineStart && i <= activeLoop.lineEnd;
                  const segments = getLineSegments(trimmed, annotations, song.id, i);

                  return (
                    <div
                      key={i}
                      data-line-index={i}
                      onDoubleClick={() => mode === "vocalist" && clearLineAnnotations(i)}
                      className={`font-mono-body text-xl md:text-2xl font-semibold leading-8 mb-2 ${
                        mode ? "cursor-text select-text" : "cursor-default"
                      } ${inLoop ? "border-l-2 border-primary pl-3 bg-primary/5" : ""}`}
                    >
                      {segments.map((seg, si) => (
                        <SegmentSpan key={si} segment={seg} />
                      ))}
                    </div>
                  );
                })}
                <div className="h-20" />
              </div>
            </div>
          )}
        </div>

        {/* Notes panel */}
        {showNotes && (
          <div className="w-80 border-l border-border bg-surface flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <span className="font-mono-ui text-xs text-muted-foreground">NOTES</span>
            </div>
            <textarea
              value={currentNote}
              onChange={(e) => setNotes((prev) => ({ ...prev, [song.id]: e.target.value }))}
              placeholder=""
              className="flex-1 bg-transparent text-foreground font-mono-body text-sm p-4 resize-none focus:outline-none placeholder:text-transparent"
              spellCheck={false}
            />
          </div>
        )}

        {/* Lyrics Editor Panel */}
        {showLyricsEditor && (
          <div className="w-96 border-l border-border bg-surface flex flex-col shrink-0">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <span className="font-mono-ui text-xs text-muted-foreground">LYRICS EDITOR</span>
                {customLyrics[song.id] && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">CUSTOM</span>
                )}
                {hasUnsavedChanges && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">UNSAVED</span>
                )}
              </div>
            </div>
            
            {/* Editor Controls */}
            <div className="p-3 border-b border-border flex gap-2 flex-wrap">
              <button
                onClick={saveLyricsChanges}
                disabled={!hasUnsavedChanges}
                className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
                  hasUnsavedChanges
                    ? "border-green-500 text-green-500 hover:bg-green-500/10"
                    : "border-border text-muted-foreground cursor-not-allowed"
                }`}
                title="Save changes (Ctrl+S)"
              >
                💾 SAVE
              </button>
              <button
                onClick={discardLyricsChanges}
                disabled={!hasUnsavedChanges}
                className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
                  hasUnsavedChanges
                    ? "border-orange-500 text-orange-500 hover:bg-orange-500/10"
                    : "border-border text-muted-foreground cursor-not-allowed"
                }`}
              >
                ↶ DISCARD
              </button>
              <button
                onClick={exportLyrics}
                className="px-3 py-1 font-mono-ui text-xs border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition-none"
                title="Export lyrics to file"
              >
                📤 EXPORT
              </button>
              <button
                onClick={importLyrics}
                className="px-3 py-1 font-mono-ui text-xs border border-purple-500 text-purple-500 hover:bg-purple-500/10 transition-none"
                title="Import lyrics from file"
              >
                📥 IMPORT
              </button>
              {customLyrics[song.id] && (
                <button
                  onClick={resetToOriginalLyrics}
                  className="px-3 py-1 font-mono-ui text-xs border border-red-500 text-red-500 hover:bg-red-500/10 transition-none"
                >
                  🔄 RESET TO ORIGINAL
                </button>
              )}
            </div>

            {/* Editor Textarea */}
            <textarea
              value={editedLyrics}
              onChange={(e) => handleLyricsChange(e.target.value)}
              placeholder="Enter lyrics here..."
              className="flex-1 bg-transparent text-foreground font-mono-body text-sm p-4 resize-none focus:outline-none"
              spellCheck={false}
            />
            
            {/* Editor Help */}
            <div className="p-3 border-t border-border text-xs text-muted-foreground">
              <div className="mb-2">
                <strong>Keyboard Shortcuts:</strong>
              </div>
              <div>• Ctrl+E: Toggle editor</div>
              <div>• Ctrl+S: Save changes</div>
              <div className="mt-2 mb-2">
                <strong>Formatting Tips:</strong>
              </div>
              <div>• Use [Verse 1], [Chorus], [Bridge] for sections</div>
              <div>• Empty lines create spacing</div>
              <div>• Voice markings will apply to edited lyrics</div>
              <div>• Export/Import for backup and sharing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Renders a single segment with support for multi-vocalist display */
const SegmentSpan = ({ segment }: { segment: LineSegment }) => {
  const { text, vocalists } = segment;

  if (vocalists.length === 0) {
    return <span className="text-foreground">{text}</span>;
  }

  if (vocalists.length === 1) {
    const colors = VOCALIST_COLORS[vocalists[0]];
    return (
      <span className={`${colors.text} ${colors.bg} px-0.5`}>
        {text}
      </span>
    );
  }

  // Multi-vocalist: enhanced gradient with better visual prominence
  const bgColors = vocalists.map((v) => VOCALIST_COLORS[v].css);
  
  // Create smooth gradient with color stops for better blending
  const createGradientStops = (colors: string[]) => {
    if (colors.length === 1) return colors[0];
    if (colors.length === 2) return `${colors[0]} 0%, ${colors[1]} 100%`;
    
    // For 3+ colors, distribute evenly with smooth transitions
    const step = 100 / (colors.length - 1);
    return colors.map((color, i) => `${color} ${i * step}%`).join(", ");
  };

  const gradientStops = createGradientStops(bgColors);
  const isAllVocalists = vocalists.length === 3;
  
  // Enhanced styling with multiple visual elements
  const gradientStyle: React.CSSProperties = {
    // Main gradient underline - thicker and more prominent
    backgroundImage: isAllVocalists 
      ? `linear-gradient(90deg, ${gradientStops}), linear-gradient(90deg, ${gradientStops})`
      : `linear-gradient(90deg, ${gradientStops})`,
    backgroundSize: isAllVocalists 
      ? "100% 3px, 100% 1px" 
      : "100% 3px",
    backgroundPosition: isAllVocalists 
      ? "bottom, top" 
      : "bottom",
    backgroundRepeat: "no-repeat",
    paddingBottom: "4px",
    paddingTop: isAllVocalists ? "2px" : "0px",
    // Add subtle text shadow for better readability
    textShadow: "0 0 1px rgba(0,0,0,0.1)",
    // Special glow effect for all vocalists
    ...(isAllVocalists && {
      boxShadow: `0 0 8px ${bgColors[0]}33, 0 0 8px ${bgColors[1]}33, 0 0 8px ${bgColors[2]}33`,
      borderRadius: "2px",
    }),
  };

  return (
    <span className="relative inline-flex items-baseline gap-0">
      <span
        className={`text-foreground px-0.5 relative ${isAllVocalists ? 'font-medium' : ''}`}
        style={gradientStyle}
      >
        {text}
      </span>
      <span className="inline-flex gap-1 ml-2 self-end translate-y-[-2px]">
        {vocalists.map((v, index) => (
          <span
            key={v}
            className="leading-none select-none transition-all duration-200 hover:opacity-100 hover:scale-150"
            style={{
              fontSize: isAllVocalists ? "14px" : "12px",
              opacity: 0.9,
              // Add slight stagger effect for better readability
              transform: `translateY(${index * -1}px)`,
              // Better spacing and positioning
              marginLeft: index > 0 ? "2px" : "0px",
              // Enhanced glow for all vocalists without background
              filter: isAllVocalists 
                ? `drop-shadow(0 0 4px ${VOCALIST_COLORS[v].css}88) drop-shadow(0 0 2px ${VOCALIST_COLORS[v].css}66)`
                : `drop-shadow(0 0 2px ${VOCALIST_COLORS[v].css}44)`,
              // Color the emoji with the vocalist's color
              color: VOCALIST_COLORS[v].css,
            }}
          >
            {VOCALIST_LABELS[v]}
          </span>
        ))}
      </span>
    </span>
  );
};

export default LyricViewer;
