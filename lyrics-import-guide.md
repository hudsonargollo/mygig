# Complete Lyrics Import Guide

## Quick Solution

Since you have the complete lyrics in your `lyrics` folder images, here's how to get them into the app:

### Option 1: Manual Copy-Paste
1. Open each image from your `lyrics` folder
2. Copy the lyrics text 
3. Replace the `lyrics` field in `src/data/songs.ts` for each song

### Option 2: Use OCR Tool
1. Use an OCR tool to extract text from your lyrics images
2. Copy the extracted text into the songs file

### Option 3: Text File Import
1. Create `.txt` files for each song with complete lyrics
2. I can help you create an import script to load them automatically

## Song Structure Template

Each song should follow this structure in `src/data/songs.ts`:

```typescript
{
  id: "song-id",
  number: 1,
  title: "Song Title",
  lyrics: `[Verse 1]

Complete verse 1 lyrics here...

[Chorus]

Complete chorus lyrics here...

[Verse 2]

Complete verse 2 lyrics here...

[Chorus]

Repeat chorus...

[Bridge]

Bridge lyrics here...

[Chorus]

Final chorus...

[Outro]

Outro lyrics here...`
}
```

## Voice Division Markings

The app will automatically apply voice divisions based on your HTML markings:
- ⚫ Giulia (elektra) parts
- 🔴 Hudson (chinoda) parts  
- 🔵 Everyone (all three) parts

## Next Steps

1. Extract complete lyrics from your images
2. Update each song in `src/data/songs.ts`
3. The voice markings will automatically appear based on your HTML divisions
4. Test in performance mode for live use

Would you like me to help you create an import script or modify the current structure?