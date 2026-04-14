'use strict';
// ============================================================
//  db.js — Database layer SQLite per DarkOrbit MMO
//  Sostituisce database.json con better-sqlite3 (WAL, sincrono)
//  Installazione: npm install better-sqlite3
// ============================================================
const Database = require('better-sqlite3');
const path     = require('path');
const crypto   = require('crypto');

// ─── Connessione & Pragma ────────────────────────────────────
const db = new Database(path.join(__dirname, 'gamedata.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous  = NORMAL');
db.pragma('cache_size   = -64000');   // 64 MB cache RAM
db.pragma('temp_store   = MEMORY');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    username        TEXT    PRIMARY KEY,
    password_hash   TEXT    NOT NULL,
    is_bot          INTEGER DEFAULT 0,
    bot_profile     TEXT    DEFAULT NULL,
    faction         TEXT    DEFAULT 'MMO',
    credits         INTEGER DEFAULT 100000,
    score           INTEGER DEFAULT 0,
    kills           INTEGER DEFAULT 0,
    player_kills    INTEGER DEFAULT 0,
    alien_kills     INTEGER DEFAULT 0,
    deaths          INTEGER DEFAULT 0,
    map             TEXT    DEFAULT 'Arena',
    x               REAL    DEFAULT 0,
    y               REAL    DEFAULT 0,
    ship_type       TEXT    DEFAULT 'phoenix',
    hp              INTEGER DEFAULT 4000,
    max_hp          INTEGER DEFAULT 4000,
    cargo           INTEGER DEFAULT 0,
    max_cargo       INTEGER DEFAULT 200,
    pilot_level     INTEGER DEFAULT 1,
    pilot_exp       INTEGER DEFAULT 0,
    skill_points    INTEGER DEFAULT 0,
    active_config   INTEGER DEFAULT 1,
    configs         TEXT    DEFAULT '{}',
    inventory       TEXT    DEFAULT '{}',
    ammo            TEXT    DEFAULT '{}',
    missile_ammo    TEXT    DEFAULT '{}',
    mine_ammo       TEXT    DEFAULT '{}',
    emp_ammo        TEXT    DEFAULT '{}',
    materials       TEXT    DEFAULT '{}',
    loot_cargo      TEXT    DEFAULT '{}',
    pilot_skills    TEXT    DEFAULT '{}',
    registered_at   INTEGER DEFAULT (unixepoch()),
    updated_at      INTEGER DEFAULT (unixepoch())
  );
`);

// ─── Prepared Statements ─────────────────────────────────────
const stmts = {
  getPlayer: db.prepare('SELECT * FROM players WHERE username = ?'),
  getPlayerNoCase: db.prepare('SELECT * FROM players WHERE lower(username) = lower(?)'),
  insertPlayer: db.prepare(`
    INSERT INTO players
      (username, password_hash, is_bot, bot_profile, faction, credits,
       map, x, y, ship_type, hp, max_hp, cargo, max_cargo,
       configs, inventory, ammo, missile_ammo, mine_ammo, emp_ammo,
       materials, loot_cargo, pilot_skills, pilot_level, pilot_exp, skill_points, active_config)
    VALUES
      (@username, @password_hash, @is_bot, @bot_profile, @faction, @credits,
       @map, @x, @y, @ship_type, @hp, @max_hp, @cargo, @max_cargo,
       @configs, @inventory, @ammo, @missile_ammo, @mine_ammo, @emp_ammo,
       @materials, @loot_cargo, @pilot_skills, @pilot_level, @pilot_exp, @skill_points, @active_config)
  `),
  savePlayer: db.prepare(`
    UPDATE players SET
      credits       = @credits,
      score         = @score,
      kills         = @kills,
      player_kills  = @player_kills,
      alien_kills   = @alien_kills,
      deaths        = @deaths,
      map           = @map,
      x             = @x,
      y             = @y,
      ship_type     = @ship_type,
      hp            = @hp,
      max_hp        = @max_hp,
      cargo         = @cargo,
      max_cargo     = @max_cargo,
      pilot_level   = @pilot_level,
      pilot_exp     = @pilot_exp,
      skill_points  = @skill_points,
      active_config = @active_config,
      configs       = @configs,
      inventory     = @inventory,
      ammo          = @ammo,
      missile_ammo  = @missile_ammo,
      mine_ammo     = @mine_ammo,
      emp_ammo      = @emp_ammo,
      materials     = @materials,
      loot_cargo    = @loot_cargo,
      pilot_skills  = @pilot_skills,
      updated_at    = unixepoch()
    WHERE username = @username
  `),
  saveBotProfile: db.prepare(`
    UPDATE players SET
      bot_profile   = @bot_profile,
      ship_type     = @ship_type,
      credits       = @credits,
      score         = @score,
      kills         = @kills,
      deaths        = @deaths,
      pilot_level   = @pilot_level,
      pilot_exp     = @pilot_exp,
      skill_points  = @skill_points,
      pilot_skills  = @pilot_skills,
      configs       = @configs,
      inventory     = @inventory,
      ammo          = @ammo,
      missile_ammo  = @missile_ammo,
      emp_ammo      = @emp_ammo,
      updated_at    = unixepoch()
    WHERE username = @username
  `),
  getLeaderboard: db.prepare(`
    SELECT username, faction, score, player_kills, alien_kills, kills, deaths, pilot_level
    FROM players
    WHERE is_bot = 0
    ORDER BY score DESC
    LIMIT 100
  `),
  getLeaderboardWithBots: db.prepare(`
    SELECT username, faction, score, player_kills, alien_kills, kills, deaths, pilot_level, is_bot
    FROM players ORDER BY score DESC LIMIT 100
  `),
  getAllPlayers: db.prepare('SELECT * FROM players WHERE is_bot = 0'),
  getAllBots: db.prepare('SELECT * FROM players WHERE is_bot = 1'),
  getAllUsers: db.prepare('SELECT * FROM players'),
  countPlayers: db.prepare('SELECT COUNT(*) as c FROM players WHERE is_bot = 0'),
};

// ─── Helpers serializzazione JSON ────────────────────────────
const JSON_FIELDS = ['configs','inventory','ammo','missile_ammo','mine_ammo','emp_ammo','materials','loot_cargo','pilot_skills'];

function deserialize(row) {
    if (!row) return null;
    for (const f of JSON_FIELDS) {
        try { row[f] = JSON.parse(row[f] || '{}'); } catch { row[f] = {}; }
    }
    return row;
}

// Converte riga DB (snake_case) → userData (camelCase) usato nel resto del server
function rowToUserData(row) {
    if (!row) return null;
    deserialize(row);
    return {
        username:       row.username,
        passwordHash:   row.password_hash,
        isBot:          !!row.is_bot,
        botProfile:     row.bot_profile || null,
        faction:        row.faction,
        credits:        row.credits,
        score:          row.score,
        kills:          row.kills,
        playerKills:    row.player_kills,
        alienKills:     row.alien_kills,
        deaths:         row.deaths,
        map:            row.map,
        x:              row.x,
        y:              row.y,
        shipType:       row.ship_type,
        hp:             row.hp,
        maxHp:          row.max_hp,
        cargo:          row.cargo,
        maxCargo:       row.max_cargo,
        pilotLevel:     row.pilot_level,
        pilotExp:       row.pilot_exp,
        skillPoints:    row.skill_points,
        activeConfig:   row.active_config,
        configs:        row.configs,
        inventory:      row.inventory,
        ammo:           row.ammo,
        missileAmmo:    row.missile_ammo,
        mineAmmo:       row.mine_ammo,
        empAmmo:        row.emp_ammo,
        materials:      row.materials,
        lootCargo:      row.loot_cargo,
        pilotSkills:    row.pilot_skills,
        registeredAt:   row.registered_at * 1000,
    };
}

// Converte userData (camelCase) → parametri per prepared statements
function userDataToParams(u) {
    return {
        username:       u.username,
        credits:        u.credits        ?? 0,
        score:          u.score          ?? 0,
        kills:          u.kills          ?? 0,
        player_kills:   u.playerKills    ?? 0,
        alien_kills:    u.alienKills     ?? 0,
        deaths:         u.deaths         ?? 0,
        map:            u.map            || 'Arena',
        x:              u.x              ?? 0,
        y:              u.y              ?? 0,
        ship_type:      u.shipType       || 'phoenix',
        hp:             u.hp             ?? 4000,
        max_hp:         u.maxHp          ?? 4000,
        cargo:          u.cargo          ?? 0,
        max_cargo:      u.maxCargo       ?? 200,
        pilot_level:    u.pilotLevel     ?? 1,
        pilot_exp:      u.pilotExp       ?? 0,
        skill_points:   u.skillPoints    ?? 0,
        active_config:  u.activeConfig   ?? 1,
        configs:        JSON.stringify(u.configs       || {}),
        inventory:      JSON.stringify(u.inventory     || {}),
        ammo:           JSON.stringify(u.ammo          || {}),
        missile_ammo:   JSON.stringify(u.missileAmmo   || {}),
        mine_ammo:      JSON.stringify(u.mineAmmo      || {}),
        emp_ammo:       JSON.stringify(u.empAmmo       || {}),
        materials:      JSON.stringify(u.materials     || {}),
        loot_cargo:     JSON.stringify(u.lootCargo     || {}),
        pilot_skills:   JSON.stringify(u.pilotSkills   || {}),
    };
}

// ─── Password ─────────────────────────────────────────────────
const SALT = 'voxelorbit_salt'; // invariato per retrocompatibilità
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// ─── API Pubblica ─────────────────────────────────────────────

function initDB() {
    // Schema già creato all'avvio — questa funzione esiste per compatibilità con server.js
}

/** Carica userData per username (case-insensitive). Ritorna null se non trovato. */
function loadUserData(username) {
    let row = stmts.getPlayer.get(username);
    if (!row) row = stmts.getPlayerNoCase.get(username);
    return rowToUserData(row);
}

/** Salva userData (aggiornamento). Usa saveUserData per compatibilità con playerHandler.js */
function saveUserData(username, userData) {
    const params = userDataToParams({ ...userData, username });
    stmts.savePlayer.run(params);
}

/** Registrazione nuovo utente (umano). Ritorna { ok, error? } */
function registerUser(username, password, faction) {
    if (!username || username.length < 3)
        return { ok: false, error: 'Il nome deve avere almeno 3 caratteri.' };
    if (!password || password.length < 4)
        return { ok: false, error: 'La password deve avere almeno 4 caratteri.' };
    if (!/^[a-zA-Z0-9_\-]+$/.test(username))
        return { ok: false, error: 'Nome utente: solo lettere, numeri, _ e -' };
    if (loadUserData(username))
        return { ok: false, error: 'Nome utente già in uso.' };

    const { bases } = require('./modules/config');
    const factionChosen = faction || 'MMO';
    const spawnPos = bases[factionChosen] || { x: 0, y: 0 };

    const defaultAmmo = {
        laserAmmo: 'x1',
        counts: { x1: 999999, x2: 500, x3: 200, x4: 100, sab: 100 }
    };
    const defaultMissile = { selected: 'plt-2026', counts: { 'r-310': 50, 'plt-2026': 30, 'plt-3030': 10, 'pld-8': 20, 'agt-500': 5 } };
    const defaultMine    = { selected: 'mine-normal', counts: { 'mine-normal': 10, 'mine-slow': 10, 'smart-bomb': 3 } };
    const defaultEmp     = { counts: { 'emp-01': 5 } };
    const defaultInv     = { lasers:['lf2'], shields:['sg3n-b01'], generators:['g3n-7900'], missiles:['plt-2026'], drones:['flax'], cpus:['auto-rocket'], pets:[], ships:['phoenix'] };
    const defaultConfigs = {
        1: { lasers:['lf2'], shields:[], generators:['g3n-7900'], cpus:['auto-rocket'], missiles:['plt-2026'], drones:['flax'], droneItems:[[]], pets:[] },
        2: { lasers:[], shields:['sg3n-b01'], generators:[], cpus:[], missiles:['plt-2026'], drones:['flax'], droneItems:[[]], pets:[] }
    };

    try {
        stmts.insertPlayer.run({
            username, password_hash: hashPassword(password),
            is_bot: 0, bot_profile: null,
            faction: factionChosen, credits: 25000,
            map: 'Arena', x: spawnPos.x, y: spawnPos.y,
            ship_type: 'phoenix', hp: 4000, max_hp: 4000,
            cargo: 0, max_cargo: 200,
            configs:      JSON.stringify(defaultConfigs),
            inventory:    JSON.stringify(defaultInv),
            ammo:         JSON.stringify(defaultAmmo),
            missile_ammo: JSON.stringify(defaultMissile),
            mine_ammo:    JSON.stringify(defaultMine),
            emp_ammo:     JSON.stringify(defaultEmp),
            materials:    JSON.stringify({ prometium:0, endurium:0, terbium:0, prometid:0, duranium:0, promerium:0, seprom:0 }),
            loot_cargo:   JSON.stringify({}),
            pilot_skills: JSON.stringify({ hp:0, speed:0, sprint:0, shield:0, damage:0, laser:0, missile:0, coins:0, loot:0, exp:0 }),
            pilot_level: 1, pilot_exp: 0, skill_points: 0, active_config: 1,
        });
        console.log(`[DB] Nuovo utente registrato: ${username} (${factionChosen})`);
        return { ok: true };
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return { ok: false, error: 'Nome utente già in uso.' };
        throw e;
    }
}

/** Login utente. Ritorna { ok, userData? } o { ok: false, error } */
function loginUser(username, password) {
    const userData = loadUserData(username);
    if (!userData) return { ok: false, error: 'Utente non trovato.' };
    if (userData.passwordHash !== hashPassword(password))
        return { ok: false, error: 'Password errata.' };
    return { ok: true, userData };
}

/**
 * Crea account bot nel DB (se non esiste già).
 * Usato da botAi.js — analogo a registerUser ma senza validazione stricta.
 * Ritorna { ok, created } dove created=true se è stato inserito ora.
 */
function registerBot(username, faction, botProfile, shipType, credits, configs, inventory) {
    const existing = loadUserData(username);
    if (existing) return { ok: true, created: false };

    const { bases } = require('./modules/config');
    const spawnPos = bases[faction] || { x: 0, y: 0 };
    
    // I bot iniziano esattamente come i player umani: niente munizioni/missili esagerati
    const botAmmo = { laserAmmo: 'x1', counts: { x1: 999999, x2: 500, x3: 200, x4: 100, sab: 100 } };
    const botMissile = { selected: 'plt-2026', counts: { 'r-310': 50, 'plt-2026': 30, 'plt-3030': 10, 'pld-8': 20, 'agt-500': 5 } };
    const botMine    = { selected: 'mine-normal', counts: { 'mine-normal': 10, 'mine-slow': 10, 'smart-bomb': 3 } };
    const botEmp     = { counts: { 'emp-01': 5 } };

    // Set equipaggiamento di default identico ai giocatori umani
    const defaultInv = { lasers:['lf2'], shields:['sg3n-b01'], generators:['g3n-7900'], missiles:['plt-2026'], drones:['flax'], cpus:['auto-rocket'], pets:[], ships:['phoenix'] };
    const defaultConfigs = {
        1: { shipType: 'phoenix', lasers:['lf2'], shields:[], generators:['g3n-7900'], cpus:['auto-rocket'], missiles:['plt-2026'], drones:['flax'], droneItems:[[]], pets:[] },
        2: { shipType: 'phoenix', lasers:[], shields:['sg3n-b01'], generators:[], cpus:[], missiles:['plt-2026'], drones:['flax'], droneItems:[[]], pets:[] }
    };

    try {
        stmts.insertPlayer.run({
            username,
            password_hash: hashPassword('botpassword123'),
            is_bot: 1,
            bot_profile: botProfile || 'NORMALE',
            faction: faction || 'MMO',
            credits: 25000,
            map: 'Arena',
            x: spawnPos.x + (Math.random()-0.5)*400,
            y: spawnPos.y + (Math.random()-0.5)*400,
            ship_type: 'phoenix',
            hp: 4000, max_hp: 4000,
            cargo: 0, max_cargo: 200,
            configs:      JSON.stringify(defaultConfigs),
            inventory:    JSON.stringify(defaultInv),
            ammo:         JSON.stringify(botAmmo),
            missile_ammo: JSON.stringify(botMissile),
            mine_ammo:    JSON.stringify(botMine),
            emp_ammo:     JSON.stringify(botEmp),
            materials:    JSON.stringify({}),
            loot_cargo:   JSON.stringify({}),
            pilot_skills: JSON.stringify({ hp:0, speed:0, sprint:0, shield:0, damage:0, laser:0, missile:0, coins:0, loot:0, exp:0 }),
            pilot_level: 1, pilot_exp: 0, skill_points: 0, active_config: 1,
        });
        return { ok: true, created: true };
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return { ok: true, created: false };
        throw e;
    }
}

/** Aggiorna solo i campi bot-specifici (shop upgrades, skill points, etc.) */
function saveBotData(username, botData) {
    stmts.saveBotProfile.run({
        username,
        bot_profile:  botData.botProfile  || 'NORMALE',
        ship_type:    botData.shipType     || 'phoenix',
        credits:      botData.credits      ?? 0,
        score:        botData.score        ?? 0,
        kills:        botData.kills        ?? 0,
        deaths:       botData.deaths       ?? 0,
        pilot_level:  botData.pilotLevel   ?? 1,
        pilot_exp:    botData.pilotExp     ?? 0,
        skill_points: botData.skillPoints  ?? 0,
        pilot_skills: JSON.stringify(botData.pilotSkills || {}),
        configs:      JSON.stringify(botData.configs     || {}),
        inventory:    JSON.stringify(botData.inventory   || {}),
        ammo:         JSON.stringify(botData.ammo        || {}),
        missile_ammo: JSON.stringify(botData.missileAmmo || {}),
        emp_ammo:     JSON.stringify(botData.empAmmo     || {}),
    });
}

/** Salvataggio batch: tutti i player connessi in una transazione atomica */
const saveBatch = db.transaction((players) => {
    for (const p of players) saveUserData(p.username, p);
});

/** Leaderboard top-100 (solo umani, senza bot) */
function getLeaderboard() {
    return stmts.getLeaderboard.all();
}

/** Tutti i player (per broadcastLeaderboard in playerHandler) */
function getAllUsersData() {
    return stmts.getAllUsers.all().map(rowToUserData);
}

module.exports = {
    initDB,
    loadUserData,
    saveUserData,
    registerUser,
    loginUser,
    registerBot,
    saveBotData,
    saveBatch,
    getLeaderboard,
    getAllUsersData,
};
