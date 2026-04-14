const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SETTINGS & AUDIO MANAGER ---
const DEFAULT_SETTINGS = {
    volume: 0.5,
    keys: {
        shoot: 'ControlLeft',
        special: 'Space',
        formation: 'ShiftLeft',
        jump: 'KeyJ',
        ammo_x1: '1', ammo_x2: '2', ammo_x3: '3', ammo_x4: '4', ammo_sab: '5',
        mis_r310: 'q', mis_plt2026: 'w', mis_plt3030: 'e', mis_pld8: 'r', mis_agt500: 't'
    }
};
window.gameSettings = JSON.parse(localStorage.getItem('vertexOrbitSettings')) || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
for(let k in DEFAULT_SETTINGS.keys) { if(window.gameSettings.keys[k]===undefined) window.gameSettings.keys[k] = DEFAULT_SETTINGS.keys[k]; }
if(window.gameSettings.volume === undefined) window.gameSettings.volume = DEFAULT_SETTINGS.volume;

function saveSettings() { localStorage.setItem('vertexOrbitSettings', JSON.stringify(window.gameSettings)); }

const sfxPool = {};
window.playSfx = function(path, customVolume = null, playbackRate = 1.0) {
    if(window.gameSettings && window.gameSettings.volume <= 0) return;
    if(!sfxPool[path]) sfxPool[path] = [];
    try {
        let a = sfxPool[path].find(snd => snd.paused || snd.ended);
        if (!a) {
            a = new Audio(path);
            a.preload = 'auto';
            sfxPool[path].push(a);
        }
        
        let baseVolume = window.gameSettings ? window.gameSettings.volume : 0.5;
        if (customVolume !== null) {
            let v = customVolume * baseVolume;
            a.volume = Math.min(1, Math.max(0, v));
        } else {
            a.volume = baseVolume;
        }
        
        // Modifica del pitch mantenendo velocità
        if (a.preservesPitch !== undefined) a.preservesPitch = false;
        if (a.mozPreservesPitch !== undefined) a.mozPreservesPitch = false;
        a.playbackRate = playbackRate;
        
        // Evitiamo InvalidStateError se il file audio non ha ancora caricato i metadata
        if (a.readyState >= 1) { 
            a.currentTime = 0;
        }
        
        const playPromise = a.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.warn('SFX Autoplay/Block Error:', e));
        }
    } catch(e) {
        console.error('SFX System Error:', e);
    }
};

// Sblocco audio al primo click o tasto premuto (policy browser)
function unlockAudio() {
    const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    a.play().catch(()=>{});
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    if (!window.ambientAudioStarted) {
        window.ambientAudioStarted = true;
        const ambient = new Audio('audio/ambient_sound.mp3');
        ambient.loop = true;
        ambient.volume = window.gameSettings ? window.gameSettings.volume * 0.3 : 0.15;
        ambient.play().catch(()=>{});
        window.ambientAudio = ambient;
    }
}
window.addEventListener('click', unlockAudio);

// --- GESTIONE LOOP AUDIO CON FADE ---
const loopPool = {};
window.playLoopSfx = function(id, path, customVolume = null) {
    if(window.gameSettings && window.gameSettings.volume <= 0) return;
    if(!loopPool[id]) {
        const a = new Audio(path);
        a.loop = true;
        loopPool[id] = a;
    }
    const a = loopPool[id];
    let baseVolume = window.gameSettings ? window.gameSettings.volume : 0.5;
    let targetVol = (customVolume !== null ? customVolume : 1.0) * baseVolume;
    
    if (a.paused || a.ended) {
        a.volume = 0;
        a.currentTime = 0;
        a.play().catch(e => console.warn('Audio play blocked:', e));
    }
    
    clearInterval(a.fadeInterval);
    a.fadeInterval = setInterval(() => {
        if (a.volume < targetVol) {
            a.volume = Math.min(targetVol, a.volume + 0.05);
        } else {
            clearInterval(a.fadeInterval);
        }
    }, 50);
};

window.stopLoopSfx = function(id, fadeOutMs = 500) {
    const a = loopPool[id];
    if (!a) return;
    clearInterval(a.fadeInterval);
    if (a.paused || a.volume <= 0) {
        a.pause();
        return;
    }
    const steps = fadeOutMs / 50;
    if (steps <= 0) { a.volume = 0; a.pause(); return; }
    const volStep = a.volume / steps;
    a.fadeInterval = setInterval(() => {
        if (a.volume - volStep > 0.02) {
            a.volume -= volStep;
        } else {
            a.volume = 0;
            a.pause();
            clearInterval(a.fadeInterval);
        }
    }, 50);
};

window.updateLoopVolume = function(id, customVolume) {
    const a = loopPool[id];
    if (!a || a.paused) return;
    let baseVolume = window.gameSettings ? window.gameSettings.volume : 0.5;
    let targetVol = (customVolume !== null ? customVolume : 1.0) * baseVolume;
    if (targetVol <= 0) { window.stopLoopSfx(id, 500); return; }
    clearInterval(a.fadeInterval);
    a.fadeInterval = setInterval(() => {
        if (Math.abs(a.volume - targetVol) > 0.05) {
            a.volume += a.volume < targetVol ? 0.05 : -0.05;
        } else {
            a.volume = targetVol;
            clearInterval(a.fadeInterval);
        }
    }, 100);
};
window.addEventListener('keydown', unlockAudio);

// Global UI click sound
document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.tagName === 'BUTTON' || t.classList.contains('ui-button') || t.classList.contains('ab-slot') || 
        t.classList.contains('shop-cat-btn') || t.classList.contains('item-slot') || t.classList.contains('faction-btn') || t.closest('.ab-slot')) {
        if (typeof window.playSfx === 'function') window.playSfx('audio/ui_click.mp3', 0.5);
    }
});

let camera = null;

// ── Funzione globale: disegna barre HP + Scudo sotto una nave ─────────────
// Usata da Player.js, OtherPlayer.js
// Icona fazione in-game: stesso esagono ⬡ della schermata di registrazione
const FACTION_SYMBOLS = { MMO: '⬡', EIC: '⬡', VRU: '⬡' };
const FACTION_COLORS  = { MMO: '#ef4444', EIC: '#3b82f6', VRU: '#22c55e' };

function drawShipBars(ctx, x, y, radius, hp, maxHp, shield, maxShield, opts = {}) {
    const { nameLabel = null, isPlayer = false, faction = null, partyLabel = false } = opts;
    const barW  = Math.max(44, Math.floor(radius * 2.2));
    const barX  = x - barW / 2;
    const hasShield = maxShield > 0;
    // Posiziona le barre SOTTO la nave
    const barY  = y + radius + 8;

    // ── Barra HP ──────────────────────────────────────────────────────────
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    // Sfondo
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 6);
    // Track vuoto
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX, barY, barW, 4);
    // Fill HP (verde→giallo→rosso)
    ctx.fillStyle = hpPct > 0.6 ? '#22c55e' : hpPct > 0.3 ? '#facc15' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpPct, 4);

    // ── Barra Scudo (sempre visibile se la nave ha scudo) ─────────────────
    if (hasShield) {
        const shY   = barY + 6;
        const shPct = Math.max(0, Math.min(1, shield / maxShield));
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX - 1, shY - 1, barW + 2, 5);
        ctx.fillStyle = '#0f2744';
        ctx.fillRect(barX, shY, barW, 3);
        if (shPct > 0) {
            ctx.fillStyle = shPct > 0.5 ? '#38bdf8' : '#0369a1';
            ctx.fillRect(barX, shY, barW * shPct, 3);
        }
    }

    // ── Name + Faction icon + Pilot level BELOW the ship ────────────────
    if (nameLabel) {
        ctx.font = 'bold 11px Courier New';
        ctx.textAlign = 'left';

        const sym    = (faction && FACTION_SYMBOLS[faction]) ? FACTION_SYMBOLS[faction] : '';
        const symCol = (faction && FACTION_COLORS[faction])  ? FACTION_COLORS[faction]  : '#aaaaaa';
        const nameCol = isPlayer ? '#5eead4' : '#93c5fd';
        const nameY  = y + radius + (hasShield ? 30 : 24);

        // Pilot level label (only for players that have one)
        const lvl = opts.pilotLevel;
        const lvlLabel = (lvl !== undefined && lvl !== null) ? String(lvl) : null;

        if (sym) {
            const lvlW   = lvlLabel ? ctx.measureText(lvlLabel).width + 4 : 0; // +4 gap
            const symW   = ctx.measureText(sym).width;
            const nameW  = ctx.measureText(nameLabel).width;
            const gap    = 4;
            const totW   = lvlW + symW + gap + nameW;
            let cur      = x - totW / 2;

            // Pilot level number (yellow)
            if (lvlLabel) {
                ctx.fillStyle = '#facc15';
                ctx.fillText(lvlLabel, cur, nameY);
                cur += lvlW;
            }

            // Faction symbol
            ctx.fillStyle = symCol;
            ctx.fillText(sym, cur, nameY);
            cur += symW + gap;

            // Player name
            ctx.fillStyle = nameCol;
            ctx.fillText(nameLabel, cur, nameY);
        } else {
            ctx.fillStyle = nameCol;
            ctx.textAlign = 'center';
            ctx.fillText(nameLabel, x, nameY);
        }

        if (partyLabel) {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            const labelText = (typeof partyLabel === 'string' && partyLabel.length > 0) ? '[' + partyLabel + ']' : '[PARTY]';
            ctx.fillText(labelText, x, nameY + 10);
        }
        ctx.textAlign = 'center';
    }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (camera) {
      camera.updateSize(canvas.width, canvas.height);
  }
}

window.addEventListener('resize', resize);
resize();

let gameState = 'menu';

const inputManager = new InputManager();
camera = new Camera(canvas.width, canvas.height);
const entityManager = new EntityManager();
const uiManager = new UIManager();
const mapManager = new MapManager();
const skylabManager = new SkylabManager();
const assemblyManager = new AssemblyManager();

const player = new Player(canvas.width / 2, canvas.height / 2);
entityManager.addEntity(player);

// Il PET verrà spawnato se è equipaggiato
if (player.equipped && player.equipped.pets && player.equipped.pets.length > 0) {
    player.pet = new PET(player);
    entityManager.addEntity(player.pet);
}

if (typeof SkylabManager === 'undefined') {
    console.warn('Includere SkylabManager, AssemblyManager e PET in index.html');
}
const wsClient = new WebSocketClient('ws://localhost:8080', player);

// ── Helpers UI auth ───────────────────────────────────────────────────────
window.switchAuthTab = function(tab) {
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('reg-error').classList.add('hidden');
};

window.selectFaction = function(btn, faction) {
    document.querySelectorAll('.faction-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('reg-faction').value = faction;
};

// ── Login ─────────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    if (username.length < 3) { errEl.textContent = 'Please enter your username.'; errEl.classList.remove('hidden'); return; }
    if (!password)            { errEl.textContent = 'Please enter your password.';        errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    document.getElementById('btn-start').textContent = 'CONNECTING...';
    document.getElementById('btn-start').disabled = true;
    player.username = username;
    wsClient.connect(username, password);
});

// Enter nel form login
['login-username','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-start').click();
    });
});

// ── Registrazione ─────────────────────────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', () => {
    const username  = document.getElementById('reg-username').value.trim();
    const password  = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const faction   = document.getElementById('reg-faction').value;
    const errEl     = document.getElementById('reg-error');
    const okEl      = document.getElementById('reg-success');
    errEl.classList.add('hidden'); okEl.classList.add('hidden');
    if (username.length < 3)        { errEl.textContent = 'Username: min 3 characters.';        errEl.classList.remove('hidden'); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) { errEl.textContent = 'Only letters, numbers, _ and -'; errEl.classList.remove('hidden'); return; }
    if (password.length < 4)        { errEl.textContent = 'Password: min 4 characters.';           errEl.classList.remove('hidden'); return; }
    if (password !== password2)     { errEl.textContent = 'Passwords do not match.';          errEl.classList.remove('hidden'); return; }
    document.getElementById('btn-register').textContent = 'CREATING...';
    document.getElementById('btn-register').disabled = true;
    wsClient.register(username, password, faction);
});

// ── Callbacks dal server ──────────────────────────────────────────────────
window.onAuthError = function(error) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = error;
    errEl.classList.remove('hidden');
    const btn = document.getElementById('btn-start');
    btn.textContent = 'ENTER GAME';
    btn.disabled = false;
};

window.onRegisterOk = function(username) {
    const okEl = document.getElementById('reg-success');
    okEl.textContent = `Account "${username}" created! Now log in.`;
    okEl.classList.remove('hidden');
    document.getElementById('reg-error').classList.add('hidden');
    document.getElementById('btn-register').textContent = 'CREATE ACCOUNT';
    document.getElementById('btn-register').disabled = false;
    // Pre-compila il campo login e passa al tab login
    document.getElementById('login-username').value = username;
    setTimeout(() => switchAuthTab('login'), 1200);
};

window.onRegisterError = function(error) {
    const errEl = document.getElementById('reg-error');
    errEl.textContent = error;
    errEl.classList.remove('hidden');
    document.getElementById('btn-register').textContent = 'CREA ACCOUNT';
    document.getElementById('btn-register').disabled = false;
};

// Respawn — invia solo la richiesta al server, NESSUN reset locale.
// Tutto il reset (hp, posizione, isDead) avviene SOLO quando arriva 'respawnOk'.
document.getElementById('btn-respawn').addEventListener('click', () => {
    player.respawn();
});

// ── PILOT SKILLS button ───────────────────────────────────────────────────
document.getElementById('btn-pilot-skills')?.addEventListener('click', () => {
    if (gameState !== 'playing') return;
    uiManager.openPilotSkillsPanel();
    playSfx('audio/ui_click.mp3', 0.7);
});
document.getElementById('btn-close-pilot-skills')?.addEventListener('click', () => {
    uiManager.closePilotSkillsPanel();
});
document.getElementById('btn-reset-pilot-skills')?.addEventListener('click', () => {
    uiManager.resetPilotSkills(player);
    playSfx('audio/ui_click.mp3', 0.7);
});

// ── LEVEL UP overlay ─────────────────────────────────────────────────────
window.showLevelUpOverlay = function(newLevel) {
    // Rimuove eventuale overlay precedente ancora visibile
    const existing = document.getElementById('levelup-overlay');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'levelup-overlay';
    el.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.4);
        z-index: 9000;
        text-align: center;
        pointer-events: none;
        animation: levelupPop 3.5s ease forwards;
    `;
    el.innerHTML = `
        <div style="
            font-family:'Courier New',monospace;
            font-size: 64px;
            font-weight: bold;
            color: #facc15;
            text-shadow: 0 0 30px #facc15, 0 0 60px #f59e0b, 0 0 100px #f59e0b;
            letter-spacing: 6px;
            line-height: 1;
        ">✦ LEVEL UP!</div>
        <div style="
            font-family:'Courier New',monospace;
            font-size: 42px;
            font-weight: bold;
            color: #a78bfa;
            text-shadow: 0 0 20px #7c3aed, 0 0 50px #7c3aed;
            letter-spacing: 4px;
            margin-top: 10px;
        ">PILOT LEVEL ${newLevel}</div>
        <div style="
            font-family:'Courier New',monospace;
            font-size: 20px;
            color: #5eead4;
            margin-top: 14px;
            letter-spacing: 2px;
            text-shadow: 0 0 15px #5eead4;
        ">+1 SKILL POINT AVAILABLE</div>
    `;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3500);
};

// ── Bottone ESC logout ────────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
    document.getElementById('logout-dialog').classList.remove('hidden');
});
document.getElementById('btn-logout-cancel').addEventListener('click', () => {
    document.getElementById('logout-dialog').classList.add('hidden');
});
document.getElementById('btn-logout-confirm').addEventListener('click', () => {
    document.getElementById('logout-dialog').classList.add('hidden');
    if (typeof wsClient !== 'undefined' && wsClient.connected) {
        // Invia syncFullState + messaggio logout dedicato
        // Il server salverà tutto e poi la connessione si chiuderà
        wsClient.sendSyncFullState?.();
        wsClient.sendLogout?.();
        // Chiudi la socket dopo un breve delay per garantire ricezione
        setTimeout(() => { try { wsClient.ws.close(); } catch(e){} }, 400);
    }
    player.isDead = false;
    player.username = null;
    // Reset form login
    const btnStart = document.getElementById('btn-start');
    if (btnStart) { btnStart.textContent = 'ENTRA IN GIOCO'; btnStart.disabled = false; }
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    switchAuthTab('login');
    changeGameState('menu');
});

mapManager.changeMap('Arena');

// ── Sfondo Stellare e Parallasse ──────────────────────────────────────────
const stars = [];
// 1. Stelle normali
for (let i = 0; i < 300; i++) {
    stars.push({
        type: 'normal',
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.05 + 0.01
    });
}
// 2. Stelle grandi brillanti
for (let i = 0; i < 30; i++) {
    stars.push({
        type: 'bright',
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        size: Math.random() * 3 + 2,
        alpha: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 0.02 + 0.01,
        color: ['#ffffff', '#fde047', '#93c5fd', '#fca5a5'][Math.floor(Math.random() * 4)]
    });
}

const backgroundElements = [];

// 2. Pianeti piccoli in lontananza (Design pulito)
const planetColors = [
    { base: '#064e3b', glow: '#10b981' },
    { base: '#4c1d95', glow: '#8b5cf6' },
    { base: '#7f1d1d', glow: '#ef4444' },
    { base: '#082f49', glow: '#0ea5e9' },
    { base: '#78350f', glow: '#d97706' }
];
for (let i = 0; i < 15; i++) {
    const colorTheme = planetColors[Math.floor(Math.random() * planetColors.length)];
    backgroundElements.push({
        type: 'planet',
        x: Math.random() * 10000 - 5000,
        y: Math.random() * 10000 - 5000,
        radius: 30 + Math.random() * 80, // Dimensioni ridotte per un look distante
        color: colorTheme.base,
        glow: colorTheme.glow,
        speed: 0.005 + Math.random() * 0.01
    });
}

// 3. Nebulose/Galassie (Rimosse secondo richiesta utente)
// Lasciati solo pianeti e stelle nel background.

window.changeGameState = function(newState) {
    gameState = newState;
    uiManager.showScreen(gameState);
    // Mostra/nasconde il pannello Ship Log solo nella schermata di gioco
    const boardLogPanel = document.getElementById('board-log-panel');
    if (boardLogPanel) {
        boardLogPanel.style.display = (newState === 'playing') ? 'flex' : 'none';
    }
}

// ── Tasti rapidi consumabili ──────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
    if (window.isBindingKey) {
        e.preventDefault();
        window.finishBinding(e.code, e.key);
        return;
    }
    // ESC apre il dialog di logout ovunque (tranne già nel menu)
    if (e.key === 'Escape') {
        const dialog = document.getElementById('logout-dialog');
        if (!dialog) return;
        if (gameState === 'menu') return; // già al menu, niente da fare
        if (!dialog.classList.contains('hidden')) {
            dialog.classList.add('hidden'); // secondo ESC chiude
        } else {
            dialog.classList.remove('hidden'); // primo ESC apre
        }
        return;
    }
    if (gameState !== 'playing') return;
    
    const k = e.code;
    const kl = e.key.toLowerCase();
    const gk = window.gameSettings.keys;
    
    if (k === gk.ammo_x1 || kl === gk.ammo_x1.toLowerCase()) { player.selectLaserAmmo('x1'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); }
    else if (k === gk.ammo_x2 || kl === gk.ammo_x2.toLowerCase()) { player.selectLaserAmmo('x2'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); }
    else if (k === gk.ammo_x3 || kl === gk.ammo_x3.toLowerCase()) { player.selectLaserAmmo('x3'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); }
    else if (k === gk.ammo_x4 || kl === gk.ammo_x4.toLowerCase()) { player.selectLaserAmmo('x4'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); }
    else if (k === gk.ammo_sab || kl === gk.ammo_sab.toLowerCase()) { player.selectLaserAmmo('sab'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); }
    
    else if (k === gk.mis_r310 || kl === gk.mis_r310.toLowerCase()) { player.selectMissile('r-310'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); }
    else if (k === gk.mis_plt2026 || kl === gk.mis_plt2026.toLowerCase()) { player.selectMissile('plt-2026'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); }
    else if (k === gk.mis_plt3030 || kl === gk.mis_plt3030.toLowerCase()) { player.selectMissile('plt-3030'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); }
    else if (k === gk.mis_pld8 || kl === gk.mis_pld8.toLowerCase()) { player.selectMissile('pld-8'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); }
    else if (k === gk.mis_agt500 || kl === gk.mis_agt500.toLowerCase()) { player.selectMissile('agt-500'); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); }
    else if (k === gk.formation || kl === gk.formation.toLowerCase()) { if(typeof window.playSfx === 'function') window.playSfx('audio/switch_formazione_droni.mp3', 0.7); }
});

// --- LOGICA IMPOSTAZIONI UI ---
window.isBindingKey = false;
let bindingAction = null;

function renderSettingsBindings() {
    const list = document.getElementById('bindings-list');
    if (!list) return;
    list.innerHTML = '';
    
    const actions = [
        { id: 'shoot', name: 'Fire Laser / Target (Default: Ctrl)' },
        { id: 'special', name: 'Use Selected Special (Default: Space)' },
        { id: 'formation', name: 'Change Drone Formation (Default: Shift)' },
        { id: 'jump', name: 'Jump Portal (Default: J)' },
        { id: 'ammo_x1', name: 'x1 Ammo' },
        { id: 'ammo_x2', name: 'x2 Ammo' },
        { id: 'ammo_x3', name: 'x3 Ammo' },
        { id: 'ammo_x4', name: 'x4 Ammo' },
        { id: 'ammo_sab', name: 'SAB Ammo' },
        { id: 'mis_r310', name: 'R-310 Missile' },
        { id: 'mis_plt2026', name: 'PLT-2026 Missile' },
        { id: 'mis_plt3030', name: 'PLT-3030 Missile' },
        { id: 'mis_pld8', name: 'PLD-8 Slow Missile' },
        { id: 'mis_agt500', name: 'AGT-500 Area Missile' }
    ];
    
    actions.forEach(a => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(15,23,42,0.8);padding:6px 12px;border:1px solid #1e3a5a;border-radius:4px;';
        
        const label = document.createElement('div');
        label.style.cssText = 'font-size:11px;color:#cbd5e1;font-weight:bold;';
        label.textContent = a.name;
        
        const btn = document.createElement('button');
        btn.className = 'ui-button';
        btn.style.cssText = 'min-width:100px;text-align:center;font-size:11px;padding:4px 8px;';
        
        let keyName = window.gameSettings.keys[a.id];
        if (keyName.startsWith('Key')) keyName = keyName.substring(3);
        if (keyName.startsWith('Digit')) keyName = keyName.substring(5);
        btn.textContent = keyName.toUpperCase();
        
        btn.onclick = () => {
            if (window.isBindingKey) return;
            window.isBindingKey = true;
            bindingAction = a.id;
            btn.textContent = 'PREMI TASTO...';
            btn.style.borderColor = '#facc15';
            btn.style.color = '#facc15';
            btn.style.boxShadow = '0 0 10px #facc15';
        };
        
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    });
}

window.finishBinding = function(code, key) {
    if (!bindingAction) return;
    let val = code;
    if (key.length === 1) val = key; // usa lettere singole se disponibili
    
    // Controllo conflitti
    let conflictAction = null;
    for (let a in window.gameSettings.keys) {
        if (a !== bindingAction && window.gameSettings.keys[a].toLowerCase() === val.toLowerCase()) {
            conflictAction = a;
            break;
        }
    }

    if (conflictAction) {
        // Swap: assegno il vecchio tasto di bindingAction a conflictAction
        window.gameSettings.keys[conflictAction] = window.gameSettings.keys[bindingAction];
        
        // Feedback visivo del conflitto risolto
        const msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.9);color:#fff;padding:10px 20px;border-radius:5px;z-index:9999;font-weight:bold;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:"Courier New",monospace;';
        msg.textContent = '⚠ KEY IN USE: Controls have been swapped.';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
    
    window.gameSettings.keys[bindingAction] = val;
    window.isBindingKey = false;
    bindingAction = null;
    saveSettings();
    renderSettingsBindings();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnSet = document.getElementById('btn-settings');
    const modal = document.getElementById('settings-modal');
    const btnClose = document.getElementById('btn-settings-close');
    const btnReset = document.getElementById('btn-settings-reset');
    const volSlider = document.getElementById('volume-slider');
    const volVal = document.getElementById('volume-value');
    
    if(btnSet && modal) {
        btnSet.onclick = () => {
            modal.classList.remove('hidden');
            renderSettingsBindings();
            if(volSlider && volVal) {
                volSlider.value = window.gameSettings.volume;
                volVal.textContent = Math.round(window.gameSettings.volume * 100) + '%';
            }
        };
    }
    if(btnClose) btnClose.onclick = () => {
        modal.classList.add('hidden');
        window.isBindingKey = false;
    };
    if(btnReset) {
        btnReset.onclick = () => {
            window.gameSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            saveSettings();
            renderSettingsBindings();
            if(volSlider && volVal) {
                volSlider.value = window.gameSettings.volume;
                volVal.textContent = Math.round(window.gameSettings.volume * 100) + '%';
            }
        };
    }
    if(volSlider) {
        volSlider.oninput = (e) => {
            window.gameSettings.volume = parseFloat(e.target.value);
            if(volVal) volVal.textContent = Math.round(window.gameSettings.volume * 100) + '%';
            if (window.ambientAudio) window.ambientAudio.volume = window.gameSettings.volume * 0.3;
            saveSettings();
        };
    }
});

function updateActionBar() {
    if (!player || !player.ammo) return;
    const ammo   = player.ammo;
    const missle = player.missileAmmo || {};
    const mine   = player.mineAmmo   || {};
    const emp    = player.empAmmo    || {};

    // Munizioni laser
    const laserSlots = ['x1','x2','x3','x4','sab'];
    laserSlots.forEach(t => {
        const el = document.getElementById('ab-' + t);
        if (!el) return;
        el.classList.toggle('active-ammo', ammo.laserAmmo === t);
        const cnt = document.getElementById('cnt-' + t);
        if (cnt) cnt.textContent = t === 'x1' ? '∞' : (ammo.counts[t] || 0);
        el.classList.toggle('empty', t !== 'x1' && !(ammo.counts[t] > 0));
    });

    // Missili
    const mMap = { 'r-310':'r310', 'plt-2026':'plt2026', 'plt-3030':'plt3030', 'pld-8':'pld8', 'agt-500':'agt500' };
    Object.entries(mMap).forEach(([type, id]) => {
        const el = document.getElementById('ab-' + id);
        if (!el) return;
        el.classList.toggle('active-ammo', missle.selected === type);
        const cnt = document.getElementById('cnt-' + id);
        if (cnt) cnt.textContent = (missle.counts && missle.counts[type]) || 0;
        el.classList.toggle('empty', !((missle.counts && missle.counts[type]) > 0));
    });

    // Mine e speciali
    const specials = [
        { id: 'mine',   key: 'mine-normal', src: mine },
        { id: 'smines', key: 'mine-slow',   src: mine },
        { id: 'sbomb',  key: 'smart-bomb',  src: mine },
        { id: 'emp',    key: 'emp-01',      src: emp  }
    ];
    specials.forEach(({id, key, src}) => {
        const cnt = document.getElementById('cnt-' + id);
        if (cnt) cnt.textContent = (src.counts && src.counts[key]) || 0;
        const el = document.getElementById('ab-' + id);
        if (el) {
            el.classList.toggle('empty', !((src.counts && src.counts[key]) > 0));
            el.classList.toggle('active-ammo', player.selectedSpecial === key);
        }
    });
}

// Click sugli slot dell'action bar — setup dopo il rendering iniziale
function setupActionBarListeners() {
    document.querySelectorAll('.ab-slot[data-ammo]').forEach(el => {
        el.addEventListener('click', () => { player.selectLaserAmmo(el.dataset.ammo); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_laser.mp3', 0.6); });
    });
    document.querySelectorAll('.ab-slot[data-missile]').forEach(el => {
        el.addEventListener('click', () => { player.selectMissile(el.dataset.missile); updateActionBar(); if(typeof window.playSfx === 'function') window.playSfx('audio/switch_missili.mp3', 0.6); });
    });
    document.getElementById('ab-mine')?.addEventListener('click', () => { player.selectSpecial('mine-normal'); updateActionBar(); });
    document.getElementById('ab-smines')?.addEventListener('click', () => { player.selectSpecial('mine-slow'); updateActionBar(); });
    document.getElementById('ab-sbomb')?.addEventListener('click', () => { player.selectSpecial('smart-bomb'); updateActionBar(); });
    document.getElementById('ab-emp')?.addEventListener('click', () => { player.selectSpecial('emp-01'); updateActionBar(); });
}
// Esegui subito (gli script sono in fondo al body, DOM già pronto)
setupActionBarListeners();

let lastTime = 0;
let lastStatsUpdate = 0;

function drawMinimap(ctx) {
    const mmSize = 200;
    const mmX = canvas.width  - mmSize - 20;
    const mmY = canvas.height - mmSize - 20;
    const WORLD_RADIUS = 10000;
    const WORLD_DIAM   = WORLD_RADIUS * 2;
    const scale = mmSize / WORLD_DIAM; // 0.02
    const cx = mmX + mmSize / 2;
    const cy = mmY + mmSize / 2;

    // Sfondo + bordo
    ctx.fillStyle   = 'rgba(8,12,20,0.85)';
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth   = 2;
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

    ctx.save();
    ctx.beginPath(); ctx.rect(mmX, mmY, mmSize, mmSize); ctx.clip();

    // Cerchio limite mondo
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(cx, cy, WORLD_RADIUS * scale, 0, Math.PI * 2); ctx.stroke();

    // Rettangolo viewport corrente
    const vpLeft = camera.x, vpTop = camera.y;
    const vpW = canvas.width, vpH = canvas.height;
    ctx.strokeStyle = 'rgba(94,234,212,0.3)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(cx + vpLeft * scale, cy + vpTop * scale, vpW * scale, vpH * scale);

    // Raggio di rilevamento altri player (in unità mondo)
    const PLAYER_DETECT_RANGE = 800;

    for (let ent of entityManager.entities) {
        if (ent.isDead) continue;
        const ex = ent.x, ey = ent.y;
        const mx = cx + ex * scale;
        const my = cy + ey * scale;

        if (ent === player) {
            // ── Player locale: sempre visibile con freccia direzionale ──
            ctx.fillStyle = '#5EEAD4';
            ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI*2); ctx.fill();
            ctx.save(); ctx.translate(mx, my); ctx.rotate(player.angle);
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-3,3); ctx.lineTo(-3,-3); ctx.fill();
            ctx.restore();

        } else if (ent instanceof Enemy) {
            // ── Alieni: SEMPRE visibili sulla minimappa (radar completo) ──
            ctx.fillStyle = ent.color || '#ef4444';
            ctx.fillRect(mx-2, my-2, 4, 4);

        } else if (ent instanceof OtherPlayer) {
            // ── Altri player: visibili SOLO se entro raggio d'azione O se in Party ──
            const dist = Math.hypot(ent.x - player.x, ent.y - player.y);
            const isPartyMember = player.party && player.party.members && player.party.members.some(m => m.username === ent.id);
            if (dist <= PLAYER_DETECT_RANGE || isPartyMember) {
                // Colore per fazione
                let pColor = '#3B82F6'; // blu default
                if (isPartyMember) pColor = '#10b981'; // VERDE PARTY
                else if (ent.faction === 'MMO') pColor = '#ef4444';
                else if (ent.faction === 'EIC') pColor = '#3B82F6';
                else if (ent.faction === 'VRU') pColor = '#22c55e';
                ctx.fillStyle = pColor;
                ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI*2); ctx.fill();
                // Cerchio tratteggiato per indicare "rilevato" (solo se nel raggio, per far capire)
                if (dist <= PLAYER_DETECT_RANGE) {
                    ctx.strokeStyle = pColor;
                    ctx.globalAlpha = 0.5;
                    ctx.lineWidth = 0.5;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI*2); ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;
                }
            }

        } else if (ent instanceof Resource) {
            // Risorse: solo nel viewport
            const er = ent.radius || 8;
            if (ex + er >= vpLeft && ex - er <= vpLeft + vpW &&
                ey + er >= vpTop  && ey - er <= vpTop  + vpH) {
                ctx.fillStyle = '#facc15';
                ctx.fillRect(mx-1.5, my-1.5, 3, 3);
            }

        } else if (ent instanceof BaseStation) {
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(mx-5, my-5, 10, 10);

        } else if (ent instanceof Turret) {
            ctx.fillStyle = '#64748b';
            ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, Math.PI*2); ctx.fill();

        } else if (ent instanceof Portal) {
            ctx.fillStyle = '#d946ef';
            ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI*2); ctx.fill();

        } else if (typeof Mine !== 'undefined' && ent instanceof Mine) {
            // Mine: solo nel viewport
            const er = ent.radius || 12;
            if (ex + er >= vpLeft && ex - er <= vpLeft + vpW &&
                ey + er >= vpTop  && ey - er <= vpTop  + vpH) {
                ctx.fillStyle = ent.color || '#dc2626';
                ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    // Cerchio raggio rilevamento player (sottile, centrato sul player)
    const prx = cx + player.x * scale;
    const pry = cy + player.y * scale;
    ctx.strokeStyle = 'rgba(94,234,212,0.25)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(prx, pry, PLAYER_DETECT_RANGE * scale, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Label RADAR
    ctx.fillStyle = 'rgba(94,234,212,0.5)';
    ctx.font = '9px Courier New'; ctx.textAlign = 'left';
    ctx.fillText('RADAR', mmX+4, mmY+11);
}

function gameLoop(timestamp) {
  // Clamp deltaTime: se la finestra era minimizzata/sospesa il timestamp
  // può avere un gap di secondi → limitiamo a 100ms per evitare salti fisici
  // e sparizione delle entità dal mondo.
  const rawDelta = (timestamp - lastTime) / 1000;
  const deltaTime = Math.min(rawDelta, 0.1);
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let bgColor = '#0D1117';
  let starColor = '#ffffff';
  if (typeof mapManager !== 'undefined' && mapManager.maps[mapManager.currentMap]) {
      bgColor = mapManager.maps[mapManager.currentMap].bgColor || bgColor;
      starColor = mapManager.maps[mapManager.currentMap].starColor || starColor;
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  
  // Disegna Nebulose (Background profondissimo) - RIMOSSE

  // Disegna Pianeti (Background medio)
  for (let el of backgroundElements) {
      if (el.type !== 'planet') continue;
      // Coordinate parallasse cicliche (per ripetere i pianeti nell'infinito spaziale)
      let px = (el.x - camera.x * el.speed) % 10000; if (px < -5000) px += 10000;
      let py = (el.y - camera.y * el.speed) % 10000; if (py < -5000) py += 10000;
      
      const screenX = px + canvas.width/2;
      const screenY = py + canvas.height/2;
      
      // Viewport culling rigoroso
      if (screenX + el.radius * 2.2 < 0 || screenX - el.radius * 2.2 > canvas.width || 
          screenY + el.radius * 2.2 < 0 || screenY - el.radius * 2.2 > canvas.height) {
          continue;
      }
      
      ctx.save();
      ctx.translate(screenX, screenY);
      
      // Anello planetario (dietro il pianeta)
      if (el.hasRing) {
          ctx.save();
          ctx.rotate(el.ringAngle);
          ctx.beginPath();
          ctx.ellipse(0, 0, el.radius * 2.2, el.radius * 0.4, 0, 0, Math.PI * 2);
          ctx.lineWidth = el.radius * 0.2;
          ctx.strokeStyle = el.ringColor;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.ellipse(0, 0, el.radius * 1.8, el.radius * 0.3, 0, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = el.glow;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.restore();
      }

      // Corpo del pianeta
      const pGrad = ctx.createRadialGradient(-el.radius*0.3, -el.radius*0.3, el.radius*0.1, 0, 0, el.radius);
      pGrad.addColorStop(0, el.glow);
      pGrad.addColorStop(0.8, el.color);
      pGrad.addColorStop(1, '#020617'); // Ombra scura ai bordi
      
      ctx.beginPath();
      ctx.arc(0, 0, el.radius, 0, Math.PI * 2);
      ctx.fillStyle = pGrad;
      ctx.fill();
      
      // Alone atmosferico
      const atmGrad = ctx.createRadialGradient(0, 0, el.radius*0.9, 0, 0, el.radius*1.2);
      atmGrad.addColorStop(0, 'transparent');
      atmGrad.addColorStop(0.5, el.glow + '44'); // Trasparente
      atmGrad.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.arc(0, 0, el.radius*1.2, 0, Math.PI*2);
      ctx.fillStyle = atmGrad;
      ctx.fill();
      
      ctx.restore();
  }

  // Disegna Stelle (Background in primo piano per parallasse)
  for (let star of stars) {
      let sx = (star.x - camera.x * star.speed) % 4000; if (sx < 0) sx += 4000;
      let sy = (star.y - camera.y * star.speed) % 4000; if (sy < 0) sy += 4000;
      
      const screenX = sx - 2000 + canvas.width/2;
      const screenY = sy - 2000 + canvas.height/2;
      
      // Viewport culling per le stelle
      if (screenX + star.size < 0 || screenX - star.size > canvas.width || 
          screenY + star.size < 0 || screenY - star.size > canvas.height) {
          continue;
      }

      ctx.fillStyle = star.color || starColor;
      ctx.globalAlpha = star.alpha;
      
      if (star.type === 'bright') {
          ctx.beginPath();
          ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
          ctx.fill();
      } else {
          ctx.fillRect(screenX, screenY, star.size, star.size);
      }
  }
  ctx.restore();

  if (gameState === 'playing' || gameState === 'hangar' || gameState === 'shop') {
      inputManager.update();
      const oldX = player.x;
      const oldY = player.y;
      const oldAngle = player.angle;
      entityManager.update(deltaTime);
      if (skylabManager) skylabManager.update(player);

      const distFromCenter = Math.sqrt(player.x*player.x + player.y*player.y);
      if (distFromCenter > 10000) {
          const pushForce = 10000 / distFromCenter;
          player.x *= pushForce;
          player.y *= pushForce;
          player.targetX = player.x;
          player.targetY = player.y;
      }

      camera.follow(player);

      if (oldX !== player.x || oldY !== player.y || oldAngle !== player.angle || player.isRegenerating !== player.lastRegen || player.isShieldRegen !== player.lastShieldRegen || player.sprintExhausted !== player.lastSprint) {
          wsClient.sendMove(player.x, player.y, player.angle, player.isRegenerating, player.isShieldRegen, player.sprintExhausted);
          player.lastRegen = player.isRegenerating;
          player.lastShieldRegen = player.isShieldRegen;
          player.lastSprint = player.sprintExhausted;
      }

      if (timestamp - lastStatsUpdate > 5000) {
          wsClient.sendUpdateStats(player.hp, player.maxHp, player.shipType, player.equipped.drones);
          if (typeof wsClient.sendSyncFullState === 'function') wsClient.sendSyncFullState();
          lastStatsUpdate = timestamp;
      }
      // NOTA: la morte è gestita esclusivamente via player.die() → notifyDead → youDied dal server.
      // Non serve safety-net qui: interferirebbe con il respawn.
  } else if (gameState === 'menu') {
      entityManager.update(deltaTime);
      camera.follow(player);
  }

  if (gameState === 'playing' || gameState === 'hangar' || gameState === 'shop' || gameState === 'menu') {
      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 10000, 0, Math.PI * 2);
      ctx.lineWidth = 100;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 10000, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.stroke();
      ctx.restore();
      entityManager.draw(ctx);
      ctx.restore();
      if (gameState === 'playing') {
          drawMinimap(ctx);
      }
  }

function drawSprintBar(ctx, p) {
    if (gameState !== 'playing') return;
    if (!p || p.isDead || p.maxSprint === undefined) return;

    const pct   = Math.max(0, Math.min(1, p.sprint / p.maxSprint));
    const barW  = 80;
    const barH  = 6;
    const bx    = p.x - camera.x - barW / 2;
    const by    = p.y - camera.y + p.radius + 20;

    // Sfondo
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    // Barra: verde → giallo → rosso in base al livello
    let barColor;
    if (p.sprintExhausted || pct < 0.05) {
        barColor = '#ef4444'; // rosso vuoto
    } else if (pct < 0.30) {
        barColor = '#f97316'; // arancione basso
    } else if (pct < 0.60) {
        barColor = '#facc15'; // giallo medio
    } else {
        barColor = '#22d3ee'; // ciano pieno
    }

    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, barW * pct, barH);

    // Bordo
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, by, barW, barH);

    // Label "SPRINT" a sinistra
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('SPRINT', p.x - camera.x, by - 2);

    // Se esaurito: testo lampeggiante
    if (p.sprintExhausted) {
        if (Math.floor(Date.now() / 400) % 2 === 0) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 9px Courier New';
            ctx.fillText('EXHAUSTED', p.x - camera.x, by + barH + 10);
        }
    }
}

  // ── Aggiorna bottone BASE in base alla distanza dalla propria base ────────
  if (gameState === 'playing' && player.faction && typeof mapManager !== 'undefined') {
    const FACTION_BASES = {
      MMO: { x: 0,        y: -8000 },
      EIC: { x:  Math.cos(Math.PI/6)*8000, y: Math.sin(Math.PI/6)*8000 },
      VRU: { x: -Math.cos(Math.PI/6)*8000, y: Math.sin(Math.PI/6)*8000 }
    };
    const myBase = FACTION_BASES[player.faction];
    if (myBase) {
      const distFromBase = Math.hypot(player.x - myBase.x, player.y - myBase.y);
      uiManager.updateBaseButton(distFromBase);
    }
  }

uiManager.update(player);
  updateActionBar();

  // ── Aggiorna mini-HUD Pilot Level/EXP ──────────────────────────────────
  if (gameState === 'playing') {
    const lvlEl = document.getElementById('hud-pilot-level');
    const spEl  = document.getElementById('hud-pilot-sp');
    const barEl = document.getElementById('bar-pilot-exp');
    if (lvlEl) lvlEl.textContent = player.pilotLevel || 1;
    if (spEl)  spEl.textContent  = player.skillPoints || 0;
    if (barEl) {
      const exp    = player.pilotExp  || 0;
      const needed = player.expNeeded || 1000;
      barEl.style.width = Math.min(100, Math.floor((exp / needed) * 100)) + '%';
    }
  }

  // Usa requestAnimationFrame normalmente; il background throttling
  // è già disabilitato da Electron (backgroundThrottling: false).
  // Come ulteriore safety: se la pagina è hidden usa setTimeout a 50ms (20fps)
  // invece di RAF che potrebbe fermarsi del tutto.
  if (document.hidden) {
    setTimeout(() => requestAnimationFrame(gameLoop), 50);
  } else {
    requestAnimationFrame(gameLoop);
  }
}

uiManager.showScreen(gameState);
requestAnimationFrame(gameLoop);

// ════════════════════════════════════════════════════════════
//  LOG DI BORDO — pannello in basso a sinistra
//  Mostra: connessioni, disconnessioni, kill PvP, boss sconfitti
//  Visibile SOLO durante gameState === 'playing'
// ════════════════════════════════════════════════════════════
(function initBoardLog() {
    // Crea il pannello se non esiste già
    if (document.getElementById('board-log-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'board-log-panel';
    panel.style.display = 'none'; // nascosto di default
    panel.innerHTML = `
        <div id="board-log-header">
            <span>📡 SHIP LOG</span>
            <button id="board-log-toggle" title="Minimize/Expand">−</button>
        </div>
        <div id="board-log-entries"></div>
    `;
    document.body.appendChild(panel);

    // Toggle minimizza
    let collapsed = false;
    document.getElementById('board-log-toggle').addEventListener('click', () => {
        collapsed = !collapsed;
        const entries = document.getElementById('board-log-entries');
        entries.style.display = collapsed ? 'none' : 'flex';
        document.getElementById('board-log-toggle').textContent = collapsed ? '+' : '−';
        panel.style.height = collapsed ? 'auto' : '';
    });
})();

const BOARD_LOG_MAX = 30;

// Faction symbol + color map (mirrors FACTION_COLORS/FACTION_SYMBOLS in game.js)
const LOG_FACTION_COLORS  = { MMO: '#ef4444', EIC: '#3b82f6', VRU: '#22c55e' };
const LOG_FACTION_SYMBOLS = { MMO: '⬡', EIC: '⬡', VRU: '⬡' };
function logFactionTag(faction) {
    if (!faction || !LOG_FACTION_COLORS[faction]) return '';
    const col = LOG_FACTION_COLORS[faction];
    const sym = LOG_FACTION_SYMBOLS[faction];
    return `<span style="color:${col};font-size:10px;margin-right:3px;">${sym}</span>`;
}

/**
 * Adds an entry to the board log.
 * data = { message, color, eventType, killerFaction, victimFaction, faction }
 */
window.addBoardLogEntry = function(message, color, data) {
    const entries = document.getElementById('board-log-entries');
    if (!entries) return;

    const evt = (data && data.eventType) || '';

    const row = document.createElement('div');
    row.className = 'board-log-row board-log-new';

    let html = '';

    if (evt === 'kill') {
        // KILL: bold colored, faction symbols on both sides
        // message = "KillerName killed VictimName"
        const kFac = logFactionTag(data.killerFaction);
        const vFac = logFactionTag(data.victimFaction);
        // Split on " killed "
        const parts = message.split(' killed ');
        const killer = parts[0] || message;
        const victim = parts[1] || '';
        html = `<span class="blog-kill-icon">💀</span> `
             + `${kFac}<span class="blog-kill-name">${killer}</span>`
             + `<span class="blog-kill-verb"> killed </span>`
             + `${vFac}<span class="blog-kill-victim">${victim}</span>`;
        row.classList.add('log-kill');

    } else if (evt === 'boss') {
        // BOSS: gold, faction symbol of killer, ⚔ icon
        const kFac = logFactionTag(data.killerFaction);
        html = `<span class="blog-boss-icon">⚔️</span> `
             + `${kFac}<span class="blog-boss-text">${message}</span>`;
        row.classList.add('log-boss');

    } else if (evt === 'connect') {
        // CONNECT: neutral, faction symbol, no emoji dot
        const fTag = logFactionTag(data && data.faction);
        html = `${fTag}<span class="blog-neutral">${message}</span>`;
        row.classList.add('log-online');

    } else if (evt === 'disconnect') {
        // DISCONNECT: neutral dimmed, faction symbol, no emoji dot
        const fTag = logFactionTag(data && data.faction);
        html = `${fTag}<span class="blog-neutral blog-dimmed">${message}</span>`;
        row.classList.add('log-offline');

    } else {
        // Fallback
        html = `<span style="color:${color||'#a0aec0'}">${message}</span>`;
    }

    row.innerHTML = html;
    entries.appendChild(row);

    setTimeout(() => row.classList.remove('board-log-new'), 500);

    while (entries.children.length > BOARD_LOG_MAX) {
        entries.removeChild(entries.firstChild);
    }
    entries.scrollTop = entries.scrollHeight;

    // Blink header when collapsed
    const header = document.getElementById('board-log-header');
    if (header && document.getElementById('board-log-entries').style.display === 'none') {
        header.classList.add('board-log-blink');
        setTimeout(() => header.classList.remove('board-log-blink'), 1200);
    }
};
