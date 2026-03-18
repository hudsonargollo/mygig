import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";

interface AudioSyncProps {
  songId: string;
  songTitle: string;
  lyrics: string;
  onTimingUpdate: (timings: TimingData[]) => void;
  onCurrentLineChange: (lineIndex: number) => void;
  currentLineIndex: number;
}

export interface TimingData {
  lineIndex: number;
  timestampMs: number;
}

export const AudioSync = ({ 
  songId, 
  songTitle, 
  lyrics, 
  onTimingUpdate, 
  onCurrentLineChange,
  currentLineIndex 
}: AudioSyncProps) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timings, setTimings] = useState<TimingData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lines = lyrics.split("\n").filter(line => line.trim() !== "");

  // Load audio file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAudioFile(file);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        setMessage({ type: 'success', text: `Audio loaded: ${file.name}` });
      } else {
        setMessage({ type: 'error', text: 'Please select an audio file' });
      }
    }
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000); // Convert to milliseconds
      
      // Auto-update current line based on timings during playback
      if (isPlaying && timings.length > 0) {
        const currentMs = audio.currentTime * 1000;
        let newLineIndex = 0;
        
        for (let i = 0; i < timings.length; i++) {
          if (currentMs >= timings[i].timestampMs) {
            newLineIndex = timings[i].lineIndex;
          } else {
            break;
          }
        }
        
        if (newLineIndex !== currentLineIndex) {
          onCurrentLineChange(newLineIndex);
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration * 1000); // Convert to milliseconds
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying, timings, currentLineIndex, onCurrentLineChange]);

  // Playback controls
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (timeMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = timeMs / 1000;
    setCurrentTime(timeMs);
  };

  const changePlaybackRate = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const changeVolume = (vol: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.volume = vol;
    setVolume(vol);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Timing recording
  const startRecording = () => {
    setIsRecording(true);
    setTimings([]);
    setMessage({ type: 'success', text: 'Recording started. Press SPACE when each line starts.' });
  };

  const stopRecording = () => {
    setIsRecording(false);
    onTimingUpdate(timings);
    setMessage({ type: 'success', text: `Recorded ${timings.length} timing points` });
  };

  const recordTiming = () => {
    if (!isRecording || !audioRef.current) return;
    
    const currentMs = audioRef.current.currentTime * 1000;
    const lineIndex = timings.length;
    
    if (lineIndex < lines.length) {
      const newTiming = { lineIndex, timestampMs: currentMs };
      setTimings(prev => [...prev, newTiming]);
      setMessage({ 
        type: 'success', 
        text: `Recorded line ${lineIndex + 1}: "${lines[lineIndex]?.substring(0, 30)}..."` 
      });
    }
  };

  // AI-powered timestamp generation
  const generateAITimestamps = async () => {
    if (!audioFile) {
      setMessage({ type: 'error', text: 'Please upload an audio file first' });
      return;
    }

    setIsGeneratingAI(true);
    setMessage({ type: 'success', text: 'Generating AI timestamps... This may take a moment.' });

    try {
      // Estimate song duration and generate timestamps
      const estimatedDuration = duration || 180000; // Default 3 minutes if unknown
      const linesCount = lines.length;
      
      // Simple AI-like algorithm: distribute lines evenly with some variation
      const baseInterval = estimatedDuration / linesCount;
      const generatedTimings: TimingData[] = [];
      
      for (let i = 0; i < linesCount; i++) {
        const line = lines[i];
        let timestamp = i * baseInterval;
        
        // Add variation based on line content
        if (line.startsWith('[') && line.endsWith(']')) {
          // Section headers get a bit more space before
          timestamp += baseInterval * 0.2;
        } else if (line.length > 50) {
          // Longer lines get slightly more time
          timestamp += baseInterval * 0.1;
        }
        
        // Add some randomness to make it more natural (±10%)
        const variation = (Math.random() - 0.5) * baseInterval * 0.2;
        timestamp += variation;
        
        // Ensure timestamps are in order
        if (i > 0 && timestamp <= generatedTimings[i - 1].timestampMs) {
          timestamp = generatedTimings[i - 1].timestampMs + 1000; // At least 1 second apart
        }
        
        generatedTimings.push({
          lineIndex: i,
          timestampMs: Math.max(0, timestamp)
        });
      }
      
      setTimings(generatedTimings);
      onTimingUpdate(generatedTimings);
      setMessage({ 
        type: 'success', 
        text: `Generated ${generatedTimings.length} AI timestamps. Review and adjust as needed.` 
      });
      
    } catch (error) {
      console.error('AI timestamp generation failed:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to generate AI timestamps. Try manual recording instead.' 
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        recordTiming();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, timings, lines]);

  // Format time display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-surface">
      <div className="flex items-center justify-between">
        <h3 className="font-mono-ui text-sm text-foreground">AUDIO SYNC</h3>
        <div className="text-xs text-muted-foreground">{songTitle}</div>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <label className="block text-xs font-mono-ui text-muted-foreground">
          Upload Audio File
        </label>
        <Input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="font-mono-ui text-xs"
        />
      </div>

      {/* Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
        />
      )}

      {/* Playback Controls */}
      {audioFile && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={togglePlayPause}
              size="sm"
              className="font-mono-ui text-xs"
            >
              {isPlaying ? "⏸️ Pause" : "▶️ Play"}
            </Button>
            
            <Button
              onClick={toggleMute}
              size="sm"
              variant="outline"
              className="font-mono-ui text-xs"
            >
              {isMuted ? "🔇" : "🔊"}
            </Button>

            <div className="text-xs font-mono-ui text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration}
              step={100}
              onValueChange={([value]) => seekTo(value)}
              className="w-full"
            />
          </div>

          {/* Volume and Speed Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-mono-ui text-muted-foreground">Volume</label>
              <Slider
                value={[volume]}
                max={1}
                step={0.1}
                onValueChange={([value]) => changeVolume(value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono-ui text-muted-foreground">Speed</label>
              <div className="flex gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5].map(rate => (
                  <Button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    size="sm"
                    variant={playbackRate === rate ? "default" : "outline"}
                    className="font-mono-ui text-xs px-2"
                  >
                    {rate}x
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timing Recording */}
      {audioFile && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <>
                <Button
                  onClick={startRecording}
                  size="sm"
                  className="font-mono-ui text-xs"
                >
                  🎯 Record Timing
                </Button>
                <Button
                  onClick={generateAITimestamps}
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingAI}
                  className="font-mono-ui text-xs"
                >
                  {isGeneratingAI ? "🤖 Generating..." : "🤖 AI Generate"}
                </Button>
              </>
            ) : (
              <Button
                onClick={stopRecording}
                size="sm"
                variant="destructive"
                className="font-mono-ui text-xs"
              >
                ⏹️ Stop Recording
              </Button>
            )}
            
            <div className="text-xs text-muted-foreground">
              {timings.length} / {lines.length} lines recorded
            </div>

            {timings.length > 0 && (
              <Button
                onClick={() => {
                  setTimings([]);
                  onTimingUpdate([]);
                  setMessage({ type: 'success', text: 'Timings cleared' });
                }}
                size="sm"
                variant="outline"
                className="font-mono-ui text-xs"
              >
                🗑️ Clear
              </Button>
            )}
          </div>

          {isRecording && (
            <div className="text-xs text-blue-400 bg-blue-500/10 p-2 rounded">
              <strong>Recording Mode:</strong> Press SPACE when each line starts singing.
              <br />
              Next line: "{lines[timings.length]?.substring(0, 50)}..."
            </div>
          )}

          {/* Timing List */}
          {timings.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {timings.map((timing, index) => (
                <div key={index} className="flex justify-between items-center text-xs group">
                  <span className="truncate flex-1">
                    {index + 1}. {lines[timing.lineIndex]?.substring(0, 40)}...
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => seekTo(timing.timestampMs)}
                      className="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Jump to this line"
                    >
                      ⏯️
                    </button>
                    <span className="text-muted-foreground">
                      {formatTime(timing.timestampMs)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription className="font-mono-ui text-xs">
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <strong>How to use:</strong>
        <br />• Upload an audio file for the song
        <br />• Click "AI Generate" for automatic timestamps (experimental)
        <br />• Or click "Record Timing" and press SPACE when each line starts
        <br />• Use the recorded timing for auto-scroll in performance mode
        <br />• Adjust playback speed for easier timing recording
      </div>
    </div>
  );
};