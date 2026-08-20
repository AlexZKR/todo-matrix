# Todo Matrix

An [Eisenhower matrix](https://en.wikipedia.org/wiki/Time_management#The_Eisenhower_Method) todo app: four quadrants sorted by urgency and importance.

- **Do** — urgent & important
- **Schedule** — not urgent & important
- **Delegate** — urgent & not important
- **Eliminate** — not urgent & not important

Fully client-side — all state lives in your browser's `localStorage`. No backend, no accounts.

## Features

- Add tasks directly into any quadrant
- Drag & drop tasks between quadrants (desktop), or use the ⇄ move menu (mobile-friendly)
- Check tasks off, delete them, clear all completed at once
- Dark theme: follows your OS preference, with a manual toggle that persists
- Responsive: 2×2 grid on desktop, stacked list on mobile

## Development

```sh
npm install
npm run dev
```

## Build & deploy

```sh
npm run build
```

The output in `dist/` is a static site — serve it with any web server (nginx, Caddy, `python -m http.server`, …). Asset paths are relative (`base: './'` in `vite.config.ts`), so it works from any sub-path behind a reverse proxy.
