// Lyrics Import Helper
// This file helps you import complete lyrics from your sources

export interface LyricsImportTemplate {
  id: string;
  number: number;
  title: string;
  placeholder: string;
}

// Complete setlist structure based on your HTML file
export const SETLIST_TEMPLATE: LyricsImportTemplate[] = [
  { id: "somewhere-i-belong", number: 1, title: "Somewhere I Belong", placeholder: "Add complete lyrics from your source" },
  { id: "the-emptiness-machine", number: 2, title: "The Emptiness Machine", placeholder: "Add complete lyrics from your source" },
  { id: "lying-from-you", number: 3, title: "Lying from You", placeholder: "Add complete lyrics from your source" },
  { id: "points-of-authority", number: 4, title: "Points of Authority", placeholder: "Add complete lyrics from your source" },
  { id: "in-the-end", number: 5, title: "In the End", placeholder: "Add complete lyrics from your source" },
  { id: "faint", number: 6, title: "Faint", placeholder: "Add complete lyrics from your source" },
  { id: "crawling", number: 7, title: "Crawling", placeholder: "Add complete lyrics from your source" },
  { id: "new-divide", number: 8, title: "New Divide", placeholder: "Add complete lyrics from your source" },
  { id: "burn-it-down", number: 9, title: "Burn It Down", placeholder: "Add complete lyrics from your source" },
  { id: "what-ive-done", number: 10, title: "What I've Done", placeholder: "Add complete lyrics from your source" },
  { id: "numb", number: 11, title: "Numb", placeholder: "Add complete lyrics from your source" },
  { id: "one-step-closer", number: 12, title: "One Step Closer", placeholder: "Add complete lyrics from your source" },
  { id: "breaking-the-habit", number: 13, title: "Breaking the Habit", placeholder: "Add complete lyrics from your source" },
  { id: "castle-of-glass", number: 14, title: "Castle of Glass", placeholder: "Add complete lyrics from your source" },
  { id: "waiting-for-the-end", number: 15, title: "Waiting for the End", placeholder: "Add complete lyrics from your source" },
  { id: "papercut", number: 16, title: "Papercut", placeholder: "Add complete lyrics from your source" },
  { id: "bleed-it-out", number: 17, title: "Bleed It Out", placeholder: "Add complete lyrics from your source" },
  { id: "given-up", number: 18, title: "Given Up", placeholder: "Add complete lyrics from your source" },
  { id: "over-each-other", number: 19, title: "Over Each Other", placeholder: "Add complete lyrics from your source" },
  { id: "no-more-sorrow", number: 20, title: "No More Sorrow", placeholder: "Add complete lyrics from your source" },
  { id: "from-the-inside", number: 21, title: "From the Inside", placeholder: "Add complete lyrics from your source" },
  { id: "key-to-the-kingdom", number: 22, title: "Key to the Kingdom", placeholder: "Add complete lyrics from your source" },
  { id: "heavy-is-the-crown", number: 23, title: "Heavy Is the Crown", placeholder: "Add complete lyrics from your source" },
  { id: "lost", number: 24, title: "Lost", placeholder: "Add complete lyrics from your source" },
  { id: "leave-out-all-the-rest", number: 25, title: "Leave Out All the Rest", placeholder: "Add complete lyrics from your source" },
  { id: "two-faced", number: 26, title: "Two Faced", placeholder: "Add complete lyrics from your source" },
  { id: "the-catalyst", number: 27, title: "The Catalyst", placeholder: "Add complete lyrics from your source" },
  { id: "friendly-fire", number: 28, title: "Friendly Fire", placeholder: "Add complete lyrics from your source" }
];

// Helper function to generate song object template
export const generateSongTemplate = (template: LyricsImportTemplate): string => {
  return `  {
    id: "${template.id}",
    number: ${template.number},
    title: "${template.title}",
    lyrics: \`[Verse 1]

${template.placeholder}

[Chorus]

${template.placeholder}

[Verse 2]

${template.placeholder}

[Chorus]

${template.placeholder}

[Bridge]

${template.placeholder}

[Chorus]

${template.placeholder}\`
  }`;
};