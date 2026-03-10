import { useState, useCallback, useEffect } from "react";
import type { Song } from "@/data/songs";

type Vocalist = "elektra" | "chinoda" | null;

interface Annotation {
  songId: string;
  lineIndex: number;
  vocalist: Vocalist;
}

interface LyricViewerProps {
  song: Song | null;
  songIndex: number;
}

const STORAGE_KEY = "lp-setlist-annotations";
const NOTES_KEY = "lp-setlist-notes";

const loadAnnotations = (): Annotation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveAnnotations = (annotations: Annotation[]) => {
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

const LyricViewer = ({ song, songIndex }: LyricViewerProps) => {
  const [annotations, setAnnotations] = useState<Annotation[]>(loadAnnotations);
  const [activeVocalist, setActiveVocalist] = useState<Vocalist>(null);
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    saveAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const handleLineClick = useCallback(
    (lineIndex: number) => {
      if (!song || !activeVocalist) return;

      setAnnotations((prev) => {
        const existing = prev.findIndex(
          (a) => a.songId === song.id && a.lineIndex === lineIndex
        );

        if (existing >= 0) {
          const current = prev[existing];
          // If same vocalist, remove annotation
          if (current.vocalist === activeVocalist) {
            return prev.filter((_, i) => i !== existing);
          }
          // Otherwise, change vocalist
          const updated = [...prev];
          updated[existing] = { ...current, vocalist: activeVocalist };
          return updated;
        }

        return [...prev, { songId: song.id, lineIndex, vocalist: activeVocalist }];
      });
    },
    [song, activeVocalist]
  );

  const getLineAnnotation = useCallback(
    (lineIndex: number): Vocalist => {
      if (!song) return null;
      const ann = annotations.find(
        (a) => a.songId === song.id && a.lineIndex === lineIndex
      );
      return ann?.vocalist ?? null;
    },
    [song, annotations]
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

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Header */}
      <div className="border-b border-border p-6 flex items-end justify-between shrink-0">
        <div>
          <span className="font-mono-ui text-xs text-muted-foreground">
            TRACK {String(songIndex + 1).padStart(2, "0")}
          </span>
          <h1 className="font-display text-5xl md:text-7xl tracking-wide text-foreground leading-none mt-1">
            {song.title.toUpperCase()}
          </h1>
        </div>
        <div className="flex gap-2">
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

      <div className="flex flex-1 min-h-0">
        {/* Lyrics */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-3xl">
            {lines.map((line, i) => {
              const trimmed = line.trim();
              const isSection = trimmed.startsWith("[") && trimmed.endsWith("]");
              const isEmpty = trimmed === "";
              const annotation = getLineAnnotation(i);

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

              return (
                <div
                  key={i}
                  onClick={() => handleLineClick(i)}
                  className={`
                    font-mono-body text-sm md:text-base leading-8 py-0.5
                    ${activeVocalist ? "cursor-pointer" : "cursor-default"}
                    ${
                      annotation === "elektra"
                        ? "text-cyan bg-cyan/5"
                        : annotation === "chinoda"
                        ? "text-yellow bg-yellow/5"
                        : "text-foreground"
                    }
                    ${activeVocalist && !annotation ? "hover:bg-muted/30" : ""}
                  `}
                >
                  {trimmed}
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
