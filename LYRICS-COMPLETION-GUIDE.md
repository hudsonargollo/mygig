# Lyrics Completion Guide

## Overview
This guide helps you complete the lyrics database for your authorized tribute concert. The structure is set up to match the HTML setlist with proper voice divisions.

## Voice Division System
Based on the HTML structure, use these voice assignments:

- **Giulia (elektra)** 🎤: Lead singer parts (marked as `.giulia` in HTML - white/black text)
- **Hudson (chinoda)** 🎙️: Rap/co-lead parts (marked as `.hudson` in HTML - red text)  
- **Everyone** 🔵: All three vocalists together (marked as `.everyone` in HTML - blue text)

## Song Structure (28 Songs Total)

### Current Status
✅ Songs 1-28 structure created with correct titles and order
⚠️ Lyrics content needs to be added from your authorized sources

### To Complete Each Song:

1. **Replace the placeholder text** in `src/data/songs.ts`
2. **Add complete lyrics** from your authorized sources
3. **Use proper formatting**:
   - `[Verse 1]`, `[Chorus]`, `[Bridge]` for sections
   - Empty lines for spacing
   - Keep original line breaks

### Voice Annotations
The app will automatically apply voice markings based on the `DEFAULT_VOICE_ANNOTATIONS` array. You can:

1. **Add annotations programmatically** by updating the array in `songs.ts`
2. **Use the UI** to mark lyrics manually (recommended for fine-tuning)
3. **Import from your HTML** by converting the class markings

## Example Voice Annotation Structure

```typescript
// Add to DEFAULT_VOICE_ANNOTATIONS array
{ songId: "song-id", lineIndex: 0, startOffset: 0, endOffset: 20, vocalist: "elektra" },
{ songId: "song-id", lineIndex: 1, startOffset: 0, endOffset: 15, vocalist: "chinoda" },
{ songId: "song-id", lineIndex: 2, startOffset: 0, endOffset: 25, vocalist: "luan" },
```

## HTML Reference Mapping

From your `lyrics.html`, the voice classes map to:
- `.giulia` → `vocalist: "elektra"` (Giulia - Lead Singer 🎤)
- `.hudson` → `vocalist: "chinoda"` (Hudson - Rap/Co-Lead 🎙️)  
- `.everyone` → Mark for all three vocalists (🔵 All)

## Deployment After Completion

Once you've added the complete lyrics:

1. **Build the project**: `npm run build`
2. **Deploy to Cloudflare**: `wrangler pages deploy dist --project-name=gigsprompter`
3. **Test the live site**: https://beb87627.gigsprompter.pages.dev

## Legal Note
Since you have permission for your authorized tribute concert, you can add the complete lyrics from your licensed sources. The app is designed for stage support and performance use.

## Need Help?
- Use the lyrics editor in the app (✏️ EDIT LYRICS button)
- Import/export lyrics using the editor controls
- Test voice markings with the vocalist buttons (🎤 🎙️ 🎶)