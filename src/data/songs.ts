export interface Song {
  id: string;
  number: number;
  title: string;
  lyrics: string;
}

// Voice annotation interface for default markings
export interface VoiceAnnotation {
  songId: string;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  vocalist: 'elektra' | 'chinoda' | 'luan';
}

// Default voice annotations based on HTML structure
export const DEFAULT_VOICE_ANNOTATIONS: VoiceAnnotation[] = [
  // Add voice annotations here following the HTML pattern
  // Example: { songId: "somewhere-i-belong", lineIndex: 0, startOffset: 0, endOffset: 15, vocalist: "elektra" }
];

export const songs: Song[] = [
  {
    id: "somewhere-i-belong",
    number: 1,
    title: "Somewhere I Belong",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML:
- Giulia (elektra): Lead vocals, emotional parts
- Hudson (chinoda): Rap sections, backing vocals  
- Everyone: Chorus parts together]`
  },
  {
    id: "the-emptiness-machine",
    number: 2,
    title: "The Emptiness Machine",
    lyrics: `[Note: Add complete lyrics here with voice divisions:
- Hudson (chinoda): "Your blades are sharpened with precision..."
- Giulia (elektra): "Gave up who I am for who you wanted me to be"
- Everyone: "Falling for the promise of the emptiness machine"]`
  },
  {
    id: "lying-from-you",
    number: 3,
    title: "Lying from You",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "points-of-authority",
    number: 4,
    title: "Points of Authority",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "in-the-end",
    number: 5,
    title: "In the End",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "faint",
    number: 6,
    title: "Faint",
    lyrics: `[Note: Add complete lyrics here with voice divisions:
- Hudson (chinoda): "I am a little bit of loneliness, a little bit of disregard"
- Giulia (elektra): "I can't feel the way I did before / Don't turn your back on me / I won't be ignored"
- Everyone: "I WON'T BE IGNORED!"]`
  },
  {
    id: "crawling",
    number: 7,
    title: "Crawling",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "new-divide",
    number: 8,
    title: "New Divide",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "burn-it-down",
    number: 9,
    title: "Burn It Down",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "what-ive-done",
    number: 10,
    title: "What I've Done",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "numb",
    number: 11,
    title: "Numb",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "one-step-closer",
    number: 12,
    title: "One Step Closer",
    lyrics: `[Note: Add complete lyrics here with voice divisions:
- Hudson (chinoda): "I cannot take this anymore..."
- Giulia (elektra): "'Cause I am one step closer to the edge / And I'm about to break!"
- Hudson (chinoda): "SHUT UP WHEN I'M TALKING TO YOU!"
- Everyone: "SHUT UP! SHUT UP! SHUT UP!"]`
  },
  {
    id: "breaking-the-habit",
    number: 13,
    title: "Breaking the Habit",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "castle-of-glass",
    number: 14,
    title: "Castle of Glass",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "waiting-for-the-end",
    number: 15,
    title: "Waiting for the End",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "papercut",
    number: 16,
    title: "Papercut",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "bleed-it-out",
    number: 17,
    title: "Bleed It Out",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "given-up",
    number: 18,
    title: "Given Up",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "over-each-other",
    number: 19,
    title: "Over Each Other",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "no-more-sorrow",
    number: 20,
    title: "No More Sorrow",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "from-the-inside",
    number: 21,
    title: "From the Inside",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "key-to-the-kingdom",
    number: 22,
    title: "Key to the Kingdom",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "heavy-is-the-crown",
    number: 23,
    title: "Heavy Is the Crown",
    lyrics: `[Note: Add complete lyrics here with voice divisions:
- Giulia (elektra): "This is what you asked for, this is what you get / Heavy is the crown, but it's never gonna fit"
- Hudson (chinoda): "Today's the day that you're gonna find"
- Everyone: "HEAVY IS THE CROWN!"]`
  },
  {
    id: "lost",
    number: 24,
    title: "Lost",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "leave-out-all-the-rest",
    number: 25,
    title: "Leave Out All the Rest",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "two-faced",
    number: 26,
    title: "Two Faced",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "the-catalyst",
    number: 27,
    title: "The Catalyst",
    lyrics: `[Note: Add complete lyrics here with voice divisions from HTML]`
  },
  {
    id: "friendly-fire",
    number: 28,
    title: "Friendly Fire",
    lyrics: `[Note: Add complete lyrics here with voice divisions:
- Giulia (elektra): "Waiting for the fire to die out..."
- Hudson (chinoda): "We're pulling a trigger in a sky full of stars"
- Everyone: "Why are we fighting for? It's just friendly fire"]`
  }
];