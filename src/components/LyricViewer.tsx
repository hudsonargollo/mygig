import { useState, useCallback, useEffect, useRef } from "react";
import type { Song } from "@/data/songs";
import YouTubePlayer from "./YouTubePlayer";

type Vocalist = "elektra" | "chinoda" | "luan" | null;

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
}

const STORAGE_KEY = "lp-setlist-annotations-v2";
const NOTES_KEY = "lp-setlist-notes";
const YOUTUBE_KEY = "lp-setlist-youtube";

const loadAnnotations = (): TextAnnotation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveAnnotations = (annotations: TextAnnotation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
};

const loadNotes = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(NOTES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveNotes = (notes: Record<string, string>) => {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

const loadYouTubeLinks = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(YOUTUBE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveYouTubeLinks = (links: Record<string, string>) => {
  localStorage.setItem(YOUTUBE_KEY, JSON.stringify(links));
};

const VOCALIST_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  elektra: { text: "text-cyan", bg: "bg-cyan/15", border: "border-cyan" },
  chinoda: { text: "text-yellow", bg: "bg-yellow/15", border: "border-yellow" },
  luan: { text: "text-orange", bg: "bg-orange/15", border: "border-orange" },
};

// Merge overlapping annotations for the same vocalist, split for different
const getLineSegments = (
  text: string,
  annotations: TextAnnotation[],
  songId: string,
  lineIndex: number
) => {
  const lineAnns = annotations.filter(
    (a) => a.songId === songId && a.lineIndex === lineIndex
  );

  if (lineAnns.length === 0) {
    return [{ text, vocalist: null as Vocalist, start: 0, end: text.length }];
  }

  // Build a character-level vocalist map
  const charMap: (Vocalist)[] = new Array(text.length).fill(null);
  for (const ann of lineAnns) {
    for (let i = ann.startOffset; i < ann.endOffset && i < text.length; i++) {
      charMap[i] = ann.vocalist;
    }
  }

  // Merge into segments
  const segments: { text: string; vocalist: Vocalist; start: number; end: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const v = charMap[i];
    let j = i;
    while (j < text.length && charMap[j] === v) j++;
    segments.push({ text: text.slice(i, j), vocalist: v, start: i, end: j });
    i = j;
  }
  return segments;
};

const LyricViewer = ({ song, songIndex }: LyricViewerProps) => {
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(loadAnnotations);
  const [activeVocalist, setActiveVocalist] = useState<Vocalist>(null);
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [showNotes, setShowNotes] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>(loadYouTubeLinks);
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  useEffect(() => {
    saveYouTubeLinks(youtubeLinks);
  }, [youtubeLinks]);

  const handleMouseUp = useCallback(() => {
    if (!song || !activeVocalist) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = lyricsRef.current;
    if (!container || !container.contains(range.startContainer) || !container.contains(range.endContainer)) return;

    // Find the lyric line elements involved
    const startLine = range.startContainer.parentElement?.closest("[data-line-index]");
    const endLine = range.endContainer.parentElement?.closest("[data-line-index]");

    if (!startLine || !endLine) return;

    const startLineIdx = parseInt(startLine.getAttribute("data-line-index") || "-1");
    const endLineIdx = parseInt(endLine.getAttribute("data-line-index") || "-1");

    if (startLineIdx < 0 || endLineIdx < 0) return;

    const newAnnotations: TextAnnotation[] = [];

    for (let li = startLineIdx; li <= endLineIdx; li++) {
      const lineEl = container.querySelector(`[data-line-index="${li}"]`);
      if (!lineEl) continue;

      const lineText = lineEl.textContent || "";
      let startOffset = 0;
      let endOffset = lineText.length;

      if (li === startLineIdx) {
        // Calculate start offset within this line
        const preRange = document.createRange();
        preRange.selectNodeContents(lineEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        startOffset = preRange.toString().length;
      }
      if (li === endLineIdx) {
        const preRange = document.createRange();
        preRange.selectNodeContents(lineEl);
        preRange.setEnd(range.endContainer, range.endOffset);
        endOffset = preRange.toString().length;
      }

      if (startOffset < endOffset) {
        newAnnotations.push({
          songId: song.id,
          lineIndex: li,
          startOffset,
          endOffset,
          vocalist: activeVocalist,
        });
      }
    }

    if (newAnnotations.length > 0) {
      setAnnotations((prev) => {
        // Remove overlapping annotations for these ranges
        let updated = [...prev];
        for (const newAnn of newAnnotations) {
          updated = removeOverlap(updated, newAnn);
          updated.push(newAnn);
        }
        return updated;
      });
    }

    selection.removeAllRanges();
  }, [song, activeVocalist]);

  // Remove or split existing annotations that overlap with a new one
  const removeOverlap = (existing: TextAnnotation[], newAnn: TextAnnotation): TextAnnotation[] => {
    const result: TextAnnotation[] = [];
    for (const ann of existing) {
      if (ann.songId !== newAnn.songId || ann.lineIndex !== newAnn.lineIndex) {
        result.push(ann);
        continue;
      }
      // Check overlap
      if (ann.endOffset <= newAnn.startOffset || ann.startOffset >= newAnn.endOffset) {
        result.push(ann);
        continue;
      }
      // Partial overlaps - keep non-overlapping parts
      if (ann.startOffset < newAnn.startOffset) {
        result.push({ ...ann, endOffset: newAnn.startOffset });
      }
      if (ann.endOffset > newAnn.endOffset) {
        result.push({ ...ann, startOffset: newAnn.endOffset });
      }
    }
    return result;
  };

  const clearLineAnnotations = useCallback(
    (lineIndex: number) => {
      if (!song) return;
      setAnnotations((prev) =>
        prev.filter((a) => !(a.songId === song.id && a.lineIndex === lineIndex))
      );
    },
    [song]
  );

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-mono-body text-sm">
          <span className="inline-block w-[2px] h-4 bg-muted-foreground animate-pulse" />
        </div>
      </div>
    );
  }

  const lines = song.lyrics.split("\n");
  const currentNote = notes[song.id] || "";
  const currentYouTube = youtubeLinks[song.id] || "";

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Header */}
      <div className="border-b border-border p-6 flex items-end justify-between shrink-0 flex-wrap gap-2">
        <div>
          <span className="font-mono-ui text-xs text-muted-foreground">
            TRACK {String(songIndex + 1).padStart(2, "0")}
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wide text-foreground leading-none mt-1">
            {song.title.toUpperCase()}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveVocalist(activeVocalist === "elektra" ? null : "elektra")}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              activeVocalist === "elektra"
                ? "border-cyan text-cyan bg-cyan/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            LADY ELEKTRA
          </button>
          <button
            onClick={() => setActiveVocalist(activeVocalist === "chinoda" ? null : "chinoda")}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              activeVocalist === "chinoda"
                ? "border-yellow text-yellow bg-yellow/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            HUDS CHINODA
          </button>
          <button
            onClick={() => setActiveVocalist(activeVocalist === "luan" ? null : "luan")}
            className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
              activeVocalist === "luan"
                ? "border-orange text-orange bg-orange/10"
                : "border-border text-muted-foreground hover:text-accent"
            }`}
          >
            LUAN DELSON
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
        </div>
      </div>

      {/* YouTube Player */}
      {showYouTube && (
        <YouTubePlayer
          youtubeUrl={currentYouTube}
          songTitle={song.title}
          onUrlChange={(url) =>
            setYoutubeLinks((prev) => ({ ...prev, [song.id]: url }))
          }
        />
      )}

      {/* Instruction banner */}
      {activeVocalist && (
        <div
          className={`px-6 py-2 text-xs font-mono-ui border-b border-border ${
            VOCALIST_COLORS[activeVocalist].text
          } bg-muted/30`}
        >
          ✎ Selecione texto nas letras para marcar como{" "}
          {activeVocalist === "elektra"
            ? "LADY ELEKTRA"
            : activeVocalist === "chinoda"
            ? "HUDS CHINODA"
            : "LUAN DELSON"}
          . Clique duplo numa linha para limpar marcações.
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Lyrics */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-3xl" ref={lyricsRef} onMouseUp={handleMouseUp}>
            {lines.map((line, i) => {
              const trimmed = line.trim();
              const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
              const isEmpty = trimmed === "";

              if (isEmpty) {
                return <div key={i} className="h-4" />;
              }

              if (isSection) {
                return (
                  <div
                    key={i}
                    className="font-display text-2xl tracking-wider text-primary mt-8 mb-3 first:mt-0"
                  >
                    {trimmed}
                  </div>
                );
              }

              const segments = getLineSegments(trimmed, annotations, song.id, i);

              return (
                <div
                  key={i}
                  data-line-index={i}
                  onDoubleClick={() => clearLineAnnotations(i)}
                  className={`font-mono-body text-sm md:text-base leading-8 py-0.5 ${
                    activeVocalist ? "cursor-text select-text" : "cursor-default"
                  }`}
                >
                  {segments.map((seg, si) => {
                    const colors = seg.vocalist
                      ? VOCALIST_COLORS[seg.vocalist]
                      : null;
                    return (
                      <span
                        key={si}
                        className={
                          colors
                            ? `${colors.text} ${colors.bg} px-0.5`
                            : "text-foreground"
                        }
                      >
                        {seg.text}
                      </span>
                    );
                  })}
                </div>
              );
            })}
            <div className="h-20" />
          </div>
        </div>

        {/* Notes panel */}
        {showNotes && (
          <div className="w-80 border-l border-border bg-surface flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <span className="font-mono-ui text-xs text-muted-foreground">NOTES</span>
            </div>
            <textarea
              value={currentNote}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [song.id]: e.target.value }))
              }
              placeholder=""
              className="flex-1 bg-transparent text-foreground font-mono-body text-sm p-4 resize-none focus:outline-none placeholder:text-transparent"
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricViewer;
