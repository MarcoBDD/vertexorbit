// ============================================================
//  maps.js — Struttura mappe, ID counter, utilità geometria
// ============================================================
const { bases } = require('./config');

let entityIdCounter = 0;
function getNextId() { return ++entityIdCounter; }

function circleIntersect(c1, c2) {
    if (isNaN(c1.x) || isNaN(c1.y) || isNaN(c2.x) || isNaN(c2.y)) return false;
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    return Math.sqrt(dx * dx + dy * dy) < ((c1.radius || 0) + (c2.radius || 0));
}

const maps = {
    'Arena': {
        players:    new Map(),
        enemies:    new Map(),
        resources:  new Map(),
        projectiles:new Map(),
        turrets:    new Map(),
        mines:      new Map(),
        cargoBoxes: new Map(),       // Cargo Box rare
        cargoBoxTimer: 0             // timer per prossimo spawn
    }
};

function initMaps() {
    console.log('[SERVER] Inizializzazione mappe e torrette base...');
    const tMap = maps['Arena'].turrets;
    const dist = 300;
    for (let f in bases) {
        const b = bases[f];
        const base = { range: 800, damage: 2500, fireRate: 1, lastShot: 0, angle: 0, faction: f, radius: 50 };
        // Posizionamento delle 5 torrette direttamente SOPRA le strutture della base Voxel (Scala 1.5x)
        tMap.set(getNextId(), { ...base, id: entityIdCounter, x: b.x + 50,   y: b.y - 300 }); // Top
        tMap.set(getNextId(), { ...base, id: entityIdCounter, x: b.x - 360,   y: b.y + 60 }); // Ala Sinistra
        tMap.set(getNextId(), { ...base, id: entityIdCounter, x: b.x + 360,   y: b.y + 60 }); // Ala Destra
        tMap.set(getNextId(), { ...base, id: entityIdCounter, x: b.x - 180,   y: b.y + 320 }); // Retro Sinistra
        tMap.set(getNextId(), { ...base, id: entityIdCounter, x: b.x + 180,   y: b.y + 320 }); // Retro Destra
    }
}

module.exports = { maps, getNextId, circleIntersect, initMaps };
