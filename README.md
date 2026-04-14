# 🚀 VerteXOrbit

> A real-time browser-based MMO space combat game inspired by DarkOrbit.  
> Fight aliens, collect resources, upgrade your ship, and dominate the galaxy — all in your browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![WebSocket](https://img.shields.io/badge/Multiplayer-WebSocket-blue.svg)]()

---

## 🎮 About the Game

VerteXOrbit is a real-time 2D space MMO playable directly in the browser, no installation required.

**Core gameplay:**
- Pilot a customizable spaceship across multiple star maps
- Fight NPC aliens (PvE) and other players (PvP)
- Collect resources, upgrade weapons, shields and drones
- Join a faction, form parties, climb the leaderboard
- Passive resource production via the Skylab system

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| Game Server | Node.js, WebSocket (`ws`), SQLite (`better-sqlite3`) |
| Game Client | HTML5, Canvas 2D, Vanilla JavaScript |
| Server Deploy | [Railway](https://railway.app) |
| Client Deploy | [Netlify](https://netlify.com) |

---

## 📁 Project Structure

```
vertexorbit/
├── vertexorbit-server/        # Node.js game server
│   ├── server.js              # Main entry point
│   ├── db.js                  # SQLite database layer
│   ├── modules/               # Game logic modules
│   │   ├── gameLoop.js
│   │   ├── combatHandler.js
│   │   ├── playerHandler.js
│   │   ├── botAi.js
│   │   ├── maps.js
│   │   └── partyHandler.js
│   ├── START_SERVER.bat       # Quick start (Windows)
│   └── package.json
│
└── vertexorbit-client/        # Browser game client
    ├── index.html             # Game entry point
    ├── css/style.css
    ├── js/
    │   ├── game.js            # Main game loop
    │   ├── core/              # Camera, Input, WebSocket, Items
    │   ├── entities/          # Player, Enemy, Drone, Portal...
    │   └── managers/          # UI, Map, Skylab, Assembly...
    ├── audio/                 # Game sound effects
    └── START_CLIENT.bat       # Quick start (Windows)
```

---

## ⚡ Quick Start (Local)

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher
- A modern browser (Chrome, Firefox, Edge)

### 1. Start the Server

```bash
cd vertexorbit-server
npm install
node server.js
```

**Or on Windows:** double-click `vertexorbit-server/START_SERVER.bat`  
(it automatically installs dependencies on first run)

The server starts on **port 8080**.

### 2. Start the Client

Open `vertexorbit-client/index.html` in your browser.

**Or on Windows:** double-click `vertexorbit-client/START_CLIENT.bat`  
(uses `npx serve` to host the client on `http://localhost:3000`)

### 3. Play

Navigate to `http://localhost:3000` — the game connects automatically to `ws://localhost:8080`.

---

## ☁️ Deploy Online

### Server → Railway

1. Go to [railway.app](https://railway.app) → **New Project** → Deploy from GitHub
2. Select this repo → set **Root Directory** to `vertexorbit-server`
3. Railway auto-detects `package.json` and runs `node server.js`
4. Copy your Railway domain from **Settings → Domains**

### Client → Netlify

1. Go to [netlify.com](https://netlify.com) → **New site** → Import from GitHub
2. Select this repo → set **Publish directory** to `vertexorbit-client`
3. Leave build command empty → **Deploy**

### Update WebSocket URL

In `vertexorbit-client/js/core/WebSocketClient.js`, update the production URL:

```javascript
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : 'wss://YOUR-APP.up.railway.app';
```

---

## 🎯 Game Controls

| Action | Control |
|---|---|
| Move ship | Left click (target position) |
| Follow cursor | Hold left mouse button |
| Select target | Click on enemy/player |
| Fire lasers | Automatic when target selected |
| Fire missiles | Cooldown-based button |
| Switch config | Config 1 / Config 2 buttons |
| Collect loot | Move over cargo box |
| Use portal | Approach + interact |

---

## 🛸 Game Systems

- **Ships & Equipment** — lasers, shields, generators in swappable configs
- **Drone System** — up to 10 drones with formations (Flax, Iris, Apis, Zeus)
- **Map System** — multiple maps connected via portals, PvP zones, beginner areas
- **PvE Combat** — tiered NPC enemies from Basic to Uber boss
- **PvP Combat** — faction-based real-time combat with full movement freedom
- **Resources** — Prometium, Endurium, Terbium + advanced combinations
- **Skylab** — passive background resource production
- **Assembly** — crafting system for weapons, drones and ships
- **PET** — autonomous drone assistant for auto-loot and combat support
- **Party System** — group up with other players
- **Leaderboard & Pilot Skills** — long-term progression tracking

---

## 🔧 Development

### Push changes to GitHub (Windows)

Double-click `GIT_PUSH.bat` in the project root. It commits and pushes the entire monorepo in one step.

### Backup locally

Run `backup.py` — creates a versioned backup in `VERTEXORBIT-BACKUP/` on your Desktop, excluding `node_modules`.

---

## 📄 License

MIT — free to use, modify and distribute.

---

*VerteXOrbit is an original project inspired by the gameplay of DarkOrbit. All assets, code and design are original works.*
