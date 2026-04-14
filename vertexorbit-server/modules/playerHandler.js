// ============================================================
//  playerHandler.js — Login, sync stato, stats, leaderboard
// ============================================================
const WebSocket = require('ws');
const fs   = require('fs');
const path = require('path');
const { initDB, loadUserData, saveUserData, getAllUsersData: getAllUsersDataDB } = require('../db');
const { bases } = require('./config');
const { maps }  = require('./maps');

const clients = new Map();

// ============================================================
//  SPECCHIO Items.js lato server — fonte di verità per scudi
// ============================================================
const SHIELD_VALUES = {
    'sg3n-b01': 4000,
    'sg3n-b02': 10000,
    'sg3n-b03': 18000,
    // aggiungere qui i nuovi scudi se inseriti in Items.js
};
const SHIP_SHIELD_SLOTS = {
    phoenix: 1, liberator: 2, nostromo: 3, bigboy: 4, leonov: 5,
    vengeance: 6, goliath: 15, spearhead: 5, citadel: 20
};

/**
 * Calcola maxShield, usedShieldSlots, shieldRings (1/2/3 cerchi) 
 * dalla config attiva del player. Questa è l'unica fonte di verità lato server.
 * shieldRings: 1 = almeno 1 scudo, 2 = ≥50% slot occupati, 3 = 100% slot occupati
 */
function calcShieldStats(configs, activeConfig) {
    const cfg = configs ? (configs[activeConfig] || configs[String(activeConfig)] || configs[1] || configs['1']) : null;
    if (!cfg) return { maxShield: 0, shield: 0, usedShieldSlots: 0, shieldSlots: 1, shieldRings: 0 };

    const shipType = cfg.shipType || 'phoenix';
    const shieldSlots = SHIP_SHIELD_SLOTS[shipType] || 1;
    let maxShield = 0;
    let usedSlots = 0;

    // Scudi dalla nave
    if (cfg.shields && cfg.shields.length > 0) {
        cfg.shields.forEach(s => {
            if (s && SHIELD_VALUES[s]) { maxShield += SHIELD_VALUES[s]; usedSlots++; }
        });
    }
    // Scudi dai droneItems (item equip sui droni)
    if (cfg.droneItems && cfg.droneItems.length > 0) {
        cfg.droneItems.forEach(dArr => {
            if (!Array.isArray(dArr)) return;
            dArr.forEach(item => {
                if (item && SHIELD_VALUES[item]) { maxShield += SHIELD_VALUES[item]; usedSlots++; }
            });
        });
    }

    const fillRatio = shieldSlots > 0 ? (usedSlots / shieldSlots) : 0;
    let shieldRings = 0;
    if (usedSlots >= 1) shieldRings = 1;
    if (fillRatio >= 0.5) shieldRings = 2;
    if (fillRatio >= 1.0) shieldRings = 3;

    return { maxShield, shield: maxShield, usedShieldSlots: usedSlots, shieldSlots, shieldRings, fillRatio };
}

// ── Tabella stiva per nave (specchio di Items.js) ─────────────
const SHIP_CARGO = {
    phoenix:   200,
    liberator: 500,
    nostromo:  1000,
    bigboy:    1600,
    leonov:    1200,
    vengeance: 2000,
    goliath:   3000,
    spearhead: 1200,
    citadel:   6000
};

function getMaxCargoForShip(shipType) {
    return SHIP_CARGO[shipType] || 100;
}

// ── Default munizioni (usato per nuovi utenti e migrazione) ──
const DEFAULT_AMMO = {
    ammo:        { laserAmmo: 'x1', counts: { x1: 999999, x2: 500, x3: 200, x4: 100, sab: 100 } },
    missileAmmo: { selected: 'plt-2026', counts: { 'r-310': 50, 'plt-2026': 30, 'plt-3030': 10, 'pld-8': 20, 'agt-500': 5 } },
    mineAmmo:    { selected: 'mine-normal', counts: { 'mine-normal': 10, 'mine-slow': 10, 'smart-bomb': 3 } },
    empAmmo:     { counts: { 'emp-01': 5 } }
};

// ── Helpers ──────────────────────────────────────────────────
function sendPlayerStats(player) {
    if (!player || !player.ws || player.ws.readyState !== WebSocket.OPEN) return;
    player.ws.send(JSON.stringify({
        type: 'playerStats',
        data: {
            hp: player.hp, maxHp: player.maxHp,
            credits: player.credits || 0,
            score:   player.score   || 0,
            kills:   player.kills   || 0,
            deaths:  player.deaths  || 0,
            cargo:   player.cargo   || 0
        }
    }));
}

function persistPlayerMeta(player) {
    if (!player || !player.username) return;
    const saved = loadUserData(player.username) || {};
    Object.assign(saved, {
        score:        player.score        ?? saved.score        ?? 0,
        kills:        player.kills        ?? saved.kills        ?? 0,
        playerKills:  player.playerKills  ?? saved.playerKills  ?? 0,
        alienKills:   player.alienKills   ?? saved.alienKills   ?? 0,
        deaths:       player.deaths       ?? saved.deaths       ?? 0,
        credits:      player.credits      ?? saved.credits      ?? 0,
        cargo:        player.cargo        ?? saved.cargo        ?? 0,
        maxCargo:     getMaxCargoForShip(player.shipType || 'phoenix'),
        shipType:     player.shipType     || saved.shipType     || 'phoenix',
        activeConfig: player.activeConfig ?? saved.activeConfig ?? 1,
    });
    if (player.materials)  saved.materials  = player.materials;
    if (player.inventory)  saved.inventory  = player.inventory;
    if (player.configs)    saved.configs    = player.configs;
    if (player.lootCargo)  saved.lootCargo  = player.lootCargo;
    if (player.pilotLevel !== undefined)  saved.pilotLevel  = player.pilotLevel;
    if (player.pilotExp !== undefined)    saved.pilotExp    = player.pilotExp;
    if (player.skillPoints !== undefined) saved.skillPoints = player.skillPoints;
    if (player.pilotSkills)               saved.pilotSkills = player.pilotSkills;
    saveUserData(player.username, saved);
}

function addCredits(player, amount) {
    player.credits = (player.credits || 0) + amount;
    if (player.credits < 0) player.credits = 0;
}

// ── Sistema EXP / Livelli Pilota ──────────────────────────────
/**
 * EXP necessaria per passare dal livello `lvl` a `lvl+1`
 * Formula: 1000 * lvl * (1 + lvl * 0.1)
 */
function expForLevel(lvl) {
    return Math.floor(1000 * lvl * (1 + lvl * 0.1));
}

const DEFAULT_PILOT_SKILLS = {
    hp: 0, speed: 0, sprint: 0, shield: 0, damage: 0,
    laser: 0, missile: 0, coins: 0, loot: 0, exp: 0
};

/**
 * Assegna EXP al player (solo da kill alieni).
 * Gestisce level-up multipli, aggiorna skillPoints, notifica il client.
 * @param {object} player  - oggetto player server-side
 * @param {number} baseExp - EXP base dell'alieno
 */
function addPilotExp(player, baseExp) {
    if (!player || player.isDead) return;

    // Inizializza campi se assenti (utenti vecchi)
    if (player.pilotLevel    === undefined) player.pilotLevel    = 1;
    if (player.pilotExp      === undefined) player.pilotExp      = 0;
    if (player.skillPoints   === undefined) player.skillPoints   = 0;
    if (!player.pilotSkills)               player.pilotSkills   = { ...DEFAULT_PILOT_SKILLS };

    // Applica moltiplicatore skill Extra EXP
    const expMult = 1 + ((player.pilotSkills.exp || 0) / 100);
    const gained  = Math.floor(baseExp * expMult);

    player.pilotExp += gained;

    let levelsGained = 0;
    // Level-up loop (supporta multi-level in un tick)
    while (player.pilotLevel < 100) {
        const needed = expForLevel(player.pilotLevel);
        if (player.pilotExp < needed) break;
        player.pilotExp -= needed;
        player.pilotLevel += 1;
        player.skillPoints = Math.min(100, (player.skillPoints || 0) + 1);
        levelsGained++;
    }
    // Al max livello azzera l'eccesso
    if (player.pilotLevel >= 100) player.pilotExp = 0;

    persistPlayerMeta(player);

    // Notifica il client
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({
            type: 'expGain',
            gained,
            pilotExp:    player.pilotExp,
            pilotLevel:  player.pilotLevel,
            skillPoints: player.skillPoints,
            expNeeded:   player.pilotLevel < 100 ? expForLevel(player.pilotLevel) : 0,
            levelUp:     levelsGained > 0,
            levelsGained
        }));
    }
}

// ── Leaderboard ──────────────────────────────────────────────
function getAllUsersData() {
    // Usa il DB SQLite (migrato da database.json)
    return getAllUsersDataDB();
}

function broadcastLeaderboard() {
    const users = getAllUsersData();
    maps['Arena'].players.forEach(p => {
        const u = users.find(x => x.username === p.username);
        if (u) {
            u.score       = p.score;
            u.playerKills = p.playerKills || 0;
            u.alienKills  = p.alienKills  || 0;
            u.deaths      = p.deaths;
            u.pilotLevel  = p.pilotLevel;
        }
    });
    users.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top10 = users.slice(0, 10).map((u, i) => ({
        rank: i + 1,
        username: u.username, faction: u.faction,
        score: u.score || 0,
        playerKills: u.playerKills || 0,
        alienKills:  u.alienKills  || 0,
        pilotLevel:  u.pilotLevel  || 1
    }));
    const msg = JSON.stringify({ type: 'leaderboard', data: top10 });
    maps['Arena'].players.forEach(p => {
        if (p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
    });
}

function sendLeaderboard(ws) {
    const requestingPlayer = [...maps['Arena'].players.values()].find(p => p.ws === ws);
    const users = getAllUsersData();
    maps['Arena'].players.forEach(p => {
        const u = users.find(x => x.username === p.username);
        if (u) {
            u.score       = p.score;
            u.playerKills = p.playerKills || 0;
            u.alienKills  = p.alienKills  || 0;
            u.pilotLevel  = p.pilotLevel;
        }
    });
    users.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top10 = users.slice(0, 10).map((u, i) => ({
        rank: i + 1,
        username: u.username, faction: u.faction,
        score: u.score || 0,
        playerKills: u.playerKills || 0,
        alienKills:  u.alienKills  || 0,
        pilotLevel:  u.pilotLevel  || 1
    }));
    let myRank = null;
    if (requestingPlayer) {
        const myIdx = users.findIndex(u => u.username === requestingPlayer.username);
        myRank = myIdx >= 0 ? myIdx + 1 : null;
    }
    ws.send(JSON.stringify({ type: 'leaderboard', data: top10, myRank, totalPlayers: users.length }));
}

// ── handleLogin ───────────────────────────────────────────────
function handleLogin(ws, data) {
    const username = data.username;
    let userData   = loadUserData(username);
    const faction  = data.faction || 'MMO';
    // HP base per nave — DEVE essere identico a Items.js lato client
    const SHIP_HP  = { phoenix: 4000, liberator: 16000, nostromo: 64000, bigboy: 128000, leonov: 64000, vengeance: 180000, goliath: 256000, spearhead: 100000, citadel: 512000 };

    if (!userData) {
        // Nuovo utente: spawn alla base della fazione scelta alla registrazione
        const spawnPos = bases[faction] || { x: 0, y: 0 };
        userData = {
            username, faction, map: 'Arena', x: spawnPos.x, y: spawnPos.y, shipType: 'phoenix',
            hp: 4000, maxHp: 4000, credits: 100000, uridium: 50000, cargo: 0, maxCargo: 100,
            score: 0, kills: 0, deaths: 0,
            materials: { prometium:0,endurium:0,terbium:0,prometid:0,duranium:0,promerium:0,seprom:0 },
            inventory: { lasers:['lf2','lf2','lf3'],shields:['sg3n-b01'],generators:['g3n-7900','g3n-7900'],missiles:['plt-2026'],drones:['flax'],cpus:['auto-rocket'],pets:[],ships:['phoenix'] },
            configs: {
                1: { shipType: 'phoenix', lasers:['lf2'],shields:[],generators:['g3n-7900'],cpus:['auto-rocket'],missiles:['plt-2026'],drones:['flax'],droneItems:[[]],pets:[] },
                2: { shipType: 'phoenix', lasers:[],shields:['sg3n-b01'],generators:[],cpus:[],missiles:['plt-2026'],drones:['flax'],droneItems:[[]],pets:[] }
            },
            activeConfig: 1,
            ...DEFAULT_AMMO
        };
        saveUserData(username, userData);
    }

    // ── Fix campi mancanti per utenti vecchi ─────────────────
    if (userData.score    === undefined) { userData.score=0; userData.kills=0; userData.deaths=0; }
    if (userData.playerKills === undefined) userData.playerKills = 0;
    if (userData.alienKills  === undefined) userData.alienKills  = 0;
    // NON sovrascrivere la fazione per utenti esistenti — usa quella salvata
    // (la fazione al login è rilevante solo per i nuovi utenti, gestita in registerUser)
    if (!userData.faction) userData.faction = faction;
    if (userData.credits  === undefined) userData.credits  = 100000;
    if (userData.cargo    === undefined) userData.cargo    = 0;
    // Ricalcola sempre maxCargo dalla nave corrente (non fidarsi del valore salvato)
    userData.maxCargo = getMaxCargoForShip(userData.shipType || 'phoenix');
    // Ricalcola sempre maxHp dalla nave (evita valori corrotti dal DB)
    userData.maxHp = SHIP_HP[userData.shipType] || 4000;
    if ((userData.hp || 0) > userData.maxHp) userData.hp = userData.maxHp;
    if (!userData.materials) userData.materials = { prometium:0,endurium:0,terbium:0,prometid:0,duranium:0,promerium:0,seprom:0 };
    if (!userData.inventory) userData.inventory = { lasers:['lf2'],shields:['sg3n-b01'],generators:['g3n-7900'],missiles:['plt-2026'],drones:['flax'],cpus:['auto-rocket'],pets:[] };
    ['lasers','shields','generators','missiles','drones','cpus','pets'].forEach(k => {
        if (!userData.inventory[k]) userData.inventory[k] = k === 'missiles' ? ['plt-2026'] : [];
    });
    // Flotta navi — migrazione utenti che non ce l'hanno ancora
    if (!userData.inventory.ships) userData.inventory.ships = [userData.shipType || 'phoenix'];
    if (!userData.configs) userData.configs = {
        1: { shipType: 'phoenix', lasers:[],shields:[],generators:[],cpus:[],missiles:['plt-2026'],drones:[],droneItems:[],pets:[] },
        2: { shipType: 'phoenix', lasers:[],shields:[],generators:[],cpus:[],missiles:['plt-2026'],drones:[],droneItems:[],pets:[] }
    };
    // Normalizza: crea chiavi sia numeriche che stringa per robustezza
    [1, 2, '1', '2'].forEach(cfgId => {
        if (!userData.configs[cfgId]) {
            userData.configs[cfgId] = userData.configs[String(cfgId)] || userData.configs[Number(cfgId)] || {
                shipType: userData.shipType || 'phoenix', lasers:[], shields:[], generators:[], cpus:[], missiles:['plt-2026'], drones:[], droneItems:[], pets:[]
            };
        }
        const cfg = userData.configs[cfgId];
        if (!cfg.shipType) cfg.shipType = userData.shipType || 'phoenix';
        ['lasers','shields','generators','cpus','drones','droneItems','pets'].forEach(k => { if (!cfg[k]) cfg[k] = []; });
        if (!cfg.missiles) cfg.missiles = ['plt-2026'];
    });
    // Normalizza activeConfig a number
    userData.activeConfig = Number(userData.activeConfig) || 1;
    const activeCfg = userData.configs[userData.activeConfig] || userData.configs[1];
    if (activeCfg && !activeCfg.missiles) activeCfg.missiles = ['plt-2026'];
    if (activeCfg && activeCfg.shipType) userData.shipType = activeCfg.shipType;

    // ── Munizioni: migrazione utenti vecchi ───────────────────
    if (!userData.ammo)        userData.ammo        = { ...DEFAULT_AMMO.ammo };
    if (!userData.missileAmmo) userData.missileAmmo = { ...DEFAULT_AMMO.missileAmmo };
    if (!userData.mineAmmo)    userData.mineAmmo    = { ...DEFAULT_AMMO.mineAmmo };
    if (!userData.empAmmo)     userData.empAmmo     = { ...DEFAULT_AMMO.empAmmo };

    // ── Pilot Skills: migrazione utenti vecchi ────────────────
    if (userData.pilotLevel  === undefined) userData.pilotLevel  = 1;
    if (userData.pilotExp    === undefined) userData.pilotExp    = 0;
    if (userData.skillPoints === undefined) userData.skillPoints = 0;
    if (!userData.pilotSkills) userData.pilotSkills = { ...DEFAULT_PILOT_SKILLS };

    saveUserData(username, userData);

    if (userData.map !== 'Arena') {
        userData.map = 'Arena';
        if (bases[userData.faction]) { userData.x = bases[userData.faction].x; userData.y = bases[userData.faction].y; }
    }

    // ── Ricalcola maxHp dalla nave (non fidarsi del valore salvato) ──────────
    const correctMaxHp = SHIP_HP[userData.shipType] || 4000;
    let correctHp = userData.hp !== undefined ? userData.hp : correctMaxHp;

    // Se l'utente si è disconnesso da morto (0 HP) o flaggato isDead
    // Gestione disconnessione durante morte o reload forzato
    if (correctHp <= 0 || userData.isDead) {
        const base = bases[userData.faction] || { x: 0, y: 0 };
        userData.x = base.x;
        userData.y = base.y;
        correctHp = correctMaxHp;
        userData.isDead = false;
    } else {
        correctHp = Math.min(correctHp, correctMaxHp);
    }

    const player = {
        ws, username, faction: userData.faction, map: 'Arena',
        x: userData.x !== undefined ? userData.x : 0, 
        y: userData.y !== undefined ? userData.y : 0, angle: 0,
        shipType: userData.shipType || 'phoenix',
        hp: correctHp, maxHp: correctMaxHp, radius: 20,
        drones: userData.configs ? (userData.configs[userData.activeConfig]?.drones || []) : [],
        score: userData.score, kills: userData.kills, deaths: userData.deaths,
        playerKills: userData.playerKills || 0,
        alienKills:  userData.alienKills  || 0,
        credits: userData.credits, cargo: userData.cargo, maxCargo: userData.maxCargo,
        materials: userData.materials,
        inventory:    userData.inventory,
        configs:      userData.configs,
        activeConfig: userData.activeConfig || 1,
        lootCargo:    userData.lootCargo || {},
        ammo:         userData.ammo,
        missileAmmo:  userData.missileAmmo,
        mineAmmo:     userData.mineAmmo,
        empAmmo:      userData.empAmmo,
        // Pilot progression
        pilotLevel:   userData.pilotLevel,
        pilotExp:     userData.pilotExp,
        skillPoints:  userData.skillPoints,
        pilotSkills:  userData.pilotSkills,
        isDead: false
    };

    // ── Calcola scudi server-side dalla config attiva ──────────────
    const shieldData = calcShieldStats(userData.configs, userData.activeConfig || 1);
    player.maxShield      = shieldData.maxShield;
    player.shield         = shieldData.shield;
    player.shieldSlots    = shieldData.shieldSlots;
    player.usedShieldSlots= shieldData.usedShieldSlots;
    player.shieldRings    = shieldData.shieldRings;
    player.fillRatio      = shieldData.fillRatio;
    // Equipped da trasmettere al client per il rendering cerchi scudo
    player.equipped       = userData.configs ? (userData.configs[userData.activeConfig || 1] || {}) : {};

    // Se l'utente ha un PET nell'equipaggiamento, crealo anche sul server per la sincronizzazione
    if (userData.configs && userData.configs[userData.activeConfig] && 
        userData.configs[userData.activeConfig].pets && 
        userData.configs[userData.activeConfig].pets.length > 0) {
        player.pet = {
            x: player.x + 50,
            y: player.y + 50,
            angle: 0
        };
    }

    clients.set(ws, player);
    maps['Arena'].players.set(username, player);
    ws.send(JSON.stringify({
        type: 'loginSuccess',
        data: {
            ...userData,
            pilotLevel:  player.pilotLevel,
            pilotExp:    player.pilotExp,
            skillPoints: player.skillPoints,
            pilotSkills: player.pilotSkills,
            expNeeded:   player.pilotLevel < 100 ? expForLevel(player.pilotLevel) : 0
        }
    }));
    sendPlayerStats(player);
    broadcastLeaderboard();
    // ── Board Log: player connesso ────────────────────────────
    setTimeout(() => broadcastBoardLog(`${username} connected`, '#64748b', { eventType: 'connect', faction: player.faction }), 500);
    return player;
}

// ── handleSyncFullState ───────────────────────────────────────
function handleSyncFullState(currentUser, data) {
    if (!data.state) return;
    const s = data.state;
    // Normalizza configs: garantisce chiavi ENTRAMBE (1 e "1") nel DB
    if (s.configs) {
        const raw = s.configs;
        const norm = {};
        [1, 2, '1', '2'].forEach(k => {
            norm[k] = raw[k] || raw[String(k)] || raw[Number(k)] || {
                shipType: 'phoenix', lasers:[], shields:[], generators:[], cpus:[],
                missiles:['plt-2026'], drones:[], droneItems:[], pets:[], petItems:[]
            };
        });
        s.configs = norm;
    }
    // Normalizza activeConfig a number
    if (s.activeConfig !== undefined) s.activeConfig = Number(s.activeConfig) || 1;
    // Aggiorna DB
    const saved = loadUserData(currentUser.username) || {};
    Object.assign(saved, s);
    saveUserData(currentUser.username, saved);
    // Aggiorna oggetto player in-memory con TUTTI i campi inviati
    const fields = [
        'x','y','angle','hp','shipType','credits','score','kills','deaths',
        'cargo','maxCargo','uridium','faction','materials',
        'inventory','configs','activeConfig','lootCargo',
        'ammo','missileAmmo','mineAmmo','empAmmo',
        'isSprinting','isCargoFull','isRegenerating','isShieldRegen',
        'sprintExhausted','empInvulnerable','slowDebuffColor'
    ];
    fields.forEach(k => { if (s[k] !== undefined) currentUser[k] = s[k]; });

    // ── Ricalcola scudi server-side dalla nuova config ─────────────
    const newActiveConfig = Number(s.activeConfig || currentUser.activeConfig) || 1;
    const configs = s.configs || currentUser.configs;
    if (configs) {
        const shieldData = calcShieldStats(configs, newActiveConfig);
        currentUser.maxShield       = shieldData.maxShield;
        currentUser.shieldSlots     = shieldData.shieldSlots;
        currentUser.usedShieldSlots = shieldData.usedShieldSlots;
        currentUser.shieldRings     = shieldData.shieldRings;
        currentUser.fillRatio       = shieldData.fillRatio;
        // Non sovrascrivere shield corrente se è ancora valido (es. ha ancora scudo in combattimento)
        if (currentUser.shield === undefined || currentUser.shield > currentUser.maxShield) {
            currentUser.shield = currentUser.maxShield;
        }
        // Aggiorna equipped per il broadcast worldUpdate
        currentUser.equipped = configs[newActiveConfig] || configs[String(newActiveConfig)] || {};
    }

    // Sincronizzazione PET se presente nello stato
    if (s.pet) {
        if (!currentUser.pet) currentUser.pet = { x: s.pet.x, y: s.pet.y, angle: s.pet.angle };
        else { 
            currentUser.pet.x = s.pet.x; 
            currentUser.pet.y = s.pet.y; 
            currentUser.pet.angle = s.pet.angle; 
        }
    }
    // Ricalcola maxCargo dalla nave (fonte di verità server-side)
    if (s.shipType) currentUser.maxCargo = getMaxCargoForShip(s.shipType);
    // Aggiorna drones dall'activeConfig
    if (s.configs && s.activeConfig) {
        const cfg = s.configs[s.activeConfig] || s.configs[String(s.activeConfig)];
        if (cfg?.drones) currentUser.drones = cfg.drones;
    }
}

// ── handlePlayerDeath ─────────────────────────────────────────
// Rimuove il player dalla mappa senza disconnetterlo:
// così non è più visibile agli alieni/altri player fino al respawn.
function handlePlayerDeath(currentUser) {
    if (!currentUser) return;
    
    // Genera cargo in base al contenuto della stiva (se ha qualcosa)
    if (currentUser.materials) {
        let totalRes = 0;
        const drops = [];
        
        // Verifica quante risorse ha
        Object.keys(currentUser.materials).forEach(mat => {
            const qty = Math.floor(currentUser.materials[mat] || 0);
            if (qty > 0) {
                totalRes += qty;
                drops.push({ type: mat, qty: qty });
            }
        });
        
        // Se ha almeno 1 risorsa, crea il cargo-box e poi svuota la stiva
        if (totalRes > 0 && maps[currentUser.map]) {
            const { getNextId } = require('./maps');
            const { LOOT_ITEMS } = require('./config');
            
            drops.forEach((drop) => {
                const angle = Math.random() * Math.PI * 2;
                const def = LOOT_ITEMS[drop.type] || LOOT_ITEMS['scrap_metal']; // Fallback
                
                // Arrotonda sempre la quantità all'intero più basso per sicurezza
                const safeQty = Math.floor(drop.qty);
                if (safeQty <= 0) return;
                
                const res = {
                    id: getNextId(),
                    x: currentUser.x + Math.cos(angle) * (20 + Math.random() * 40),
                    y: currentUser.y + Math.sin(angle) * (20 + Math.random() * 40),
                    resType: drop.type,
                    itemName: def ? def.name : drop.type,
                    rarity: def ? def.rarity : 'common',
                    isRare: def ? !!def.isRare : false,
                    color: def ? def.color : '#f59e0b',
                    value: def ? def.value : 10,
                    quantity: safeQty,
                    age: 0,
                    vx: Math.cos(angle) * (20 + Math.random() * 60),
                    vy: Math.sin(angle) * (20 + Math.random() * 60),
                    radius: 10,
                    isPlayerCargo: true
                };
                maps[currentUser.map].resources.set(res.id, res);
            });
            
            // Svuota la stiva
            Object.keys(currentUser.materials).forEach(mat => {
                currentUser.materials[mat] = 0;
            });
            currentUser.cargo = 0; // Azzera counter totale
            
            // Invia aggiornamento esplicito delle statistiche per aggiornare la stiva a UI
            sendPlayerStats(currentUser);
        }
    }

    currentUser.hp = 0;
    currentUser.isDead = true;
    // Rimuove dalla mappa → non verrà più incluso nel worldUpdate
    if (maps[currentUser.map]) {
        maps[currentUser.map].players.delete(currentUser.username);
    }
    // Persisti le morti
    const saved = loadUserData(currentUser.username) || {};
    saved.deaths = (saved.deaths || 0) + 1;
    currentUser.deaths = saved.deaths;
    saveUserData(currentUser.username, saved);
    // Notifica il client
    if (currentUser.ws && currentUser.ws.readyState === WebSocket.OPEN) {
        currentUser.ws.send(JSON.stringify({ type: 'youDied' }));
    }
    broadcastLeaderboard();
}

// ── handleRespawn ─────────────────────────────────────────────
function handleRespawn(currentUser) {
    if (!currentUser) return;
    currentUser.isDead = false;
    
    // Il respawn deve SEMPRE avvenire alla base corretta
    const base = bases[currentUser.faction];
    if (base) {
        currentUser.x = base.x;
        currentUser.y = base.y;
    } else {
        // Fallback di sicurezza in caso la fazione non sia riconosciuta
        currentUser.x = 0;
        currentUser.y = 0;
    }
    
    const fullHp = currentUser.maxHp || 4000;
    currentUser.hp    = fullHp;
    currentUser.maxHp = fullHp;
    // Ripristina scudo pieno al respawn (ricalcolo server-side)
    if (currentUser.configs) {
        const shieldData = calcShieldStats(currentUser.configs, currentUser.activeConfig || 1);
        currentUser.shield    = shieldData.maxShield;
        currentUser.maxShield = shieldData.maxShield;
        currentUser.shieldRings     = shieldData.shieldRings;
        currentUser.fillRatio       = shieldData.fillRatio;
        currentUser.shieldSlots     = shieldData.shieldSlots;
        currentUser.usedShieldSlots = shieldData.usedShieldSlots;
    }
    // Reinserisce nella mappa → torna visibile
    if (maps[currentUser.map]) {
        maps[currentUser.map].players.set(currentUser.username, currentUser);
    }
    // Persisti posizione di respawn
    const saved = loadUserData(currentUser.username) || {};
    saved.x  = currentUser.x;
    saved.y  = currentUser.y;
    saved.hp = currentUser.hp;
    saveUserData(currentUser.username, saved);
    // Notifica il client
    sendPlayerStats(currentUser);
    if (currentUser.ws && currentUser.ws.readyState === WebSocket.OPEN) {
        currentUser.ws.send(JSON.stringify({
            type: 'respawnOk',
            x: currentUser.x,
            y: currentUser.y,
            hp: currentUser.hp,
            maxHp: currentUser.maxHp
        }));
    }
}

// ── handleDisconnect ─────────────────────────────────────────
function handleDisconnect(currentUser) {
    if (!currentUser) return;
    // ── Board Log: player disconnesso ────────────────────────
    if (!currentUser.isBot) broadcastBoardLog(`${currentUser.username} disconnected`, '#475569', { eventType: 'disconnect', faction: currentUser.faction });
    if (maps[currentUser.map]) maps[currentUser.map].players.delete(currentUser.username);
    clients.delete(currentUser.ws);
    const saved = loadUserData(currentUser.username) || {};
    // Salva TUTTI i campi di gioco — inclusi inventory, configs, lootCargo
    Object.assign(saved, {
        x:            currentUser.x            ?? saved.x            ?? 0,
        y:            currentUser.y            ?? saved.y            ?? 0,
        map:          currentUser.map          || 'Arena',
        hp:           currentUser.hp           ?? saved.hp           ?? 4000,
        isDead:       currentUser.isDead       || false,
        shipType:     currentUser.shipType     || saved.shipType     || 'phoenix',
        credits:      currentUser.credits      ?? saved.credits      ?? 0,
        uridium:      currentUser.uridium      ?? saved.uridium      ?? 0,
        score:        currentUser.score        ?? saved.score        ?? 0,
        kills:        currentUser.kills        ?? saved.kills        ?? 0,
        deaths:       currentUser.deaths       ?? saved.deaths       ?? 0,
        cargo:        currentUser.cargo        ?? saved.cargo        ?? 0,
        maxCargo:     getMaxCargoForShip(currentUser.shipType || 'phoenix'),
        faction:      currentUser.faction      || saved.faction      || 'MMO',
        activeConfig: currentUser.activeConfig ?? saved.activeConfig ?? 1,
    });
    if (currentUser.materials)              saved.materials    = currentUser.materials;
    if (currentUser.inventory)              saved.inventory    = currentUser.inventory;
    if (currentUser.configs)                saved.configs      = currentUser.configs;
    if (currentUser.lootCargo)              saved.lootCargo    = currentUser.lootCargo;
    if (currentUser.ammo)                   saved.ammo        = currentUser.ammo;
    if (currentUser.missileAmmo)            saved.missileAmmo = currentUser.missileAmmo;
    if (currentUser.mineAmmo)               saved.mineAmmo    = currentUser.mineAmmo;
    if (currentUser.empAmmo)                saved.empAmmo     = currentUser.empAmmo;
    // Pilot skills
    if (currentUser.pilotLevel  !== undefined) saved.pilotLevel  = currentUser.pilotLevel;
    if (currentUser.pilotExp    !== undefined) saved.pilotExp    = currentUser.pilotExp;
    if (currentUser.skillPoints !== undefined) saved.skillPoints = currentUser.skillPoints;
    if (currentUser.pilotSkills)               saved.pilotSkills = currentUser.pilotSkills;
    saveUserData(currentUser.username, saved);
    broadcastLeaderboard();
}

// ── handleUpdatePilotSkills ───────────────────────────────────
// Il client invia le nuove allocazioni skill dopo che il player le ha cambiate.
function handleUpdatePilotSkills(player, data) {
    if (!player || !data) return;
    const skills = data.pilotSkills || {};
    // Valida: ogni skill 0..25, somma totale ≤ 100
    const SKILL_KEYS = ['hp','speed','sprint','shield','damage','laser','missile','coins','loot','exp'];
    let total = 0;
    const validated = {};
    SKILL_KEYS.forEach(k => {
        const v = Math.min(25, Math.max(0, Math.floor(Number(skills[k]) || 0)));
        validated[k] = v;
        total += v;
    });
    if (total > 100) {
        if (player.ws && player.ws.readyState === WebSocket.OPEN)
            player.ws.send(JSON.stringify({ type: 'pilotSkillsError', error: 'Total points exceed 100' }));
        return;
    }
    // Verifica che il player abbia abbastanza skillPoints liberi
    // (skillPoints = punti disponibili non ancora spesi)
    const currentTotal = Object.values(player.pilotSkills || {}).reduce((a, b) => a + b, 0);
    const newTotal = total;
    const maxSpendable = Math.min(100, player.pilotLevel - 1 + (player.skillPoints || 0) + currentTotal);
    // La somma delle nuove skill non può superare i punti guadagnati (livello - 1)
    const pointsEarned = Math.max(0, (player.pilotLevel || 1) - 1);
    if (newTotal > pointsEarned) {
        if (player.ws && player.ws.readyState === WebSocket.OPEN)
            player.ws.send(JSON.stringify({ type: 'pilotSkillsError', error: 'Insufficient skill points' }));
        return;
    }
    player.pilotSkills   = validated;
    player.skillPoints   = pointsEarned - newTotal;
    // Persisti
    const saved = loadUserData(player.username) || {};
    saved.pilotSkills = validated;
    saved.skillPoints = player.skillPoints;
    saveUserData(player.username, saved);
    // Conferma al client
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({
            type: 'pilotSkillsUpdated',
            pilotSkills: validated,
            skillPoints: player.skillPoints
        }));
    }
}

// ── Log di Bordo: broadcast a tutti i player connessi (non-bot) ──
function broadcastBoardLog(message, color, extra) {
    const msg = JSON.stringify({ type: 'boardLog', message, color: color || '#a0aec0', ...(extra || {}) });
    for (const mapName in maps) {
        maps[mapName].players.forEach(p => {
            if (p.isBot) return;
            if (p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
        });
    }
}

module.exports = {
    clients,
    sendPlayerStats, persistPlayerMeta, addCredits,
    broadcastLeaderboard, sendLeaderboard,
    handleLogin, handleSyncFullState,
    handlePlayerDeath, handleRespawn, handleDisconnect,
    calcShieldStats,
    addPilotExp, handleUpdatePilotSkills, expForLevel, DEFAULT_PILOT_SKILLS,
    broadcastBoardLog
};
