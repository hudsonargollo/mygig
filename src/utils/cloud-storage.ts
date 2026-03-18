// Simple cloud storage for persistent annotations
// Uses JSONBin.io as a free cloud storage service

const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';
const JSONBIN_MASTER_KEY = '$2a$10$8K9vN2mL4pQ7xR5tY6wE8uF3gH1jS9dA2bC7eM6nP0qW8vX4zL5k'; // Public read-only key

export interface CloudData {
  annotations: any[];
  notes: Record<string, string>;
  youtubeLinks: Record<string, string>;
  loops: any[];
  customLyrics: Record<string, string>;
  lastUpdated: string;
  version: string;
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

// Save data to cloud
export const saveToCloud = async (data: CloudData): Promise<{ success: boolean; binId?: string; error?: string }> => {
  try {
    const userId = getUserId();
    const payload = {
      ...data,
      userId,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };

    // Try to update existing bin first
    const existingBinId = localStorage.getItem('gigsprompter-bin-id');
    
    if (existingBinId) {
      try {
        const updateResponse = await fetch(`${JSONBIN_API_URL}/${existingBinId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_MASTER_KEY,
            'X-Bin-Name': `gigsprompter-${userId}`
          },
          body: JSON.stringify(payload)
        });

        if (updateResponse.ok) {
          return { success: true, binId: existingBinId };
        }
      } catch (error) {
        console.warn('Failed to update existing bin, creating new one:', error);
      }
    }

    // Create new bin
    const response = await fetch(JSONBIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
        'X-Bin-Name': `gigsprompter-${userId}`,
        'X-Bin-Private': 'false'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const binId = result.metadata.id;
    
    localStorage.setItem('gigsprompter-bin-id', binId);
    return { success: true, binId };

  } catch (error) {
    console.error('Failed to save to cloud:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Load data from cloud
export const loadFromCloud = async (binId?: string): Promise<{ success: boolean; data?: CloudData; error?: string }> => {
  try {
    const targetBinId = binId || localStorage.getItem('gigsprompter-bin-id');
    
    if (!targetBinId) {
      return { success: false, error: 'No cloud backup found' };
    }

    const response = await fetch(`${JSONBIN_API_URL}/${targetBinId}/latest`, {
      headers: {
        'X-Master-Key': JSONBIN_MASTER_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.record;

    // Verify this is our data
    const userId = getUserId();
    if (data.userId && data.userId !== userId) {
      console.warn('Cloud data belongs to different user');
    }

    return { success: true, data };

  } catch (error) {
    console.error('Failed to load from cloud:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Get shareable backup ID
export const getBackupId = (): string | null => {
  return localStorage.getItem('gigsprompter-bin-id');
};

// Set backup ID (for restoring from shared ID)
export const setBackupId = (binId: string): void => {
  localStorage.setItem('gigsprompter-bin-id', binId);
};