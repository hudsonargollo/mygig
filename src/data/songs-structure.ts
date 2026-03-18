// Song structure based on HTML setlist - technical implementation only
// This file defines the song order and IDs without reproducing copyrighted content

export interface SongStructure {
  id: string;
  number: number;
  title: string;
  hasVoiceDivisions: boolean;
}

export const SETLIST_STRUCTURE: SongStructure[] = [
  { id: "somewhere-i-belong", number: 1, title: "Somewhere I Belong", hasVoiceDivisions: true },
  { id: "the-emptiness-machine", number: 2, title: "The Emptiness Machine", hasVoiceDivisions: true },
  { id: "lying-from-you", number: 3, title: "Lying from You", hasVoiceDivisions: false },
  { id: "points-of-authority", number: 4, title: "Points of Authority", hasVoiceDivisions: false },
  { id: "in-the-end", number: 5, title: "In the End", hasVoiceDivisions: false },
  { id: "faint", number: 6, title: "Faint", hasVoiceDivisions: true },
  { id: "crawling", number: 7, title: "Crawling", hasVoiceDivisions: false },
  { id: "new-divide", number: 8, title: "New Divide", hasVoiceDivisions: false },
  { id: "burn-it-down", number: 9, title: "Burn It Down", hasVoiceDivisions: false },
  { id: "what-ive-done", number: 10, title: "What I've Done", hasVoiceDivisions: false },
  { id: "numb", number: 11, title: "Numb", hasVoiceDivisions: false },
  { id: "one-step-closer", number: 12, title: "One Step Closer", hasVoiceDivisions: true },
  { id: "breaking-the-habit", number: 13, title: "Breaking the Habit", hasVoiceDivisions: false },
  { id: "castle-of-glass", number: 14, title: "Castle of Glass", hasVoiceDivisions: false },
  { id: "waiting-for-the-end", number: 15, title: "Waiting for the End", hasVoiceDivisions: false },
  { id: "papercut", number: 16, title: "Papercut", hasVoiceDivisions: false },
  { id: "bleed-it-out", number: 17, title: "Bleed It Out", hasVoiceDivisions: false },
  { id: "given-up", number: 18, title: "Given Up", hasVoiceDivisions: false },
  { id: "over-each-other", number: 19, title: "Over Each Other", hasVoiceDivisions: false },
  { id: "no-more-sorrow", number: 20, title: "No More Sorrow", hasVoiceDivisions: false },
  { id: "from-the-inside", number: 21, title: "From the Inside", hasVoiceDivisions: false },
  { id: "key-to-the-kingdom", number: 22, title: "Key to the Kingdom", hasVoiceDivisions: false },
  { id: "heavy-is-the-crown", number: 23, title: "Heavy Is the Crown", hasVoiceDivisions: true },
  { id: "lost", number: 24, title: "Lost", hasVoiceDivisions: false },
  { id: "leave-out-all-the-rest", number: 25, title: "Leave Out All the Rest", hasVoiceDivisions: false },
  { id: "two-faced", number: 26, title: "Two Faced", hasVoiceDivisions: false },
  { id: "the-catalyst", number: 27, title: "The Catalyst", hasVoiceDivisions: false },
  { id: "friendly-fire", number: 28, title: "Friendly Fire", hasVoiceDivisions: true },
];