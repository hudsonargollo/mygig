// Cloudflare Pages Functions API for D1 Database

interface Env {
  DB: any; // D1Database type
}

// Database schema
const SCHEMA = `
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  vocalist TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS timing_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,
  notes TEXT DEFAULT '{}',
  youtube_links TEXT DEFAULT '{}',
  loops TEXT DEFAULT '[]',
  custom_lyrics TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_annotations_user_song ON annotations(user_id, song_id);
CREATE INDEX IF NOT EXISTS idx_timing_user_song ON timing_data(user_id, song_id);
CREATE INDEX IF NOT EXISTS idx_audio_user_song ON audio_files(user_id, song_id);
`;

// Initialize database
async function initDatabase(env: Env) {
  try {
    await env.DB.exec(SCHEMA);
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

// Get user ID from request
function getUserId(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get('userId') || 'anonymous';
}

// API Routes
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/database', '');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize database on first request
    await initDatabase(env);
    
    switch (path) {
      case '/annotations':
        return handleAnnotations(request, env, corsHeaders);
      case '/audio':
        return handleAudio(request, env, corsHeaders);
      case '/timing':
        return handleTiming(request, env, corsHeaders);
      case '/userdata':
        return handleUserData(request, env, corsHeaders);
      default:
        return new Response(JSON.stringify({ error: 'Not Found', path }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Database API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      path 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle annotations CRUD
async function handleAnnotations(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    const userId = getUserId(request);
    const url = new URL(request.url);
    
    switch (request.method) {
      case 'GET': {
        const songId = url.searchParams.get('songId');
        let query = 'SELECT * FROM annotations WHERE user_id = ?';
        let params = [userId];
        
        if (songId) {
          query += ' AND song_id = ?';
          params.push(songId);
        }
        
        const result = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'POST': {
        const annotations = await request.json();
        
        // Clear existing annotations for this user
        await env.DB.prepare('DELETE FROM annotations WHERE user_id = ?').bind(userId).run();
        
        // Insert new annotations
        for (const ann of annotations) {
          await env.DB.prepare(`
            INSERT INTO annotations (user_id, song_id, line_index, start_offset, end_offset, vocalist)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(userId, ann.songId, ann.lineIndex, ann.startOffset, ann.endOffset, ann.vocalist).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Annotations handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Annotations operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle audio files
async function handleAudio(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    const userId = getUserId(request);
    const url = new URL(request.url);
    
    switch (request.method) {
      case 'GET': {
        const songId = url.searchParams.get('songId');
        let query = 'SELECT * FROM audio_files WHERE user_id = ?';
        let params = [userId];
        
        if (songId) {
          query += ' AND song_id = ?';
          params.push(songId);
        }
        
        const result = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'POST': {
        const { songId, fileName, fileSize, mimeType } = await request.json();
        
        const result = await env.DB.prepare(`
          INSERT INTO audio_files (user_id, song_id, file_name, file_size, mime_type)
          VALUES (?, ?, ?, ?, ?)
        `).bind(userId, songId, fileName, fileSize, mimeType).run();
        
        return new Response(JSON.stringify({ id: result.meta?.last_row_id, success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Audio handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Audio operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle timing data
async function handleTiming(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    const userId = getUserId(request);
    const url = new URL(request.url);
    
    switch (request.method) {
      case 'GET': {
        const songId = url.searchParams.get('songId');
        if (!songId) {
          return new Response(JSON.stringify({ error: 'songId required' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await env.DB.prepare(`
          SELECT * FROM timing_data WHERE user_id = ? AND song_id = ? ORDER BY line_index
        `).bind(userId, songId).all();
        
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'POST': {
        const timingData = await request.json();
        const { songId, timings } = timingData;
        
        if (!songId || !timings) {
          return new Response(JSON.stringify({ error: 'songId and timings required' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Clear existing timing data
        await env.DB.prepare('DELETE FROM timing_data WHERE user_id = ? AND song_id = ?')
          .bind(userId, songId).run();
        
        // Insert new timing data
        for (const timing of timings) {
          await env.DB.prepare(`
            INSERT INTO timing_data (user_id, song_id, line_index, timestamp_ms)
            VALUES (?, ?, ?, ?)
          `).bind(userId, songId, timing.lineIndex, timing.timestampMs).run();
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Timing handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'Timing operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle user data (notes, youtube links, etc.)
async function handleUserData(request: Request, env: Env, corsHeaders: Record<string, string>) {
  try {
    const userId = getUserId(request);
    
    switch (request.method) {
      case 'GET': {
        const result = await env.DB.prepare('SELECT * FROM user_data WHERE user_id = ?').bind(userId).first();
        
        if (!result) {
          return new Response(JSON.stringify({
            notes: {},
            youtube_links: {},
            loops: [],
            custom_lyrics: {}
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          notes: JSON.parse(result.notes as string || '{}'),
          youtube_links: JSON.parse(result.youtube_links as string || '{}'),
          loops: JSON.parse(result.loops as string || '[]'),
          custom_lyrics: JSON.parse(result.custom_lyrics as string || '{}')
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'POST': {
        const data = await request.json();
        
        await env.DB.prepare(`
          INSERT OR REPLACE INTO user_data (user_id, notes, youtube_links, loops, custom_lyrics, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          userId,
          JSON.stringify(data.notes || {}),
          JSON.stringify(data.youtube_links || {}),
          JSON.stringify(data.loops || []),
          JSON.stringify(data.custom_lyrics || {})
        ).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('UserData handler error:', error);
    return new Response(JSON.stringify({ 
      error: 'UserData operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}