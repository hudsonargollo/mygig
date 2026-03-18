// Template for adding complete lyrics
// Replace the placeholder sections with actual lyrics from your sources

export const COMPLETE_LYRICS_TEMPLATE = {
  "somewhere-i-belong": {
    sections: [
      "[Verse 1]",
      "// Add complete verse 1 lyrics here",
      "",
      "[Chorus]", 
      "// Add complete chorus lyrics here",
      "",
      "[Verse 2]",
      "// Add complete verse 2 lyrics here", 
      "",
      "[Chorus]",
      "// Repeat chorus",
      "",
      "[Bridge]",
      "// Add bridge lyrics here",
      "",
      "[Chorus]",
      "// Final chorus",
      "",
      "[Outro]",
      "// Add outro lyrics here"
    ]
  },
  // Add templates for other songs...
};

// Helper function to convert template to lyrics string
export const templateToLyrics = (template: string[]): string => {
  return template.join('\n');
};