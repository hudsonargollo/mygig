import { useState } from "react";

interface YouTubePlayerProps {
  youtubeUrl: string;
  onUrlChange: (url: string) => void;
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

const YouTubePlayer = ({ youtubeUrl, onUrlChange }: YouTubePlayerProps) => {
  const [editing, setEditing] = useState(!youtubeUrl);
  const [input, setInput] = useState(youtubeUrl);
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null;

  const handleSave = () => {
    onUrlChange(input.trim());
    setEditing(false);
  };

  if (editing || !videoId) {
    return (
      <div className="border-b border-border p-4 bg-surface">
        <div className="flex items-center gap-2">
          <span className="font-mono-ui text-xs text-muted-foreground shrink-0">YOUTUBE</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Cole o link do YouTube aqui..."
            className="flex-1 bg-transparent border border-border px-2 py-1 font-mono-ui text-xs text-foreground focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleSave}
            className="px-3 py-1 font-mono-ui text-xs border border-primary text-primary hover:bg-primary/10"
          >
            OK
          </button>
          {youtubeUrl && (
            <button
              onClick={() => { setEditing(false); setInput(youtubeUrl); }}
              className="px-3 py-1 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="font-mono-ui text-xs text-muted-foreground">▶ YOUTUBE</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto px-2 py-0.5 font-mono-ui text-xs border border-border text-muted-foreground hover:text-accent"
        >
          EDIT
        </button>
        <button
          onClick={() => { onUrlChange(""); setInput(""); setEditing(true); }}
          className="px-2 py-0.5 font-mono-ui text-xs border border-border text-muted-foreground hover:text-destructive"
        >
          ✕
        </button>
      </div>
      <div className="aspect-video w-full max-h-[240px]">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube player"
        />
      </div>
    </div>
  );
};

export default YouTubePlayer;
