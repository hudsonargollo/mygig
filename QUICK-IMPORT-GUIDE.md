# Quick Lyrics Import for Tribute Concert

## Method 1: Browser Console Extraction

1. **Open your `lyrics/lyrics.html` file in a web browser**
2. **Open Developer Tools** (F12 or right-click → Inspect)
3. **Go to Console tab**
4. **Copy and paste this code:**

```javascript
function extractLyricsFromHTML() {
  const songs = [];
  const sections = document.querySelectorAll('.song-section');
  
  sections.forEach((section) => {
    const title = section.querySelector('h1')?.textContent?.trim();
    const id = section.id;
    
    // Extract all text content
    const paragraphs = section.querySelectorAll('p:not(.inst)');
    const lyricsLines = [];
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        lyricsLines.push(text);
      }
    });
    
    if (title && id && lyricsLines.length > 0) {
      console.log(`"${id}": \`${lyricsLines.join('\\n\\n')}\`,`);
    }
  });
}

extractLyricsFromHTML();
```

5. **Copy the output** and use it to update your songs.ts file

## Method 2: Manual Copy-Paste

1. Open `lyrics/lyrics.html` 
2. For each song section, copy the lyrics text
3. Paste into the corresponding song in `src/data/songs.ts`

## Method 3: Text File Approach

1. Save each song's lyrics as individual .txt files
2. I can help create an import script to load them all at once

## Voice Markings Ready

Once you add the complete lyrics, the voice divisions will automatically work:
- 🎤 Giulia parts (white/black text in your HTML)
- 🎙️ Hudson parts (red text in your HTML)  
- 🎶 Everyone parts (blue text in your HTML)

The system is ready - just need the complete lyrics content!