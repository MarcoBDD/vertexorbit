// ============================================================
//  config.js — Costanti globali del gioco
// ============================================================

const TICK_RATE  = 20;
const DELTA_TIME = 1 / TICK_RATE;

const ENEMY_TYPES = {
    'lordakia':      { hp: 2200,   speed: 170, radius: 14, damage: 60,   reward: 110,   exp: 80,    rarity: 16, color: '#8b0000', attackType: 'melee',   aggroRange: 900,  optimalDist: 40 },
    'saimon':        { hp: 5000,   speed: 190, radius: 18, damage: 120,  reward: 260,   exp: 200,   rarity: 12, color: '#f97316', attackType: 'laser',   aggroRange: 1000, optimalDist: 280, fireRate: 1.1, projectileSpeed: 900,  projectileColor: '#fb923c', projectileThickness: 2 },
    'mordon':        { hp: 14000,  speed: 120, radius: 26, damage: 240,  reward: 560,   exp: 450,   rarity: 10, color: '#92400e', attackType: 'melee',   aggroRange: 850,  optimalDist: 55 },
    'sibelon':       { hp: 52000,  speed: 90,  radius: 115, damage: 600,  reward: 2200,  exp: 1800,  rarity: 8,  color: '#4c1d95', attackType: 'missile', aggroRange: 1300, optimalDist: 420, fireRate: 1.7, projectileSpeed: 650,  projectileColor: '#a78bfa', projectileThickness: 4 },
    'kristallin':    { hp: 18000,  speed: 230, radius: 25, damage: 320,  reward: 1200,  exp: 950,   rarity: 9,  color: '#06b6d4', attackType: 'laser',   aggroRange: 1400, optimalDist: 320, orbit: true, fireRate: 0.9, projectileSpeed: 1000, projectileColor: '#22d3ee', projectileThickness: 2 },
    'kristallon':    { hp: 120000, speed: 130, radius: 90, damage: 1200, reward: 5600,  exp: 4500,  rarity: 6,  color: '#1d4ed8', attackType: 'laser',   aggroRange: 1300, optimalDist: 500, fireRate: 1.4, projectileSpeed: 850,  projectileColor: '#60a5fa', projectileThickness: 5, specialAttack: { chance: 0.20, slowPct: 0.30, duration: 7 }, isBoss: true },
    'cubikon':       { hp: 480000, speed: 20,  radius: 255, damage: 2500, reward: 35000, exp: 28000, rarity: 1,  color: '#d4d4d8', attackType: 'laser',   aggroRange: 1600, optimalDist: 650, fireRate: 1.3, projectileSpeed: 700,  projectileColor: '#e5e7eb', projectileThickness: 12,
                       specialAttack: { chance: 0.35, slowPct: 0.35, duration: 8 },
                       spawnSkill: { cooldown: 45, minCount: 5, maxCount: 10 }, isBoss: true },
    'cubicle':       { hp: 800,    speed: 480, radius: 8,  damage: 200,  reward: 120,   exp: 90,    rarity: 0,  color: '#a5f3fc', attackType: 'melee',   aggroRange: 1800, optimalDist: 20,
                       isCubicle: true },
    'uber_lordakia': { hp: 10000,  speed: 240, radius: 18, damage: 260,  reward: 700,   exp: 560,   rarity: 8,  color: '#7f1d1d', attackType: 'melee',   aggroRange: 1100, optimalDist: 45,  specialAttack: { chance: 0.08, slowPct: 0.15, duration: 3 } },
    'interceptor':   { hp: 7000,   speed: 310, radius: 12, damage: 170,  reward: 450,   exp: 360,   rarity: 11, color: '#22c55e', attackType: 'laser',   aggroRange: 1500, optimalDist: 260, fireRate: 0.6, projectileSpeed: 1200, projectileColor: '#4ade80', projectileThickness: 2, specialAttack: { chance: 0.10, slowPct: 0.20, duration: 4 } },
    'barracuda':     { hp: 26000,  speed: 160, radius: 30, damage: 420,  reward: 1700,  exp: 1350,  rarity: 8,  color: '#f59e0b', attackType: 'missile', aggroRange: 1200, optimalDist: 380, fireRate: 1.6, projectileSpeed: 700,  projectileColor: '#f97316', projectileThickness: 4, specialAttack: { chance: 0.15, slowPct: 0.25, duration: 5 } },
    'annihilator':   { hp: 180000, speed: 85,  radius: 155, damage: 1900, reward: 22000, exp: 17500, rarity: 5,  color: '#991b1b', attackType: 'missile', aggroRange: 1500, optimalDist: 560, fireRate: 2.2, projectileSpeed: 580,  projectileColor: '#ef4444', projectileThickness: 6, specialAttack: { chance: 0.25, slowPct: 0.35, duration: 8 }, isBoss: true },
    'phantom':       { hp: 16000,  speed: 280, radius: 16, damage: 280,  reward: 1400,  exp: 1100,  rarity: 6,  color: '#6366f1', attackType: 'laser',   aggroRange: 1400, optimalDist: 300, fireRate: 0.7, projectileSpeed: 1100, projectileColor: '#818cf8', projectileThickness: 3, specialAttack: { chance: 0.18, slowPct: 0.22, duration: 5 } },
    'drone':         { hp: 350000, speed: 450, radius: 25, damage: 0,    reward: 50000, exp: 40000, rarity: 1.5, color: '#facc15', attackType: 'flee',    aggroRange: 600, optimalDist: 0, isBoss: true }
};

const MINE_TYPES = {
    'mine-normal': { damage: 2000, triggerRadius: 60, color: '#dc2626', slowPct: 0,    slowDuration: 0 },
    'mine-slow':   { damage:  500, triggerRadius: 70, color: '#a855f7', slowPct: 0.50, slowDuration: 4 },
    'smart-bomb':  { damage: 3500, aoeRadius: 350,    color: '#f59e0b', instant: true }
};

const bases = {
    'MMO': { x: 0,                                    y: -8000 },
    'EIC': { x:  Math.cos(Math.PI / 6) * 8000,        y: Math.sin(Math.PI / 6) * 8000 },
    'VRU': { x: -Math.cos(Math.PI / 6) * 8000,        y: Math.sin(Math.PI / 6) * 8000 }
};

// ============================================================
//  LOOT TABLE — definisce i drop per ogni tipo di nemico
//  Ogni voce: { id, name, rarity:'common'|'uncommon'|'rare'|'epic'|'legendary', value, color }
//  isRare = true → particelle pixel animate attorno al loot
// ============================================================
const LOOT_ITEMS = {
    // Materiali comuni
    'scrap_metal':    { name:'Rottame Metallico',  rarity:'common',    value:6,    color:'#94a3b8' },
    'alien_chip':     { name:'Chip Alieno',        rarity:'common',    value:15,   color:'#64748b' },
    'energy_cell':    { name:'Cella Energetica',   rarity:'uncommon',  value:45,   color:'#f59e0b' },
    'plasma_shard':   { name:'Frammento Plasma',   rarity:'uncommon',  value:60,   color:'#fb923c' },
    'dark_crystal':   { name:'Cristallo Oscuro',   rarity:'rare',      value:180,  color:'#7c3aed', isRare:true },
    'neutrino_core':  { name:'Nucleo Neutrinico',  rarity:'rare',      value:240,  color:'#0891b2', isRare:true },
    'quantum_matrix': { name:'Matrice Quantistica',rarity:'epic',      value:600,  color:'#d946ef', isRare:true },
    'void_essence':   { name:'Essenza del Vuoto',  rarity:'epic',      value:750,  color:'#6366f1', isRare:true },
    'stellar_heart':  { name:'Cuore Stellare',     rarity:'legendary', value:2400, color:'#facc15', isRare:true },
    'annihilium':     { name:'Annichilium',        rarity:'legendary', value:3600, color:'#f87171', isRare:true },
    'drone_relic':    { name:'Reliquia dei Droni', rarity:'legendary', value:50000, color:'#facc15', isRare:true },
    // Materiali base legacy (compatibilità raccolta resources)
    'prometium':      { name:'Prometio',           rarity:'common',    value:9,    color:'#4ade80' },
    'endurium':       { name:'Endurio',            rarity:'common',    value:12,   color:'#60a5fa' },
    'terbium':        { name:'Terbio',             rarity:'common',    value:18,   color:'#f97316' },
    'prometid':       { name:'Prometid',           rarity:'common',    value:25,   color:'#fb7185' },
    'duranium':       { name:'Duranio',            rarity:'common',    value:35,   color:'#c084fc' },
    'promerium':      { name:'Promerio',           rarity:'uncommon',  value:50,   color:'#f472b6' },
    'seprom':         { name:'Seprom',             rarity:'rare',      value:90,   color:'#818cf8', isRare:true },
};

// Loot table per nemico: array di { itemId, chance(0-1), minQty, maxQty }
const ENEMY_LOOT = {
    lordakia:      [ { itemId:'scrap_metal',    chance:0.80, minQty:10,  maxQty:40  },
                     { itemId:'alien_chip',     chance:0.40, minQty:2,   maxQty:10  },
                     { itemId:'prometium',      chance:0.60, minQty:20,  maxQty:80  } ],
    saimon:        [ { itemId:'scrap_metal',    chance:0.70, minQty:16,  maxQty:50  },
                     { itemId:'energy_cell',    chance:0.45, minQty:2,   maxQty:8   },
                     { itemId:'prometium',      chance:0.50, minQty:30,  maxQty:100 } ],
    mordon:        [ { itemId:'alien_chip',     chance:0.65, minQty:6,   maxQty:20  },
                     { itemId:'energy_cell',    chance:0.50, minQty:4,   maxQty:16  },
                     { itemId:'plasma_shard',   chance:0.30, minQty:2,   maxQty:6   },
                     { itemId:'endurium',       chance:0.55, minQty:20,  maxQty:80  } ],
    sibelon:       [ { itemId:'plasma_shard',   chance:0.70, minQty:10,  maxQty:40  },
                     { itemId:'energy_cell',    chance:0.55, minQty:6,   maxQty:24  },
                     { itemId:'dark_crystal',   chance:0.20, minQty:2,   maxQty:4   },
                     { itemId:'endurium',       chance:0.60, minQty:40,  maxQty:120 } ],
    kristallin:    [ { itemId:'plasma_shard',   chance:0.65, minQty:8,   maxQty:30  },
                     { itemId:'neutrino_core',  chance:0.25, minQty:2,   maxQty:6   },
                     { itemId:'dark_crystal',   chance:0.15, minQty:2,   maxQty:4   },
                     { itemId:'terbium',        chance:0.60, minQty:30,  maxQty:100 } ],
    kristallon:    [ { itemId:'plasma_shard',   chance:0.90, minQty:16,  maxQty:60  },
                     { itemId:'dark_crystal',   chance:0.70, minQty:4,   maxQty:12  },
                     { itemId:'neutrino_core',  chance:0.55, minQty:2,   maxQty:8   },
                     { itemId:'quantum_matrix', chance:0.25, minQty:1,   maxQty:3   },
                     { itemId:'void_essence',   chance:0.10, minQty:1,   maxQty:2   },
                     { itemId:'terbium',        chance:1.00, minQty:100, maxQty:300 } ],
    cubikon:       [ { itemId:'dark_crystal',   chance:1.00, minQty:30,  maxQty:100 },
                     { itemId:'quantum_matrix', chance:0.80, minQty:6,   maxQty:20  },
                     { itemId:'void_essence',   chance:0.60, minQty:3,   maxQty:8   },
                     { itemId:'stellar_heart',  chance:0.30, minQty:1,   maxQty:3   },
                     { itemId:'annihilium',     chance:0.10, minQty:1,   maxQty:1   },
                     { itemId:'terbium',        chance:1.00, minQty:200, maxQty:600 } ],
    uber_lordakia: [ { itemId:'alien_chip',     chance:0.70, minQty:10,  maxQty:40  },
                     { itemId:'plasma_shard',   chance:0.45, minQty:4,   maxQty:16  },
                     { itemId:'dark_crystal',   chance:0.15, minQty:2,   maxQty:4   },
                     { itemId:'prometium',      chance:0.65, minQty:40,  maxQty:120 } ],
    interceptor:   [ { itemId:'energy_cell',    chance:0.60, minQty:6,   maxQty:20  },
                     { itemId:'plasma_shard',   chance:0.35, minQty:2,   maxQty:10  },
                     { itemId:'neutrino_core',  chance:0.20, minQty:2,   maxQty:4   },
                     { itemId:'endurium',       chance:0.55, minQty:20,  maxQty:70  } ],
    barracuda:     [ { itemId:'plasma_shard',   chance:0.75, minQty:10,  maxQty:36  },
                     { itemId:'energy_cell',    chance:0.55, minQty:6,   maxQty:20  },
                     { itemId:'dark_crystal',   chance:0.25, minQty:2,   maxQty:6   },
                     { itemId:'terbium',        chance:0.65, minQty:40,  maxQty:140 } ],
    annihilator:   [ { itemId:'dark_crystal',   chance:0.95, minQty:14,  maxQty:50  },
                     { itemId:'quantum_matrix', chance:0.65, minQty:3,   maxQty:12  },
                     { itemId:'void_essence',   chance:0.45, minQty:2,   maxQty:6   },
                     { itemId:'annihilium',     chance:0.20, minQty:1,   maxQty:2   },
                     { itemId:'stellar_heart',  chance:0.08, minQty:1,   maxQty:1   },
                     { itemId:'terbium',        chance:0.90, minQty:120, maxQty:400 } ],
    phantom:       [ { itemId:'plasma_shard',   chance:0.65, minQty:8,   maxQty:30  },
                     { itemId:'neutrino_core',  chance:0.40, minQty:4,   maxQty:12  },
                     { itemId:'void_essence',   chance:0.15, minQty:2,   maxQty:4   },
                     { itemId:'terbium',        chance:0.60, minQty:40,  maxQty:130 } ],
    drone:         [ { itemId:'drone_relic',    chance:1.00, minQty:1,   maxQty:1   },
                     { itemId:'quantum_matrix', chance:1.00, minQty:10,  maxQty:25  },
                     { itemId:'stellar_heart',  chance:1.00, minQty:5,   maxQty:10  } ],
    cubicle:       [ { itemId:'alien_chip',     chance:0.60, minQty:2,   maxQty:6   },
                     { itemId:'energy_cell',    chance:0.30, minQty:1,   maxQty:3   } ],
};

// ============================================================
//  CARGO BOX — Box rare sulla mappa con loot speciale
// ============================================================
const CARGO_BOX_CONFIG = {
    MAX_PER_MAP:    10,    // massimo 10 box presenti contemporaneamente
    RESPAWN_TIME:   240,   // secondi tra uno spawn e il successivo (dopo raccolta)
    COLLECT_RADIUS: 80,    // distanza di raccolta (px)
    BOX_LIFETIME:   600,   // secondi prima che scompaia da sola (10 min)

    // Probabilità categoria loot (somma = 1.0)
    LOOT_CATEGORY_WEIGHTS: {
        credits:  0.40,
        ammo:     0.35,
        missiles: 0.15,
        special:  0.10
    },

    // Crediti: 80% fascia bassa, 20% fascia alta (scala fino a 1% per 50k)
    CREDITS: {
        TIER1: { min: 1000,  max: 15000, weight: 0.80 },
        TIER2: { min: 15001, max: 50000, weight: 0.20 }
    },

    // Munizioni laser (X2/X3/X4/SAB) quantità 50-300
    AMMO_TYPES: ['x2', 'x3', 'x4', 'sab'],
    AMMO_MIN: 50,
    AMMO_MAX: 300,

    // Missili quantità 10-50
    MISSILE_TYPES: ['plt-2026', 'acm-01', 'dcr-250'],
    MISSILE_MIN: 10,
    MISSILE_MAX: 50,

    // Special: EMP e Mine quantità 1-5
    SPECIAL_TYPES: ['emp', 'mine-normal', 'mine-slow'],
    SPECIAL_MIN: 1,
    SPECIAL_MAX: 5
};

module.exports = { TICK_RATE, DELTA_TIME, ENEMY_TYPES, MINE_TYPES, bases, LOOT_ITEMS, ENEMY_LOOT, CARGO_BOX_CONFIG };
