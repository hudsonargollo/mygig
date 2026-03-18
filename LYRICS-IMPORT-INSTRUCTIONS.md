# Complete Lyrics Import Instructions

## ✅ Sidebar Toggle Fixed
The hamburger menu (☰) is now in the sidebar header, not in the main controls area.

## 📝 Adding Complete Lyrics

Since you have the complete lyrics in your `lyrics.html` file and images, here's how to add them:

### Method 1: Copy from your HTML file
1. Open your `lyrics/lyrics.html` file
2. Copy the lyrics text for each song
3. Replace the placeholder lyrics in `src/data/songs.ts`

### Method 2: Use the template system
I've created a complete song structure template with all 28 songs from your HTML file:

1. **All 28 songs are structured** with the correct IDs and titles
2. **Voice divisions will work automatically** once you add lyrics
3. **Just replace the placeholder text** with complete lyrics

### Current Song Structure (All 28 Songs Ready):
1. Somewhere I Belong
2. The Emptiness Machine  
3. Lying from You
4. Points of Authority
5. In the End
6. Faint
7. Crawling
8. New Divide
9. Burn It Down
10. What I've Done
11. Numb
12. One Step Closer
13. Breaking the Habit
14. Castle of Glass
15. Waiting for the End
16. Papercut
17. Bleed It Out
18. Given Up
19. Over Each Other
20. No More Sorrow
21. From the Inside
22. Key to the Kingdom
23. Heavy Is the Crown
24. Lost
25. Leave Out All the Rest
26. Two Faced
27. The Catalyst
28. Friendly Fire

### Voice Markings Will Auto-Apply:
- 🎤 **Giulia parts** (elektra) - White text in your HTML
- 🎙️ **Hudson parts** (chinoda) - Red text in your HTML  
- 🎶 **Everyone parts** (all three) - Blue text in your HTML

## Next Steps:
1. Copy complete lyrics from your sources
2. Paste them into `src/data/songs.ts` 
3. The voice divisions will automatically appear
4. Test in performance mode

The technical framework is 100% ready - you just need to add the complete lyrics content!