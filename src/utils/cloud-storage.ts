// Database service for Cloudflare D1
export interface DatabaseData {
  annotations: any[];
  notes: Record<string, string>;
  youtubeLinks: Record<string, string>;
  loops: any[];
  customLyrics: Record<string, string>;
  timings: Record<string, TimingData[]>;
  scrollSpeeds?: Record<string, number>;
}

export interface TimingData {
  lineIndex: number;
  timestampMs: number;
}

// Generate a unique user ID based on browser fingerprint
const getUserId = (): string => {
  let userId = localStorage.getItem('gigsprompter-user-id');
  if (!userId) {
    // Create a simple fingerprint based on screen, timezone, and random
    const fingerprint = [
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      Math.random().toString(36).substr(2, 9)
    ].join('-');
    userId = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substr(0, 16);
    localStorage.setItem('gigsprompter-user-id', userId);
  }
  return userId;
};

const API_BASE = '/api/database';

// Save data to D1 database with better error handling
export const saveToDatabase = async (data: DatabaseData): Promise<{ success: boolean; error?: string }> => {
  try {
    const userId = getUserId();
    
    // Save all data in parallel for better performance
    const savePromises = [
      // Save annotations
      fetch(`${API_BASE}/annotations?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.annotations)
      }),
      
      // Save user data (notes, youtube links, etc.)
      fetch(`${API_BASE}/userdata?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: data.notes,
          youtube_links: data.youtubeLinks,
          loops: data.loops,
          custom_lyrics: data.customLyrics,
          scroll_speeds: data.scrollSpeeds || {}
        })
      })
    ];

    // Save timing data for each song
    for (const [songId, timings] of Object.entries(data.timings)) {
      if (timings.length > 0) {
        savePromises.push(
          fetch(`${API_BASE}/timing?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId, timings })
          })
        );
      }
    }

    const responses = await Promise.all(savePromises);
    
    // Check if all requests succeeded
    const failedResponses = responses.filter(r => !r.ok);
    if (failedResponses.length > 0) {
      const errorDetails = await Promise.all(
        failedResponses.map(async r => {
          try {
            const errorData = await r.json();
            return `${r.status}: ${errorData.error || errorData.message || 'Unknown error'}`;
          } catch {
            return `${r.status}: ${r.statusText}`;
          }
        })
      );
      throw new Error(`Database save failed: ${errorDetails.join(', ')}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to save to database:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
};

// Load data from D1 database
export const loadFromDatabase = async (): Promise<{ success: boolean; data?: DatabaseData; error?: string }> => {
  try {
    const userId = getUserId();
    
    // Load annotations
    const annotationsResponse = await fetch(`${API_BASE}/annotations?userId=${userId}`);
    const annotations = await annotationsResponse.json();
    
    // Load user data
    const userDataResponse = await fetch(`${API_BASE}/userdata?userId=${userId}`);
    const userData = await userDataResponse.json();
    
    // Load timing data (we'll need to get all songs)
    const timings: Record<string, TimingData[]> = {};
    // For now, we'll load timing data on demand per song
    
    const data: DatabaseData = {
      annotations: annotations || [],
      notes: userData.notes || {},
      youtubeLinks: userData.youtube_links || {},
      loops: userData.loops || [],
      customLyrics: userData.custom_lyrics || {},
      timings,
      scrollSpeeds: userData.scroll_speeds || {}
    };

    return { success: true, data };
  } catch (error) {
    console.error('Failed to load from database:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Load timing data for a specific song
export const loadTimingData = async (songId: string): Promise<TimingData[]> => {
  try {
    const userId = getUserId();
    const response = await fetch(`${API_BASE}/timing?userId=${userId}&songId=${songId}`);
    const timings = await response.json();
    
    return timings.map((t: any) => ({
      lineIndex: t.line_index,
      timestampMs: t.timestamp_ms
    }));
  } catch (error) {
    console.error('Failed to load timing data:', error);
    return [];
  }
};

// Save timing data for a specific song
export const saveTimingData = async (songId: string, timings: TimingData[]): Promise<boolean> => {
  try {
    const userId = getUserId();
    await fetch(`${API_BASE}/timing?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, timings })
    });
    return true;
  } catch (error) {
    console.error('Failed to save timing data:', error);
    return false;
  }
};

// Get user backup ID (for sharing)
export const getBackupId = (): string | null => {
  return getUserId();
};

// Set backup ID (for restoring from shared ID)
export const setBackupId = (userId: string): void => {
  localStorage.setItem('gigsprompter-user-id', userId);
};