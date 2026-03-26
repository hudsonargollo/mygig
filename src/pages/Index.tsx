import { useState, useCallback, useEffect } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import SetlistSidebar from "@/components/SetlistSidebar";
import LyricViewerSimple from "@/components/LyricViewerSimple";
import { songs as initialSongs } from "@/data/songs";
import type { Song } from "@/data/songs";

const SETLIST_ORDER_KEY = "lp-setlist-order";

const loadOrder = (): Song[] => {
  try {
    const stored = localStorage.getItem(SETLIST_ORDER_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      const ordered = ids
        .map((id) => initialSongs.find((s) => s.id === id))
        .filter(Boolean) as Song[];
      // Add any new songs not in stored order
      const missing = initialSongs.filter((s) => !ids.includes(s.id));
      return [...ordered, ...missing];
    }
  } catch {
    // fallthrough
  }
  return initialSongs;
};

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<Song[]>(loadOrder);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id ?? null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true); // Auto-collapse sidebar on mobile
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Performance and auto-scroll state
  const [performanceMode, setPerformanceMode] = useState(false);
  const [autoScrollMode, setAutoScrollMode] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  
  // Store toggle functions from LyricViewer
  const [toggleFunctions, setToggleFunctions] = useState<{
    togglePerformanceMode: () => void;
    toggleAutoScrollMode: () => void;
    toggleNotes: () => void;
    toggleVocalistMode: () => void;
    toggleYouTube: () => void;
    toggleLoopMode: () => void;
    toggleAudioSync: () => void;
    toggleBackup: () => void;
  } | null>(null);

  const handleLoadingComplete = useCallback(() => {
    setLoading(false);
    setSelectedSongId(songs[0]?.id ?? null);
  }, [songs]);

  const handleReorder = useCallback((newSongs: Song[]) => {
    setSongs(newSongs);
    localStorage.setItem(SETLIST_ORDER_KEY, JSON.stringify(newSongs.map((s) => s.id)));
  }, []);

  const handleSongChange = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = songs.findIndex(s => s.id === selectedSongId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(songs.length - 1, currentIndex + 1);
    }
    
    setSelectedSongId(songs[newIndex].id);
  }, [songs, selectedSongId]);

  const handleTogglePerformanceMode = useCallback(() => {
    toggleFunctions?.togglePerformanceMode();
  }, [toggleFunctions]);

  const handleToggleAutoScroll = useCallback(() => {
    toggleFunctions?.toggleAutoScrollMode();
  }, [toggleFunctions]);

  // Callback handlers to sync state from LyricViewer
  const handlePerformanceModeChange = useCallback((enabled: boolean) => {
    setPerformanceMode(enabled);
  }, []);

  const handleAutoScrollModeChange = useCallback((enabled: boolean) => {
    setAutoScrollMode(enabled);
  }, []);

  const handleAutoScrollingChange = useCallback((scrolling: boolean) => {
    setIsAutoScrolling(scrolling);
  }, []);

  // Handle receiving toggle functions from LyricViewer
  const handleGetToggleFunctions = useCallback((functions: {
    togglePerformanceMode: () => void;
    toggleAutoScrollMode: () => void;
    toggleNotes: () => void;
    toggleVocalistMode: () => void;
    toggleYouTube: () => void;
    toggleLoopMode: () => void;
    toggleAudioSync: () => void;
    toggleBackup: () => void;
  }) => {
    setToggleFunctions(functions);
  }, []);

  const selectedSong = songs.find((s) => s.id === selectedSongId) ?? null;
  const selectedIndex = songs.findIndex((s) => s.id === selectedSongId);

  if (loading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background relative">
      {/* Mobile Hamburger Menu Button */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-4 right-4 z-50 w-12 h-12 bg-surface border border-border rounded-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors md:hidden"
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-1">
            <div className={`w-5 h-0.5 bg-current transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 bg-current transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 bg-current transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
        </button>
      )}

      {/* Lyrics - Full width on mobile, left side on desktop */}
      <div className={`flex-1 ${isMobile ? 'w-full' : ''}`}>
        <LyricViewerSimple 
          song={selectedSong} 
          songIndex={selectedIndex}
          onSidebarToggle={() => {
            if (isMobile) {
              setMobileMenuOpen(prev => !prev);
            } else {
              setSidebarCollapsed(prev => !prev);
            }
          }}
          sidebarCollapsed={isMobile ? !mobileMenuOpen : sidebarCollapsed}
          onSongChange={handleSongChange}
          totalSongs={songs.length}
          onGetToggleFunctions={handleGetToggleFunctions}
          onPerformanceModeChange={handlePerformanceModeChange}
          onAutoScrollModeChange={handleAutoScrollModeChange}
          onAutoScrollingChange={handleAutoScrollingChange}
        />
      </div>

      {/* Setlist Sidebar - Overlay on mobile, right side on desktop */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 right-0 z-40 w-80 transform transition-transform duration-300 ${
              mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`
          : `transition-all duration-300 h-full overflow-hidden ${
              sidebarCollapsed ? 'w-16' : 'w-1/4 min-w-[240px] max-w-[360px]'
            }`
        }
      `}>
        <SetlistSidebar
          songs={songs}
          selectedSongId={selectedSongId}
          onSelectSong={(id) => {
            setSelectedSongId(id);
            if (isMobile) {
              setMobileMenuOpen(false); // Close menu after selection on mobile
            }
          }}
          onReorder={handleReorder}
          onToggleCollapse={() => {
            if (isMobile) {
              setMobileMenuOpen(prev => !prev);
            } else {
              setSidebarCollapsed(prev => !prev);
            }
          }}
          isCollapsed={isMobile ? false : sidebarCollapsed}
          onSongChange={handleSongChange}
          onTogglePerformanceMode={handleTogglePerformanceMode}
          performanceMode={performanceMode}
          onToggleAutoScroll={handleToggleAutoScroll}
          autoScrollMode={autoScrollMode}
          isAutoScrolling={isAutoScrolling}
          onShowAudioSync={() => toggleFunctions?.toggleAudioSync()}
          onShowNotes={() => toggleFunctions?.toggleNotes()}
          onToggleVocalistMode={() => toggleFunctions?.toggleVocalistMode()}
          onShowBackup={() => toggleFunctions?.toggleBackup()}
          onShowPageBreaks={() => {
            // This function doesn't exist in LyricViewer, keeping as placeholder
            console.log('Page breaks toggled');
          }}
          onShowYouTube={() => toggleFunctions?.toggleYouTube()}
          onToggleLoopMode={() => toggleFunctions?.toggleLoopMode()}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;
