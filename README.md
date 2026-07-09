# Encore Lyric Harmony (gigsprompter)

A live-performance lyrics teleprompter built for a Linkin Park tribute band (Lady Elektra fronting). Deployed as a Cloudflare Pages app with a D1-backed cloud sync layer, so setlists, vocalist annotations, notes, YouTube reference links, loop regions, and audio-sync timings follow the band across devices.

**Developed by**: ClubeMKT by Hudson Argollo

## Features

- **Passcode-gated access** — a shared band passcode unlocks the app and derives a stable cloud-sync identity, so every device shares one dataset instead of each browser having its own.
- **Multiple setlists** — the app opens on a setlist picker (create, rename, delete); each setlist has its own independently ordered song list.
- **Setlist management** — reorder songs, pull existing songs in from the shared library, add brand-new custom songs (title + lyrics), delete any of them from the current setlist.
- **Vocalist annotations** — highlight lyric lines/words per vocalist (Elektra / Chinoda / Luan); cue lines like `(Giulia)` or `(Hudson + Luan)` are auto-detected and rendered as compact tags, with an auto-mark button to tag lines from cues in bulk.
- **Performance mode** — full-screen stage view for live shows.
- **Auto-scroll** — adjustable-speed hands-free scrolling through lyrics.
- **Audio sync** — line-by-line timing markers synced to a reference track.
- **Loop practice mode** — mark a lyric region and loop it for rehearsal.
- **YouTube reference links**, **per-song notes**, and **cloud backup/restore** panels.

## Local development

Requires Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone https://github.com/hudsonargollo/encore-lyric-harmony.git
cd encore-lyric-harmony
npm i
cp .env.example .env.local  # then set VITE_BAND_PASSCODE
npm run dev
```

Note: the Cloudflare Pages Functions API (`functions/api/database/[[path]].ts`) does not run under plain `vite dev`. To exercise cloud sync locally, use `npx wrangler pages dev dist` after building, or rely on the deployed environment.

## Technologies

- Vite, TypeScript, React
- shadcn-ui, Tailwind CSS
- Cloudflare Pages + Pages Functions
- Cloudflare D1 (SQLite) for cloud sync storage

## Deployment

This project is deployed as a Cloudflare Pages project named `gigsprompter` (`gigsprompter.pages.dev`, `mygig.clubemkt.digital`), configured in `wrangler.toml` with a bound D1 database (`gigsprompter-db`). Deploys are manual (the Pages project is not connected to a git-based auto-deploy pipeline):

```sh
# .env.production.local (gitignored) must set VITE_BAND_PASSCODE — it's
# baked into the client bundle at build time, so build and deploy from
# a machine that has it set.
npm run build
npx wrangler pages deploy dist --project-name=gigsprompter
```
