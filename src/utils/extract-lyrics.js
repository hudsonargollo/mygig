// Lyrics extraction utility for your HTML file
// Run this in browser console on your lyrics.html file to extract all lyrics

function extractLyricsFromHTML() {
  const songs = [];
  const sections = document.querySelectorAll('.song-section');
  
  sections.forEach((section, index) => {
    const title = section.querySelector('h1')?.textContent?.trim();
    const id = section.id;
    const number = index + 1;
    
    // Extract all paragraph text content
    const paragraphs = section.querySelectorAll('p:not(.inst)');
    const lyricsLines = [];
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text && !text.startsWith('[') && !text.endsWith(']')) {
        lyricsLines.push(text);
      }
    });
    
    if (title && id) {
      songs.push({
        id: id.replace('s', '').padStart(2, '0'), // Convert s1 to 01, etc.
        number: number,
        title: title,
        lyrics: lyricsLines.join('\n\n')
      });
    }
  });
  
  return songs;
}

// Usage: Open lyrics.html in browser, open console, run extractLyricsFromHTML()
console.log('Run extractLyricsFromHTML() to get song data');