import { useState, useCallback, useEffect, useRef } from "react";
import { Eraser, Pencil } from "lucide-react";
import type { Song } from "@/data/songs";
import YouTubePlayer, { formatTime, parseTime } from "./YouTubePlayer";
import type { LoopRegion } from "./YouTubePlayer";

type Vocalist = "elektra" | "chinoda" | "luan";
type VocalistOrNull = Vocalist | null;

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
const LOOPS_KEY = "lp-setlist-loops";

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
  elektra: "L",
  chinoda: "H",
  luan: "Lu",
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

const LyricViewer = ({ song, songIndex }: LyricViewerProps) => {
  const [annotations, setAnnotations] = useState<TextAnnotation[]>(() => load(STORAGE_KEY, []));
  const [activeVocalist, setActiveVocalist] = useState<VocalistOrNull>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => load(NOTES_KEY, {}));
  const [showNotes, setShowNotes] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>(() => load(YOUTUBE_KEY, {}));
  const [loops, setLoops] = useState<LoopRegion[]>(() => load(LOOPS_KEY, []));
  const [activeLoop, setActiveLoop] = useState<LoopRegion | null>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [pendingLoop, setPendingLoop] = useState<{ lineStart: number; lineEnd: number; label: string } | null>(null);
  const [editingLoop, setEditingLoop] = useState<LoopRegion | null>(null);
  const [loopStartInput, setLoopStartInput] = useState("0:00");
  const [loopEndInput, setLoopEndInput] = useState("0:30");
  const [loopLabelInput, setLoopLabelInput] = useState("");
  const [eraserMode, setEraserMode] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const mode: InteractionMode = eraserMode ? "eraser" : loopMode ? "loop" : activeVocalist ? "vocalist" : null;

  useEffect(() => { save(STORAGE_KEY, annotations); }, [annotations]);
  useEffect(() => { save(NOTES_KEY, notes); }, [notes]);
  useEffect(() => { save(YOUTUBE_KEY, youtubeLinks); }, [youtubeLinks]);
  useEffect(() => { save(LOOPS_KEY, loops); }, [loops]);

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
          newAnnotations.push({ songId: song.id, lineIndex: offsets.lineIndex, startOffset: offsets.startOffset, endOffset: offsets.endOffset, vocalist: activeVocalist });
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
      setAnnotations((prev) =>
        prev.filter((a) => !(a.songId === song.id && a.lineIndex === lineIndex))
      );
    },
    [song]
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

  const lines = song.lyrics.split("\n");
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
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wide text-foreground leading-none mt-1">
            {song.title.toUpperCase()}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["elektra", "chinoda", "luan"] as const).map((v) => {
            const labels: Record<Vocalist, string> = { elektra: "LADY", chinoda: "HUDS", luan: "LUAN" };
            const colorKey: Record<Vocalist, string> = { elektra: "cyan", chinoda: "yellow", luan: "orange" };
            const c = colorKey[v];
            return (
              <button
                key={v}
                onClick={() => toggleVocalist(v)}
                className={`px-3 py-1 font-mono-ui text-xs border transition-none ${
                  activeVocalist === v
                    ? `border-${c} text-${c} bg-${c}/10`
                    : "border-border text-muted-foreground hover:text-accent"
                }`}
              >
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
        </div>
      </div>

      {/* YouTube Player */}
      {showYouTube && (
        <YouTubePlayer
          youtubeUrl={currentYouTube}
          songTitle={song.title}
          onUrlChange={(url) => setYoutubeLinks((prev) => ({ ...prev, [song.id]: url }))}
          activeLoop={activeLoop}
          onClearLoop={() => setActiveLoop(null)}
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
        <div className={`px-6 py-2 text-xs font-mono-ui border-b border-border ${VOCALIST_COLORS[activeVocalist].text} bg-muted/30`}>
          ✎ Selecione texto para marcar como{" "}
          {activeVocalist === "elektra" ? "LADY" : activeVocalist === "chinoda" ? "HUDS" : "LUAN"}.
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
        <div className="flex-1 overflow-y-auto p-6 md:px-10 md:py-6">
          <div className="max-w-3xl" ref={lyricsRef} onMouseUp={handleMouseUp}>
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
                  className={`font-mono-body text-base md:text-lg leading-7 ${
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

  // Multi-vocalist: show with gradient underline and vocalist initials
  const bgColors = vocalists.map((v) => VOCALIST_COLORS[v].css);
  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${bgColors.join(", ")})`,
    backgroundSize: "100% 2px",
    backgroundPosition: "bottom",
    backgroundRepeat: "no-repeat",
    paddingBottom: "3px",
  };

  return (
    <span className="relative inline-flex items-baseline gap-0">
      <span
        className="text-foreground px-0.5"
        style={gradientStyle}
      >
        {text}
      </span>
      <span className="inline-flex gap-px ml-0.5 self-end translate-y-[-1px]">
        {vocalists.map((v) => (
          <span
            key={v}
            className="font-mono-ui leading-none select-none"
            style={{
              fontSize: "7px",
              color: VOCALIST_COLORS[v].css,
              opacity: 0.9,
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
