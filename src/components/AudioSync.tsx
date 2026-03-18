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
  // Performance mode integration
  onAudioReady?: (audioControls: AudioControls) => void;
}

export interface AudioControls {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (timeMs: number) => void;
  setMuted: (muted: boolean) => void;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  hasAudio: boolean;
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
  currentLineIndex,
  onAudioReady
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

  // Expose audio controls to parent component
  useEffect(() => {
    if (onAudioReady && audioRef.current) {
      console.log('AudioSync: Setting up audio controls', { audioFile: !!audioFile, isPlaying, isMuted });
      const audioControls: AudioControls = {
        play: async () => {
          const audio = audioRef.current;
          console.log('AudioControls: play() called', { audio: !!audio });
          if (!audio) return;
          try {
            await audio.play();
            console.log('AudioControls: play() successful');
            setIsPlaying(true);
          } catch (error) {
            console.error('Audio play error:', error);
            setIsPlaying(false);
          }
        },
        pause: () => {
          const audio = audioRef.current;
          console.log('AudioControls: pause() called', { audio: !!audio });
          if (!audio) return;
          audio.pause();
          setIsPlaying(false);
        },
        seekTo: (timeMs: number) => {
          if (audioRef.current) {
            audioRef.current.currentTime = timeMs / 1000;
            setCurrentTime(timeMs);
          }
        },
        setMuted: (muted: boolean) => {
          if (audioRef.current) {
            audioRef.current.muted = muted;
            setIsMuted(muted);
          }
        },
        isPlaying,
        isMuted,
        currentTime,
        duration,
        hasAudio: !!audioFile
      };
      onAudioReady(audioControls);
    }
  }, [onAudioReady, audioFile, isPlaying, isMuted, currentTime, duration]);

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

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [isPlaying, timings, currentLineIndex, onCurrentLineChange]);

  // Playback controls
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setMessage({ type: 'error', text: 'Failed to play audio. Check browser permissions.' });
      setIsPlaying(false);
    }
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
    console.log('AI Generation: Starting...', { lines: lines.length, duration, audioFile: !!audioFile });
    setIsGeneratingAI(true);
    setMessage({ type: 'success', text: 'Generating AI timestamps... This may take a moment.' });

    try {
      const audio = audioRef.current;
      
      // Ensure we have duration
      let audioDuration = duration;
      if (!audioDuration && audio && audio.duration) {
        audioDuration = audio.duration * 1000;
        setDuration(audioDuration);
      }
      
      // If still no duration, use a reasonable default based on lyrics count
      if (!audioDuration) {
        // Estimate ~3-4 seconds per line as a baseline
        audioDuration = lines.length * 3500;
        console.log('AI Generation: Using estimated duration', audioDuration);
        setMessage({ 
          type: 'success', 
          text: `Using estimated duration (${Math.round(audioDuration/1000)}s). Upload audio file for better accuracy.` 
        });
      }

      const linesCount = lines.length;
      
      if (linesCount === 0) {
        throw new Error('No lyrics available to generate timestamps for');
      }
      
      console.log('AI Generation: Processing', linesCount, 'lines with duration', audioDuration);
      
      // Improved AI-like algorithm
      const generatedTimings: TimingData[] = [];
      let currentTime = 0;
      
      for (let i = 0; i < linesCount; i++) {
        const line = lines[i].trim();
        
        // Base timing calculation
        let lineInterval = audioDuration / linesCount;
        
        // Adjust timing based on line content
        if (line.startsWith('[') && line.endsWith(']')) {
          // Section headers - add pause before and shorter duration
          if (i > 0) currentTime += lineInterval * 0.3; // Pause before section
          lineInterval *= 0.5; // Shorter duration for section header
        } else if (line.length === 0) {
          // Empty lines - minimal time
          lineInterval *= 0.1;
        } else if (line.length > 60) {
          // Long lines - more time
          lineInterval *= 1.3;
        } else if (line.length < 20) {
          // Short lines - less time
          lineInterval *= 0.8;
        }
        
        // Add some natural variation (±15%)
        const variation = (Math.random() - 0.5) * lineInterval * 0.3;
        currentTime += variation;
        
        generatedTimings.push({
          lineIndex: i,
          timestampMs: Math.max(0, Math.round(currentTime))
        });
        
        currentTime += lineInterval;
      }
      
      console.log('AI Generation: Generated', generatedTimings.length, 'timings');
      setTimings(generatedTimings);
      onTimingUpdate(generatedTimings);
      setMessage({ 
        type: 'success', 
        text: `Generated ${generatedTimings.length} AI timestamps (${Math.round(audioDuration/1000)}s total). Review and adjust as needed.` 
      });
      
    } catch (error) {
      console.error('AI timestamp generation failed:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to generate AI timestamps: ${error.message}. Try uploading an audio file for better accuracy.` 
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