# Complete Lyrics Update Guide

## 🎤 For Your Tribute Concert

Your app currently has partial lyrics. To get complete lyrics for all 28 songs:

### Method 1: Direct Update
1. Open `src/data/songs.ts`
2. For each song, replace the `lyrics` field with complete lyrics
3. Use this format:

```typescript
{
  id: "song-name",
  number: 1,
  title: "Song Title",
  lyrics: `[Verse 1]

Complete verse 1 lyrics here...

[Chorus]

Complete chorus lyrics here...

[Verse 2]

Complete verse 2 lyrics here...

[Bridge]

Complete bridge lyrics here...

[Outro]

Complete outro lyrics here...`
}
```

### Method 2: Bulk Import Script
I can help you create a script to import from text files if you have the complete lyrics in separate files.

### Method 3: API Integration
If you have access to a lyrics API or database, I can help integrate that.

## 🚀 After Adding Complete Lyrics

1. **Rebuild**: `npm run build`
2. **Deploy**: `wrangler pages deploy dist --project-name=gigsprompter`
3. **Your complete lyrics will be live!**

## 🎯 Voice Markings Will Work Automatically

Once you add complete lyrics, the voice divisions will automatically apply based on your HTML markings:
- 🎤 **Giulia parts** (elektra)
- 🎙️ **Hudson parts** (chinoda)  
- 🎶 **Everyone parts** (all three)

The technical framework is ready - just need the complete lyrics content!