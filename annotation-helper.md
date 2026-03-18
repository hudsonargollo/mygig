# Voice Division Annotation Helper

This document helps you add default annotations based on the PDF voice divisions.

## Color Mapping
- ⚫️ Black = `elektra` (Giulia - Lead Singer)
- 🔴 Red = `chinoda` (Hudson - Rap/Co-Lead) 
- 🔵 Blue = All three vocalists (add annotations for all: `elektra`, `chinoda`, `luan`)

## Song IDs Available
1. "somewhere-i-belong"
2. "numb" 
3. "breaking-the-habit"
4. "the-emptiness-machine"
5. "new-divide"
6. "bleed-it-out"
7. "crawling"
8. "what-ive-done"
9. "faint"
10. "given-up"
11. "papercut"
12. "heavy-is-the-crown"
13. "in-the-end"
14. "waiting-for-the-end"
15. "a-place-for-my-head"
16. "lying-from-you"
17. "one-step-closer"
18. "burn-it-down"
19. "heavy"
20. "from-the-inside"
21. "shadow-of-the-day"
22. "one-more-light"
23. "leave-out-all-the-rest"
24. "lost"

## Annotation Format
```typescript
{ 
  songId: "song-id", 
  lineIndex: 0, // Line number (0-based)
  startOffset: 0, // Character start position in line
  endOffset: 10, // Character end position in line
  vocalist: "elektra" | "chinoda" | "luan" 
}
```

## Example Usage
For a line like "I wanna heal, I wanna feel" where:
- "I wanna heal" is marked black (Giulia only)
- "I wanna feel" is marked red (Hudson only)

```typescript
// Line: "I wanna heal, I wanna feel"
{ songId: "somewhere-i-belong", lineIndex: 15, startOffset: 0, endOffset: 12, vocalist: "elektra" },
{ songId: "somewhere-i-belong", lineIndex: 15, startOffset: 14, endOffset: 26, vocalist: "chinoda" },
```

For blue markings (all three), add three annotations:
```typescript
{ songId: "song-id", lineIndex: 10, startOffset: 0, endOffset: 20, vocalist: "elektra" },
{ songId: "song-id", lineIndex: 10, startOffset: 0, endOffset: 20, vocalist: "chinoda" },
{ songId: "song-id", lineIndex: 10, startOffset: 0, endOffset: 20, vocalist: "luan" },
```

## Instructions
1. Look at each PDF page
2. Identify the song by title
3. Find the corresponding song ID from the list above
4. For each colored section, create annotations using the format above
5. Add them to the DEFAULT_ANNOTATIONS array in LyricViewer.tsx

## Tips
- Line numbers start at 0
- Character positions start at 0
- Count empty lines and section headers as lines
- Use the browser's developer tools to inspect line indices if needed