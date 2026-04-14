# 🚀 VerteXOrbit — Browser MMO

Space MMO multiplayer game playable directly in the browser.  
Built with **Node.js + WebSocket + SQLite** (server) and **HTML5 Canvas** (client).

---

## 📁 Structure

```
VerteXOrbit/
├── vertexorbit-server/   # Node.js game server (WebSocket + SQLite)
└── vertexorbit-client/   # HTML5 browser client (Canvas 2D)
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Game server | Node.js, WebSocket (`ws`), SQLite (`better-sqlite3`) |
| Client | HTML5, Canvas 2D, Vanilla JS |
| Deploy server | Railway |
| Deploy client | Netlify |

---

## 🚀 Deploy

### Server → Railway
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select this repo → set **Root Directory** to `vertexorbit-server`
3. Railway auto-detects `package.json` and runs `node server.js`
4. Get your domain under **Settings → Domains → Generate Domain**

> The server reads `process.env.PORT` automatically — no config needed.

### Client → Netlify
1. Go to [netlify.com](https://netlify.com) → New site → Import from GitHub
2. Select this repo → set **Publish directory** to `vertexorbit-client`
3. Leave build command empty → Deploy

### Update WebSocket URL in client
In `vertexorbit-client/js/core/WebSocketClient.js`, change the connection URL to point to your Railway domain:
```javascript
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : 'wss://YOUR-APP.up.railway.app';
```

---

## 💻 Local Development

```bash
# Start server
cd vertexorbit-server
npm install
node server.js

# Open client
# Open vertexorbit-client/index.html in browser
# or use Live Server extension in VS Code
```

---

## 🎮 Features

- Real-time multiplayer space combat (PvP + PvE)
- AI Bot players with realistic behavior
- Ship customization, drones, weapons, skills
- Party system, leaderboard, pilot leveling
- Cargo system, loot drops, special weapons
- Multiple factions and maps

---

## 📄 License

MIT — free to use, modify and distribute.

