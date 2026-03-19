import { useState, useCallback, useEffect, useRef } from "react";
import { Eraser, Pencil } from "lucide-react";
import type { Song } from "@/data/songs";
import YouTubePlayer, { formatTime, parseTime } from "./YouTubePlayer";
import type { LoopRegion } from "./YouTubePlayer";
import { CloudBackup } from "./CloudBackup";
import { AudioSync, type TimingData, type AudioControls } from "./AudioSync";
import { saveToDatabase, loadFromDatabase, loadTimingData, saveTimingData, type DatabaseData } from "@/utils/cloud-storage";

type Vocalist = "elektra" | "chinoda" | "luan";
type VocalistOrAll = Vocalist | "all";
type VocalistOrNull = VocalistOrAll | null;

interface TextAnnotation {
  songId: string;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  vocalist: Vocalist;
  isErased?: boolean; // Optional flag to mark intentionally erased areas
}

interface LyricViewerProps {
  song: Song | null;
  songIndex: number;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  onSongChange?: (direction: 'prev' | 'next') => void;
  totalSongs?: number;
  // Expose internal functions to parent
  onGetToggleFunctions?: (functions: {
    togglePerformanceMode: () => void;
    toggleAutoScrollMode: () => void;
  }) => void;
  // Callback props to sync state with parent
  onPerformanceModeChange?: (enabled: boolean) => void;
  onAutoScrollModeChange?: (enabled: boolean) => void;
  onAutoScrollingChange?: (scrolling: boolean) => void;
}

const STORAGE_KEY = "lp-setlist-annotations-v2";
const NOTES_KEY = "lp-setlist-notes";
const YOUTUBE_KEY = "lp-setlist-youtube";
const LOOPS_KEY = "lp-setlist-loops";
const LYRICS_KEY = "lp-setlist-custom-lyrics";

// Default annotations based on HTML voice divisions
// ⚫️ giulia (white in HTML) = elektra (Giulia), 🔴 hudson (red) = chinoda (Hudson), 🔵 everyone (blue) = all three
const DEFAULT_ANNOTATIONS: TextAnnotation[] = [
  // No default annotations - users will mark their own vocalist parts
];

// Function to merge default annotations with user annotations
const mergeAnnotations = (userAnnotations: TextAnnotation[]): TextAnnotation[] => {
  // No default annotations - just return user annotations without erased markers
  const cleanAnnotations = userAnnotations.filter((ann: any) => !ann.isErased);
  
  console.log('User annotations only:', cleanAnnotations.length, 'total annotations');
  console.log('No default annotations - clean slate');
  
  return cleanAnnotations;
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

const LyricViewer = ({ 
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
}: LyricViewerProps) => {
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
  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showAudioSync, setShowAudioSync] = useState(false);
  const [audioTimings, setAudioTimings] = useState<Record<string, TimingData[]>>({});
  const [audioControls, setAudioControls] = useState<AudioControls | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  
  // Auto-scroll mode states
  const [autoScrollMode, setAutoScrollMode] = useState(false);
  const [scrollSpeeds, setScrollSpeeds] = useState<Record<string, number>>(() => load('lp-setlist-scroll-speeds', {}));
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollIntervalRef = useRef<number | null>(null);
  
  // Performance mode states (formerly karaoke)
  const [performanceMode, setPerformanceMode] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  
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
  useEffect(() => { save('lp-setlist-scroll-speeds', scrollSpeeds); }, [scrollSpeeds]);

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
    
    // Auto-sync lyrics with YouTube in performance mode
    if (performanceMode && song) {
      const songTimings = audioTimings[song.id];
      if (songTimings && songTimings.length > 0) {
        const currentMs = currentTime * 1000; // Convert to milliseconds
        let newLineIndex = 0;
        
        // Find the current line based on YouTube timing
        for (let i = 0; i < songTimings.length; i++) {
          if (currentMs >= songTimings[i].timestampMs) {
            newLineIndex = songTimings[i].lineIndex;
          } else {
            break;
          }
        }
        
        if (newLineIndex !== currentLineIndex) {
          setCurrentLineIndex(newLineIndex);
        }
      }
    }
  };

  // YouTube play state handler  
  const handleYouTubePlayStateChange = (playing: boolean) => {
    // Could be used for additional sync logic if needed
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

  // Arrow key controls for performance mode
  useEffect(() => {
    if (!performanceMode || !song) return;

    const currentLyrics = getCurrentLyrics();
    const handleKeyDown = (e: KeyboardEvent) => {
      const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
      
      // Song navigation
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
      
      // ESC to exit performance mode
      if (e.key === "Escape") {
        e.preventDefault();
        setPerformanceMode(false);
        return;
      }
      
      // Line navigation
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
  }, [performanceMode, song, customLyrics, onSongChange]);

  const togglePerformanceMode = () => {
    const newMode = !performanceMode;
    setPerformanceMode(newMode);
    setCurrentLineIndex(0);
    
    if (newMode) {
      // Entering performance mode - collapse all panels except AudioSync if it has audio
      if (!sidebarCollapsed) {
        onSidebarToggle(); // Auto-collapse sidebar
      }
      // Close all panels except AudioSync if it has audio
      setShowNotes(false);
      setShowLyricsEditor(false);
      setShowYouTube(false);
      setShowCloudBackup(false);
      // Only close AudioSync if no audio is loaded
      if (!audioControls?.hasAudio) {
        setShowAudioSync(false);
      }
    }
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

  const getCurrentLyrics = () => {
    if (!song) return "";
    return customLyrics[song.id] || song.lyrics;
  };

  // Audio sync functions
  const handleTimingUpdate = useCallback((timings: TimingData[]) => {
    if (!song) return;
    
    setAudioTimings(prev => ({
      ...prev,
      [song.id]: timings
    }));
    
    // Save to database immediately
    saveTimingData(song.id, timings);
  }, [song]);

  const handleCurrentLineChange = useCallback((lineIndex: number) => {
    setCurrentLineIndex(lineIndex);
  }, []);

  // Audio controls callback
  const handleAudioReady = useCallback((controls: AudioControls) => {
    setAudioControls(controls);
  }, []);

  // Auto-scroll functionality - Fixed with proper null checks and stable dependencies
  useEffect(() => {
    // Clear any existing interval first
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // Only start auto-scroll if all conditions are met
    if (autoScrollMode && performanceMode && isAutoScrolling && song) {
      try {
        const currentSpeed = scrollSpeeds[song.id] || 50; // Get speed directly to avoid function dependency
        const pixelsPerFrame = Math.max(0.5, currentSpeed / 20);
        
        scrollIntervalRef.current = window.setInterval(() => {
          setScrollPosition(prev => {
            // Add safety check to prevent excessive scrolling
            const maxScroll = 10000; // Reasonable max scroll position
            return Math.min(prev + pixelsPerFrame, maxScroll);
          });
        }, 16); // ~60fps
      } catch (error) {
        console.error('Auto-scroll error:', error);
        // Ensure we clean up on error
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
        }
      }
    }

    // Cleanup function
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [autoScrollMode, performanceMode, isAutoScrolling, song?.id, scrollSpeeds]); // Use song.id and scrollSpeeds directly

  // Mouse wheel controls for lyrics navigation in performance mode
  useEffect(() => {
    if (!performanceMode || !song) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      try {
        if (autoScrollMode) {
          // In auto-scroll mode: wheel controls scroll speed
          const currentSpeed = scrollSpeeds[song.id] || 50;
          const delta = e.deltaY > 0 ? -5 : 5; // Scroll down = slower, scroll up = faster
          const newSpeed = Math.max(1, Math.min(100, currentSpeed + delta));
          
          setScrollSpeeds(prev => ({
            ...prev,
            [song.id]: newSpeed
          }));
        } else {
          // In normal mode: wheel scrolls through lyrics manually
          const scrollAmount = e.deltaY > 0 ? 50 : -50; // Scroll down = forward, scroll up = backward
          setScrollPosition(prev => Math.max(0, prev + scrollAmount));
        }
      } catch (error) {
        console.error('Mouse wheel control error:', error);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button (button 1) to toggle auto-scroll
      if (e.button === 1) {
        e.preventDefault();
        try {
          toggleAutoScrollMode();
        } catch (error) {
          console.error('Middle click auto-scroll toggle error:', error);
        }
      }
    };

    // Add event listeners to the performance container
    const container = performanceContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('mousedown', handleMouseDown);
      
      return () => {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('mousedown', handleMouseDown);
      };
    }
  }, [performanceMode, autoScrollMode, song?.id, scrollSpeeds, setScrollSpeeds, toggleAutoScrollMode]);

  // Auto-sync in performance mode when audio is playing
  useEffect(() => {
    if (!performanceMode || !audioControls?.hasAudio || !audioControls.isPlaying) return;
    
    const songTimings = audioTimings[song?.id || ''];
    if (!songTimings || songTimings.length === 0) return;

    const interval = setInterval(() => {
      const currentMs = audioControls.currentTime;
      let newLineIndex = 0;
      
      // Find the current line based on audio timing
      for (let i = 0; i < songTimings.length; i++) {
        if (currentMs >= songTimings[i].timestampMs) {
          newLineIndex = songTimings[i].lineIndex;
        } else {
          break;
        }
      }
      
      if (newLineIndex !== currentLineIndex) {
        setCurrentLineIndex(newLineIndex);
      }
    }, 100); // Check every 100ms for smooth sync

    return () => clearInterval(interval);
  }, [performanceMode, audioControls, audioTimings, song?.id, currentLineIndex]);

  // Load timing data when song changes
  useEffect(() => {
    if (song && !audioTimings[song.id]) {
      loadTimingData(song.id).then(timings => {
        if (timings.length > 0) {
          setAudioTimings(prev => ({
            ...prev,
            [song.id]: timings
          }));
        }
      });
    }
  }, [song, audioTimings]);

  // Cloud backup functions
  const getCurrentCloudData = useCallback((): DatabaseData => {
    // All annotations are user annotations now (no defaults to filter)
    return {
      annotations,
      notes,
      youtubeLinks,
      loops,
      customLyrics,
      timings: audioTimings,
      scrollSpeeds
    };
  }, [annotations, notes, youtubeLinks, loops, customLyrics, audioTimings, scrollSpeeds]);

  const handleCloudRestore = useCallback((data: DatabaseData) => {
    // Restore all data from cloud
    setNotes(data.notes || {});
    setYoutubeLinks(data.youtubeLinks || {});
    setLoops(data.loops || []);
    setCustomLyrics(data.customLyrics || {});
    setAudioTimings(data.timings || {});
    setScrollSpeeds(data.scrollSpeeds || {});
    
    // Set annotations directly (no defaults to merge)
    setAnnotations(data.annotations || []);
    
    // Save to localStorage
    save(NOTES_KEY, data.notes || {});
    save(YOUTUBE_KEY, data.youtubeLinks || {});
    save(LOOPS_KEY, data.loops || []);
    save(LYRICS_KEY, data.customLyrics || {});
    save('lp-setlist-scroll-speeds', data.scrollSpeeds || {});
    save(STORAGE_KEY, data.annotations || []);
  }, []);

  // Save to database immediately when data changes
  const saveToCloudImmediately = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const data = getCurrentCloudData();
      const result = await saveToDatabase(data);
      if (result.success) {
        console.log('✅ Data saved to cloud database');
        setSaveStatus('saved');
      } else {
        console.warn('⚠️ Cloud save failed, data saved locally:', result.error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.warn('⚠️ Cloud save error:', error);
      setSaveStatus('error');
    }
  }, [getCurrentCloudData]);

  // Auto-backup every 5 minutes if there are changes
  useEffect(() => {
    const interval = setInterval(saveToCloudImmediately, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [saveToCloudImmediately]);

  // Auto-scroll functionality - Updated with proper error handling
  const getCurrentScrollSpeed = useCallback(() => {
    if (!song) return 50; // Default speed
    return scrollSpeeds[song.id] || 50;
  }, [song?.id, scrollSpeeds]); // Stable dependencies

  const setCurrentScrollSpeed = useCallback((speed: number) => {
    if (!song) return;
    setScrollSpeeds(prev => ({
      ...prev,
      [song.id]: speed
    }));
  }, [song?.id, setScrollSpeeds]); // Stable dependencies

  const startAutoScroll = useCallback(() => {
    if (!lyricsRef.current || scrollIntervalRef.current || !song) return;
    
    try {
      setIsAutoScrolling(true);
      const speed = scrollSpeeds[song.id] || 50;
      // Convert speed (1-100) to scroll interval (faster = shorter interval)
      const intervalMs = Math.max(10, 110 - speed);
      
      scrollIntervalRef.current = window.setInterval(() => {
        const container = lyricsRef.current;
        if (container) {
          container.scrollTop += 1; // Scroll 1px at a time for smoothness
        } else {
          // Stop scrolling if container is no longer available
          stopAutoScroll();
        }
      }, intervalMs);
    } catch (error) {
      console.error('Failed to start auto-scroll:', error);
      setIsAutoScrolling(false);
    }
  }, [song?.id, scrollSpeeds]);

  const stopAutoScroll = useCallback(() => {
    try {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      setIsAutoScrolling(false);
    } catch (error) {
      console.error('Failed to stop auto-scroll:', error);
    }
  }, []);

  const resetScroll = () => {
    if (lyricsRef.current) {
      lyricsRef.current.scrollTop = 0;
    }
    setScrollPosition(0);
  };

  // Performance mode auto-scroll functionality - Updated with error handling
  const startPerformanceAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current || !song) return;
    
    try {
      setIsAutoScrolling(true);
      const speed = scrollSpeeds[song.id] || 50;
      // Convert speed (1-100) to pixels per frame (1-5 pixels)
      const pixelsPerFrame = Math.max(0.5, speed / 20);
      
      scrollIntervalRef.current = window.setInterval(() => {
        setScrollPosition(prev => {
          const maxScroll = 10000; // Safety limit
          return Math.min(prev + pixelsPerFrame, maxScroll);
        });
      }, 16); // ~60fps
    } catch (error) {
      console.error('Failed to start performance auto-scroll:', error);
      setIsAutoScrolling(false);
    }
  }, [song?.id, scrollSpeeds]);

  const stopPerformanceAutoScroll = useCallback(() => {
    try {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      setIsAutoScrolling(false);
    } catch (error) {
      console.error('Failed to stop performance auto-scroll:', error);
    }
  }, []);

  const resetPerformanceScroll = () => {
    setScrollPosition(0);
  };

  // Toggle auto-scroll mode - Enhanced with auto-start in performance mode
  const toggleAutoScrollMode = useCallback(() => {
    try {
      const newMode = !autoScrollMode;
      setAutoScrollMode(newMode);
      
      if (!newMode) {
        stopAutoScroll();
        stopPerformanceAutoScroll();
      }
      
      if (newMode) {
        // Reset scroll position when starting
        setScrollPosition(0);
        if (lyricsRef.current) {
          lyricsRef.current.scrollTop = 0;
        }
        
        // In performance mode, automatically start scrolling when enabled
        if (performanceMode) {
          setTimeout(() => {
            setIsAutoScrolling(true);
          }, 100); // Small delay to ensure state is updated
        }
        
        // Entering auto-scroll mode - close other panels except auto-scroll controls
        setShowNotes(false);
        setShowLyricsEditor(false);
        setShowYouTube(false);
        setShowCloudBackup(false);
        setShowAudioSync(false);
      }
    } catch (error) {
      console.error('Failed to toggle auto-scroll mode:', error);
    }
  }, [autoScrollMode, performanceMode, stopAutoScroll, stopPerformanceAutoScroll]); // Removed startPerformanceAutoScroll to avoid circular dependency
  // Clean up auto-scroll on unmount or song change
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // Stop auto-scroll when song changes
  useEffect(() => {
    stopAutoScroll();
    stopPerformanceAutoScroll();
    setScrollPosition(0);
  }, [song?.id]);

  // Notify parent of state changes
  useEffect(() => {
    onPerformanceModeChange?.(performanceMode);
  }, [performanceMode, onPerformanceModeChange]);

  useEffect(() => {
    onAutoScrollModeChange?.(autoScrollMode);
  }, [autoScrollMode, onAutoScrollModeChange]);

  useEffect(() => {
    onAutoScrollingChange?.(isAutoScrolling);
  }, [isAutoScrolling, onAutoScrollingChange]);

  // Expose toggle functions to parent
  useEffect(() => {
    if (onGetToggleFunctions) {
      onGetToggleFunctions({
        togglePerformanceMode,
        toggleAutoScrollMode
      });
    }
  }, [onGetToggleFunctions, togglePerformanceMode, toggleAutoScrollMode]);

  // Load scroll speed for current song
  useEffect(() => {
    if (song) {
      setScrollPosition(0); // Reset scroll position when song changes
    }
  }, [song]);

  useEffect(() => {
    saveToCloudImmediately();
  }, [annotations, notes, youtubeLinks, loops, customLyrics, audioTimings, scrollSpeeds, saveToCloudImmediately]);

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
        
        // Remove all existing annotations in the selected range
        for (let li = startLineIdx; li <= endLineIdx; li++) {
          const offsets = getOffsets(li, li === startLineIdx, li === endLineIdx);
          if (offsets) {
            updated = removeAllOverlap(updated, song.id, offsets.lineIndex, offsets.startOffset, offsets.endOffset);
          }
        }
        
        // Save user annotations to localStorage (no defaults to worry about)
        save(STORAGE_KEY, updated);
        
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
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header - Hidden in performance mode */}
      {!performanceMode && (
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
            onClick={() => {
              // Clear all annotations for debugging
              setAnnotations([]);
              save(STORAGE_KEY, []);
              console.log('All annotations cleared');
            }}
            className="px-3 py-1 font-mono-ui text-xs border border-red-500 text-red-500 hover:bg-red-500/10 transition-none"
            title="Clear all annotations (debug)"
          >
            🗑️ CLEAR ALL
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
            onClick={toggleAutoScrollMode}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              autoScrollMode
                ? "border-orange-500 text-orange-500 bg-orange-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
            title="Auto-scroll mode with speed control"
          >
            📜 AUTO SCROLL
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
          <button
            onClick={() => setShowCloudBackup(!showCloudBackup)}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              showCloudBackup
                ? "border-blue-500 text-blue-500 bg-blue-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
            title="Cloud backup & restore"
          >
            💾 DATABASE
          </button>
          <button
            onClick={() => setShowAudioSync(!showAudioSync)}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              showAudioSync
                ? "border-purple-500 text-purple-500 bg-purple-500/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
            title="Audio sync & timing"
          >
            🎵 AUDIO SYNC
          </button>
          
          {/* Save Status Indicator */}
          <div className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
            saveStatus === 'saved' ? 'border-green-500 text-green-500 bg-green-500/10' :
            saveStatus === 'saving' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
            'border-red-500 text-red-500 bg-red-500/10'
          }`} title={
            saveStatus === 'saved' ? 'All data saved to cloud database' :
            saveStatus === 'saving' ? 'Saving to cloud database...' :
            'Cloud save failed - data saved locally only'
          }>
            {saveStatus === 'saved' ? '✅ SAVED' :
             saveStatus === 'saving' ? '⏳ SAVING' :
             '⚠️ LOCAL ONLY'}
          </div>
        </div>
      </div>
      )}

      {/* YouTube Player - Show in performance mode if timing data exists */}
      {showYouTube && !performanceMode && (
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

      {/* Hidden YouTube Player for performance mode sync */}
      {performanceMode && currentYouTube && audioTimings[song.id]?.length > 0 && (
        <div className="hidden">
          <YouTubePlayer
            youtubeUrl={currentYouTube}
            songTitle={song.title}
            onUrlChange={(url) => setYoutubeLinks((prev) => ({ ...prev, [song.id]: url }))}
            activeLoop={activeLoop}
            onClearLoop={() => setActiveLoop(null)}
            onTimeUpdate={handleYouTubeTimeUpdate}
            onPlayStateChange={handleYouTubePlayStateChange}
          />
        </div>
      )}

      {/* Auto-scroll speed control */}
      {autoScrollMode && !performanceMode && (
        <div className="border-b border-orange-500 bg-orange-500/10 px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-mono-ui text-xs text-orange-500">📜 AUTO SCROLL SPEED:</span>
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
            <span className="font-mono-ui text-xs text-orange-500 ml-2">
              {getCurrentScrollSpeed()}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Speed is saved per song • Use in Performance Mode for smooth scrolling
          </div>
        </div>
      )}

      {/* Auto-scroll control panel */}
      {autoScrollMode && !performanceMode && (
        <div className="border-b border-orange-500 bg-orange-500/5 px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-mono-ui text-xs text-orange-500">📜 AUTO SCROLL:</span>
          
          <div className="flex items-center gap-2">
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
              onClick={resetScroll}
              className="px-3 py-1 font-mono-ui text-xs border border-blue-500 text-blue-500 hover:bg-blue-500/10"
            >
              ⏮️ RESET
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="font-mono-ui text-xs text-muted-foreground">SPEED:</span>
            <input
              type="range"
              min="1"
              max="100"
              value={getCurrentScrollSpeed()}
              onChange={(e) => setCurrentScrollSpeed(Number(e.target.value))}
              className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${getCurrentScrollSpeed()}%, #374151 ${getCurrentScrollSpeed()}%, #374151 100%)`
              }}
            />
            <span className="font-mono-ui text-xs text-orange-500 min-w-[3ch]">
              {getCurrentScrollSpeed()}
            </span>
          </div>
          
          <button
            onClick={() => setAutoScrollMode(false)}
            className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending loop dialog - Hidden in performance mode */}
      {pendingLoop && !performanceMode && (
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

      {/* Editing loop dialog - Hidden in performance mode */}
      {editingLoop && !performanceMode && (
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

      {/* Instruction banner - Hidden in performance mode */}
      {mode === "vocalist" && activeVocalist && !performanceMode && (
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
      {mode === "eraser" && !performanceMode && (
        <div className="px-6 py-2 text-xs font-mono-ui border-b border-border text-destructive bg-muted/30">
          <Eraser size={12} className="inline mr-1" /> Selecione texto para limpar marcações de vocalista.
        </div>
      )}
      {mode === "loop" && !pendingLoop && !performanceMode && (
        <div className="px-6 py-2 text-xs font-mono-ui border-b border-border text-primary bg-muted/30">
          🔁 Selecione um trecho da letra ou clique num título de seção para criar um loop.
        </div>
      )}

      {/* Saved loops bar - Hidden in performance mode */}
      {songLoops.length > 0 && !performanceMode && (
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
        <div className="flex-1 flex flex-col min-h-0">
          {performanceMode ? (
            // Performance Mode - Pure Lyrics with Auto-scroll or Line Navigation
            <div 
              ref={performanceContainerRef}
              className="flex-1 flex items-center justify-center bg-black text-white relative overflow-hidden"
            >
              {autoScrollMode ? (
                // Auto-scroll Mode - Continuous scrolling lyrics
                <div className="w-full h-full relative overflow-hidden">
                  <div 
                    className="absolute w-full transition-transform duration-75 ease-linear"
                    style={{ 
                      transform: `translateY(${-scrollPosition}px)`,
                      paddingTop: '50vh', // Start from center
                      paddingBottom: '50vh' // End at center
                    }}
                  >
                    <div className="w-full max-w-6xl mx-auto px-8">
                      {(() => {
                        const lines = currentLyrics.split("\n");
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
                </div>
              ) : (
                // Line-by-line Mode - Original performance mode
                <div className="w-full h-full flex items-center justify-center p-8">
                <div className="w-full max-w-6xl text-center">
                  {(() => {
                    const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                    const currentLine = lines[currentLineIndex] || "";
                    const nextLine = lines[currentLineIndex + 1] || "";
                    const prevLine = lines[currentLineIndex - 1] || "";
                    const nextLine2 = lines[currentLineIndex + 2] || "";
                    const prevLine2 = lines[currentLineIndex - 2] || "";

                    return (
                      <div className="space-y-4">
                        {/* Previous Line 2 - Very subtle */}
                        {prevLine2 && (
                          <div className="opacity-20 transition-all duration-500">
                            <div className="text-base md:text-lg lg:text-xl text-gray-500 font-light text-center">
                              {(() => {
                                const prevLineIndex2 = currentLineIndex - 2;
                                const segments = getLineSegments(prevLine2, annotations, song.id, prevLineIndex2);
                                return segments.map((seg, si) => (
                                  <PerformanceSegmentSpan key={si} segment={seg} />
                                ));
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Previous Line - More visible with bigger text */}
                        {prevLine && (
                          <div className="opacity-60 transition-all duration-500">
                            <div className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-normal text-center">
                              {(() => {
                                const prevLineIndex = currentLineIndex - 1;
                                const segments = getLineSegments(prevLine, annotations, song.id, prevLineIndex);
                                return segments.map((seg, si) => (
                                  <PerformanceSegmentSpan key={si} segment={seg} />
                                ));
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Current Line - Main Focus with vocalist markings */}
                        <div className="transition-all duration-700">
                          <div className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight text-center mx-auto max-w-full break-words">
                            {currentLine.startsWith("[") && currentLine.endsWith("]") ? (
                              <span className="text-blue-400 text-xl md:text-2xl lg:text-3xl uppercase tracking-wider font-medium block">
                                {currentLine.slice(1, -1)}
                              </span>
                            ) : (
                              // Show lyrics with vocalist annotations
                              <span className="block leading-tight">
                                {(() => {
                                  const segments = getLineSegments(currentLine, annotations, song.id, currentLineIndex);
                                  return segments.map((seg, si) => (
                                    <PerformanceSegmentSpan key={si} segment={seg} />
                                  ));
                                })()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Next Line - More visible with bigger text */}
                        {nextLine && (
                          <div className="opacity-60 transition-all duration-500">
                            <div className="text-xl md:text-2xl lg:text-3xl text-gray-300 font-normal text-center">
                              {(() => {
                                const nextLineIndex = currentLineIndex + 1;
                                const segments = getLineSegments(nextLine, annotations, song.id, nextLineIndex);
                                return segments.map((seg, si) => (
                                  <PerformanceSegmentSpan key={si} segment={seg} />
                                ));
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Next Line 2 - Very subtle */}
                        {nextLine2 && (
                          <div className="opacity-20 transition-all duration-500">
                            <div className="text-base md:text-lg lg:text-xl text-gray-500 font-light text-center">
                              {(() => {
                                const nextLineIndex2 = currentLineIndex + 2;
                                const segments = getLineSegments(nextLine2, annotations, song.id, nextLineIndex2);
                                return segments.map((seg, si) => (
                                  <PerformanceSegmentSpan key={si} segment={seg} />
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              )}

              {/* Exit Button - More visible with higher z-index */}
              <button
                onClick={togglePerformanceMode}
                className="absolute top-4 right-4 w-12 h-12 rounded-full bg-red-600/30 text-red-300 hover:bg-red-600/50 hover:text-white transition-all duration-300 flex items-center justify-center text-xl font-bold border border-red-500/50 z-50"
                title="Exit Performance Mode (ESC)"
              >
                ×
              </button>

              {/* Auto-scroll Toggle Button */}
              <button
                onClick={toggleAutoScrollMode}
                className={`absolute top-4 right-20 w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center text-lg font-bold border z-50 ${
                  autoScrollMode
                    ? "bg-orange-600/30 text-orange-300 hover:bg-orange-600/50 hover:text-white border-orange-500/50"
                    : "bg-gray-600/30 text-gray-300 hover:bg-gray-600/50 hover:text-white border-gray-500/50"
                }`}
                title={autoScrollMode ? "Disable Auto-scroll" : "Enable Auto-scroll"}
              >
                📜
              </button>

              {/* Audio/YouTube/AutoScroll Controls */}
              {(audioControls?.hasAudio || (currentYouTube && audioTimings[song.id]?.length > 0) || autoScrollMode) && (
                <div className="absolute top-4 left-4 flex gap-2 z-40">
                  {/* Audio Controls */}
                  {audioControls?.hasAudio && !autoScrollMode && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            if (audioControls.isPlaying) {
                              audioControls.pause();
                            } else {
                              await audioControls.play();
                            }
                          } catch (error) {
                            console.error('Performance mode audio error:', error);
                          }
                        }}
                        className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 hover:text-white transition-all duration-300 flex items-center justify-center text-lg font-bold border border-blue-500/50"
                        title={audioControls.isPlaying ? "Pause Audio" : "Play Audio"}
                      >
                        {audioControls.isPlaying ? "⏸️" : "▶️"}
                      </button>
                      
                      <button
                        onClick={() => audioControls.setMuted(!audioControls.isMuted)}
                        className="w-12 h-12 rounded-full bg-gray-600/30 text-gray-300 hover:bg-gray-600/50 hover:text-white transition-all duration-300 flex items-center justify-center text-lg font-bold border border-gray-500/50"
                        title="Toggle Mute"
                      >
                        {audioControls.isMuted ? "🔇" : "🔊"}
                      </button>
                    </>
                  )}
                  
                  {/* YouTube Sync Indicator */}
                  {!audioControls?.hasAudio && !autoScrollMode && currentYouTube && audioTimings[song.id]?.length > 0 && (
                    <div className="w-12 h-12 rounded-full bg-red-600/30 text-red-300 border border-red-500/50 flex items-center justify-center text-lg font-bold" title="YouTube Sync Available">
                      ▶️
                    </div>
                  )}
                  
                  {/* Auto-scroll Controls */}
                  {autoScrollMode && (
                    <>
                      <button
                        onClick={isAutoScrolling ? stopPerformanceAutoScroll : startPerformanceAutoScroll}
                        className={`w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center text-lg font-bold border ${
                          isAutoScrolling
                            ? "bg-red-600/30 text-red-300 hover:bg-red-600/50 hover:text-white border-red-500/50"
                            : "bg-green-600/30 text-green-300 hover:bg-green-600/50 hover:text-white border-green-500/50"
                        }`}
                        title={isAutoScrolling ? "Pause Auto-scroll" : "Start Auto-scroll"}
                      >
                        {isAutoScrolling ? "⏸️" : "▶️"}
                      </button>
                      
                      <button
                        onClick={resetPerformanceScroll}
                        className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 hover:text-white transition-all duration-300 flex items-center justify-center text-lg font-bold border border-blue-500/50"
                        title="Reset to Top"
                      >
                        ⏮️
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Auto-scroll Speed Control Overlay - Bottom Center */}
              {autoScrollMode && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
                  <div className="bg-black/80 backdrop-blur-sm border border-orange-500/30 rounded-lg px-4 py-2 flex items-center gap-3">
                    <span className="text-xs text-orange-400 font-mono">
                      {isAutoScrolling ? "AUTO-SCROLL" : "SCROLL READY"}
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={song ? (scrollSpeeds[song.id] || 50) : 50}
                      onChange={(e) => {
                        if (song) {
                          const newSpeed = Number(e.target.value);
                          setScrollSpeeds(prev => ({
                            ...prev,
                            [song.id]: newSpeed
                          }));
                        }
                      }}
                      className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <span className="text-xs text-orange-400 min-w-[2ch]">
                      {song ? (scrollSpeeds[song.id] || 50) : 50}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      🖱️ WHEEL ⚬ CLICK
                    </span>
                  </div>
                </div>
              )}

              {/* Help text - Only visible briefly on hover */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-all duration-300">
                <div className="text-xs text-gray-400 bg-black/70 px-3 py-2 rounded text-center">
                  <div>← → Navigate lines • ESC Exit mode • 📜 Toggle auto-scroll</div>
                  {audioControls?.hasAudio && <div>Audio: Play/Pause • Auto-sync available</div>}
                  {!audioControls?.hasAudio && currentYouTube && audioTimings[song.id]?.length > 0 && (
                    <div>YouTube: Auto-sync with timing data</div>
                  )}
                  {autoScrollMode && (
                    <div>Auto-scroll: Mouse wheel = adjust speed • Middle click = stop</div>
                  )}
                  {!autoScrollMode && (
                    <div>Mouse: Wheel = scroll lyrics • Middle click = start auto-scroll</div>
                  )}
                  <div>Click sides to navigate</div>
                </div>
              </div>

              {/* Invisible click areas for navigation */}
              <div className="absolute inset-0 flex pointer-events-none">
                {/* Left third - Previous line */}
                <div 
                  className="w-1/3 h-full pointer-events-auto cursor-pointer"
                  onClick={() => {
                    const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                    setCurrentLineIndex(prev => Math.max(prev - 1, 0));
                  }}
                  title="Previous line"
                />
                {/* Middle third - No action */}
                <div className="w-1/3 h-full" />
                {/* Right third - Next line */}
                <div 
                  className="w-1/3 h-full pointer-events-auto cursor-pointer"
                  onClick={() => {
                    const lines = currentLyrics.split("\n").filter(line => line.trim() !== "");
                    setCurrentLineIndex(prev => Math.min(prev + 1, lines.length - 1));
                  }}
                  title="Next line"
                />
              </div>

              {/* Auto-scroll speed control in performance mode */}
              {autoScrollMode && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-all duration-300">
                  <div className="bg-black/80 px-4 py-2 rounded flex items-center gap-3">
                    <span className="text-xs text-orange-400">SPEED:</span>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={getCurrentScrollSpeed()}
                      onChange={(e) => setCurrentScrollSpeed(Number(e.target.value))}
                      className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <span className="text-xs text-orange-400 min-w-[2ch]">
                      {getCurrentScrollSpeed()}
                    </span>
                  </div>
                </div>
              )}

              {/* Minimal progress indicator - Show audio or YouTube time */}
              <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 transition-all duration-300 ${
                (audioControls?.hasAudio && audioControls.isPlaying) || 
                (currentYouTube && audioTimings[song.id]?.length > 0) ? 'opacity-100' : 'opacity-0 hover:opacity-100'
              }`}>
                <div className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded flex items-center gap-2">
                  <span>{currentLineIndex + 1} / {currentLyrics.split("\n").filter(line => line.trim() !== "").length}</span>
                  {audioControls?.hasAudio && (
                    <>
                      <span>•</span>
                      <span>Audio: {Math.floor(audioControls.currentTime / 1000 / 60)}:{String(Math.floor(audioControls.currentTime / 1000) % 60).padStart(2, '0')}</span>
                      {audioControls.isPlaying && <span className="animate-pulse">🎵</span>}
                    </>
                  )}
                  {!audioControls?.hasAudio && currentYouTube && audioTimings[song.id]?.length > 0 && (
                    <>
                      <span>•</span>
                      <span>YouTube: {Math.floor(youtubeCurrentTime / 60)}:{String(Math.floor(youtubeCurrentTime) % 60).padStart(2, '0')}</span>
                      <span className="animate-pulse">▶️</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Normal Mode - Fixed Scrolling
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 md:px-10 md:py-8">
                <div className={`${sidebarCollapsed ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`} ref={lyricsRef} onMouseUp={handleMouseUp}>
                  {lines.map((line, i) => {
                    const trimmed = line.trim();
                    const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
                    const isEmpty = trimmed === "";

                    if (isEmpty) return <div key={i} className="h-4" />;

                    if (isSection) {
                      const sectionName = trimmed.slice(1, -1);
                      return (
                        <div
                          key={i}
                          data-line-index={i}
                          className={`mt-8 mb-4 first:mt-0 flex items-center gap-2 ${mode === "loop" ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (mode === "loop") {
                              setPendingLoop({ lineStart: i, lineEnd: i, label: sectionName });
                              setLoopStartInput("0:00");
                              setLoopEndInput("0:30");
                              setLoopLabelInput(sectionName);
                            }
                          }}
                        >
                          <span className={`font-mono-ui text-xs tracking-widest text-primary uppercase bg-primary/10 px-3 py-1 border border-primary/30 rounded ${mode === "loop" ? "hover:bg-primary/20 hover:border-primary/50" : ""}`}>
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
                        className={`font-mono-body text-xl md:text-2xl font-medium leading-relaxed mb-4 ${
                          mode ? "cursor-text select-text" : "cursor-default"
                        } ${inLoop ? "border-l-4 border-primary pl-4 bg-primary/5 rounded-r" : ""}`}
                      >
                        {segments.map((seg, si) => (
                          <SegmentSpan key={si} segment={seg} />
                        ))}
                      </div>
                    );
                  })}
                  <div className="h-32" />
                </div>
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

        {/* Cloud Backup Panel */}
        {showCloudBackup && (
          <div className="w-80 border-l border-border bg-surface flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <span className="font-mono-ui text-xs text-muted-foreground">CLOUD BACKUP</span>
            </div>
            <div className="flex-1 p-4">
              <CloudBackup
                onRestore={handleCloudRestore}
                getCurrentData={getCurrentCloudData}
              />
            </div>
          </div>
        )}

        {/* Audio Sync Panel */}
        {showAudioSync && (
          <div className="w-96 border-l border-border bg-surface flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <span className="font-mono-ui text-xs text-muted-foreground">AUDIO SYNC</span>
            </div>
            <div className="flex-1 p-4">
              <AudioSync
                songId={song.id}
                songTitle={song.title}
                lyrics={getCurrentLyrics()}
                onTimingUpdate={handleTimingUpdate}
                onCurrentLineChange={handleCurrentLineChange}
                currentLineIndex={currentLineIndex}
                onAudioReady={handleAudioReady}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Renders a single segment for performance mode with vocalist colors */
const PerformanceSegmentSpan = ({ segment }: { segment: LineSegment }) => {
  const { text, vocalists } = segment;

  if (vocalists.length === 0) {
    return <span className="text-white">{text}</span>;
  }

  if (vocalists.length === 1) {
    const colors = VOCALIST_COLORS[vocalists[0]];
    // Use brighter colors for performance mode on black background
    const performanceColors = {
      elektra: "text-cyan-300 bg-cyan-500/20",
      chinoda: "text-yellow-300 bg-yellow-500/20", 
      luan: "text-orange-300 bg-orange-500/20"
    };
    return (
      <span className={`${performanceColors[vocalists[0]]} px-1 rounded`}>
        {text}
      </span>
    );
  }

  // Multi-vocalist: enhanced gradient for performance mode
  const bgColors = vocalists.map((v) => VOCALIST_COLORS[v].css);
  const isAllVocalists = vocalists.length === 3;
  
  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${bgColors.join(", ")})`,
    backgroundSize: "100% 4px",
    backgroundPosition: "bottom",
    backgroundRepeat: "no-repeat",
    paddingBottom: "6px",
    color: "white",
    fontWeight: isAllVocalists ? "bold" : "normal",
  };

  return (
    <span className="relative inline-block">
      <span
        className="text-white px-1"
        style={gradientStyle}
      >
        {text}
      </span>
    </span>
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
