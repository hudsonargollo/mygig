import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface LoopRegion {
  id: string;
  songId: string;
  label: string;
  startTime: number;
  endTime: number;
  lineStart: number;
  lineEnd: number;
}

interface YouTubePlayerProps {
  youtubeUrl: string;
  onUrlChange: (url: string) => void;
  songTitle?: string;
  activeLoop: LoopRegion | null;
  onClearLoop: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const parseTime = (str: string): number => {
  const parts = str.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 1) return parts[0] || 0;
  return 0;
};

let apiLoaded = false;
let apiLoading = false;
const loadYTApi = (): Promise<void> => {
  if (apiLoaded) return Promise.resolve();
  if (apiLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (apiLoaded) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  apiLoading = true;
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiLoading = false;
      prev?.();
      resolve();
    };
    document.head.appendChild(tag);
  });
};

const YouTubePlayer = ({
  youtubeUrl,
  onUrlChange,
  songTitle,
  activeLoop,
  onClearLoop,
  onTimeUpdate,
  onPlayStateChange,
}: YouTubePlayerProps) => {
  const [editing, setEditing] = useState(!youtubeUrl);
  const [input, setInput] = useState(youtubeUrl);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loopIntervalRef = useRef<number | null>(null);
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  // Load YT API and create player
  useEffect(() => {
    if (!videoId) return;

    let player: any = null;

    const initPlayer = async () => {
      await loadYTApi();
      if (!containerRef.current) return;

      // Create a div for the player
      const el = document.createElement("div");
      el.id = "yt-player-" + Date.now();
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(el);

      player = new window.YT.Player(el.id, {
        videoId,
        height: "100%",
        width: "100%",
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            playerRef.current = e.target;
            setDuration(e.target.getDuration());
          },
          onStateChange: (e: any) => {
            const playing = e.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
            onPlayStateChange?.(playing);
            if (playing) {
              setDuration(e.target.getDuration());
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Time tracking + loop enforcement
  useEffect(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }

    if (!playerRef.current) return;

    loopIntervalRef.current = window.setInterval(() => {
      if (!playerRef.current) return;
      try {
        const t = playerRef.current.getCurrentTime?.();
        if (typeof t === "number") {
          setCurrentTime(t);
          onTimeUpdate?.(t);

          // Enforce loop
          if (activeLoop && isPlaying) {
            if (t >= activeLoop.endTime || t < activeLoop.startTime - 0.5) {
              playerRef.current.seekTo(activeLoop.startTime, true);
            }
          }
        }
      } catch {}
    }, 250);

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
    };
  }, [activeLoop, isPlaying]);

  // When loop changes, seek to start
  useEffect(() => {
    if (activeLoop && playerRef.current) {
      playerRef.current.seekTo(activeLoop.startTime, true);
      playerRef.current.playVideo();
    }
  }, [activeLoop?.id]);

  const handleSave = () => {
    onUrlChange(input.trim());
    setEditing(false);
  };

  const handleSearch = () => {
    const query = encodeURIComponent(`${songTitle || ""} Linkin Park`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank");
  };

  if (editing || !videoId) {
    return (
      <div className="border-b border-border p-4 bg-surface">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono-ui text-xs text-muted-foreground shrink-0">YOUTUBE</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Cole o link do YouTube aqui..."
            className="flex-1 min-w-[200px] bg-transparent border border-border px-2 py-1 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary"
          />
          <button onClick={handleSave} className="px-3 py-1 font-mono-ui text-xs border border-primary text-primary hover:bg-primary/10">OK</button>
          <button onClick={handleSearch} className="px-3 py-1 font-mono-ui text-xs border border-destructive text-destructive hover:bg-destructive/10">🔍 BUSCAR</button>
          {youtubeUrl && (
            <button onClick={() => { setEditing(false); setInput(youtubeUrl); }} className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent">✕</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="font-mono-ui text-xs text-muted-foreground">▶ YOUTUBE</span>
        <span className="font-mono-ui text-xs text-foreground ml-2">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {activeLoop && (
          <span className="font-mono-ui text-xs text-primary ml-2 flex items-center gap-1">
            🔁 LOOP: {formatTime(activeLoop.startTime)} → {formatTime(activeLoop.endTime)}
            <button
              onClick={onClearLoop}
              className="ml-1 text-destructive hover:text-accent"
              title="Parar loop"
            >
              ✕
            </button>
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setEditing(true)} className="px-2 py-0.5 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent">EDIT</button>
          <button onClick={() => { onUrlChange(""); setInput(""); setEditing(true); }} className="px-2 py-0.5 font-mono-ui text-xs border border-border text-muted-foreground hover:text-destructive">✕</button>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[200px]" />
    </div>
  );
};

export default YouTubePlayer;
export { formatTime, parseTime };
