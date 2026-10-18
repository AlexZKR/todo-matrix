# Todo Matrix

This repo is part of the homelab on `hp-mediaserver`. See the [homelab repo](https://github.com/AlexZKR/homelab), the [homelab docs](https://github.com/AlexZKR/homelab/tree/main/docs) and the [docs site](http://192.168.1.10:3003). Host nginx serves the app on the LAN at `http://192.168.1.10/todo`. Tailnet devices use `http://hp-mediaserver/todo`. It is not on Funnel.

An [Eisenhower matrix](https://en.wikipedia.org/wiki/Time_management#The_Eisenhower_Method) todo app: four quadrants sorted by urgency and importance.

- **Do** — urgent & important
- **Schedule** — not urgent & important
- **Delegate** — urgent & not important
- **Eliminate** — not urgent & not important

Fully client-side — all state lives in your browser's `localStorage`. No backend, no accounts.

## Features

- Add tasks directly into any quadrant — type, hit Enter, keep typing
- Drag & drop between quadrants with mouse or touch: drag anywhere on a task (mouse) or from the ⠿ handle (touch), with edge auto-scroll while dragging
- Multiple boards, one per day: new boards default to today's date as their name ("Aug 20"), and can be renamed (✎ or double-click), switched, and deleted
- Check tasks off / uncheck them, delete them, clear all completed at once
- Long lists collapse: quadrants show the first 5 tasks and hide the rest behind "Show N more"
- On mobile, empty quadrants shrink to a slim header so they don't take space from filled ones — tap to expand and add
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
