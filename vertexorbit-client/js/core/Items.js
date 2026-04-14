const ITEMS = {
    ships: {
        'phoenix': { name: 'Phoenix', hp: 4000, speed: 280, laserSlots: 1, shieldSlots: 1, generatorSlots: 1, cargo: 200, cost: 0, color: '#a0a0a0', sprintBase: 4000, sprintDrain: 150, desc: 'Small, compact ship. Very basic appearance.' },
        'liberator': { name: 'Liberator', hp: 16000, speed: 300, laserSlots: 3, shieldSlots: 2, generatorSlots: 2, cargo: 500, cost: 10000, color: '#b3b3cc', sprintBase: 5000, sprintDrain: 200, desc: 'Longer, symmetrical shape. Slightly aggressive.' },
        'nostromo': { name: 'Nostromo', hp: 64000, speed: 320, laserSlots: 4, shieldSlots: 3, generatorSlots: 3, cargo: 1000, cost: 50000, color: '#ffb366', sprintBase: 8000, sprintDrain: 300, desc: 'Wide structure, evident wings, industrial look.' },
        'bigboy': { name: 'Bigboy', hp: 128000, speed: 260, laserSlots: 4, shieldSlots: 4, generatorSlots: 4, cargo: 1600, cost: 100000, color: '#996633', sprintBase: 7000, sprintDrain: 400, desc: 'Massive and heavy ship. Tank-like appearance, not very aerodynamic.' },
        'leonov': { name: 'Leonov', hp: 64000, speed: 360, laserSlots: 5, shieldSlots: 5, generatorSlots: 5, cargo: 1200, cost: 150000, color: '#cc00cc', sprintBase: 9000, sprintDrain: 350, desc: 'Compact and technological, with glowing details.' },
        'vengeance': { name: 'Vengeance', hp: 180000, speed: 400, laserSlots: 6, shieldSlots: 6, generatorSlots: 6, cargo: 2000, cost: 300000, color: '#66ccff', sprintBase: 12000, sprintDrain: 450, desc: 'Aerodynamic shape, thin lines, fighter style.' },
        'goliath': { name: 'Goliath', hp: 256000, speed: 300, laserSlots: 15, shieldSlots: 15, generatorSlots: 15, cargo: 3000, cost: 500000, color: '#ff4d4d', sprintBase: 14000, sprintDrain: 600, desc: 'Large and heavy. Battleship appearance.' },
        'spearhead': { name: 'Spearhead', hp: 100000, speed: 420, laserSlots: 5, shieldSlots: 5, generatorSlots: 8, cargo: 1200, cost: 450000, color: '#b3ffff', sprintBase: 15000, sprintDrain: 400, desc: 'Thin and advanced, triangular stealth style shape.' },
        'citadel': { name: 'Citadel', hp: 512000, speed: 240, laserSlots: 5, shieldSlots: 20, generatorSlots: 15, cargo: 6000, cost: 800000, color: '#cc6600', sprintBase: 10000, sprintDrain: 800, desc: 'Huge and armored, heavy defensive structure.' }
    },

    // ── LASER AMMO ──────────────────────
    laserAmmo: {
        'x1': { name: 'x1 Ammo', multiplier: 1.0, costCredits: 0,
            color: '#e2e8f0', stackMax: 99999,
            desc: 'Basic laser ammo. Free and unlimited. Standard laser damage.' },
        'x2': { name: 'x2 Ammo', multiplier: 2.0, costCredits: 10,
            color: '#facc15', stackMax: 50000,
            desc: 'Advanced laser ammo. Double damage.' },
        'x3': { name: 'x3 Ammo', multiplier: 3.0, costCredits: 25,
            color: '#f97316', stackMax: 20000,
            desc: 'Enhanced laser ammo. Triple damage.' },
        'x4': { name: 'x4 Ammo', multiplier: 4.0, costCredits: 50,
            color: '#ef4444', stackMax: 10000,
            desc: 'Top-tier military ammo. Quadruple damage.' },
        'sab': { name: 'SAB-50 (Shield Siphon)', multiplier: 0, costCredits: 30,
            color: '#22d3ee', stackMax: 10000, stealPct: 0.08,
            desc: 'Steals 8% of the enemy\'s shields.' }
    },

    // ── MISSILES ─────────────────────────────────────────────
    missiles: {
        'r-310':    { name: 'R-310',       damage: 300,  cooldown: 1.5, costCredits: 100,
            color: '#94a3b8', radius: 5, type: 'standard',
            desc: 'Basic missile. Low cost, short cooldown.' },
        'plt-2026': { name: 'PLT-2026',    damage: 500,  cooldown: 2.0, costCredits: 500,
            color: '#fb923c', radius: 6, type: 'standard',
            desc: 'Standard thermal guidance missile. Good damage.' },
        'plt-3030': { name: 'PLT-3030',    damage: 1200, cooldown: 3.0, costCredits: 1500,
            color: '#f97316', radius: 7, type: 'standard',
            desc: 'Heavy missile.' },
        'pld-8':    { name: 'PLD-8 (Slow)',damage: 200,  cooldown: 4.0, costCredits: 2500,
            color: '#a855f7', radius: 6, type: 'slow', slowPct: 0.40, slowDuration: 5,
            desc: 'Slows by 40% for 5s.' },
        'agt-500':  { name: 'AGT-500 (Area)', damage: 800, cooldown: 8.0, costCredits: 5000,
            color: '#dc2626', radius: 8, type: 'area', aoeRadius: 300,
            desc: 'Area of effect missile (300 u).' }
    },

    // ── MINES ───────────────────────────────────
    mines: {
        'mine-normal': { name: 'Normal Mine', damage: 2000, costCredits: 2000,
            radius: 30, triggerRadius: 60, color: '#dc2626',
            desc: 'Basic proximity mine.' },
        'mine-slow':   { name: 'Slow Mine',    damage: 500,  costCredits: 3500,
            radius: 25, triggerRadius: 70, color: '#a855f7', slowPct: 0.50, slowDuration: 4,
            desc: 'Slows by 50% for 4s.' },
        'smart-bomb':  { name: 'Smart Bomb',   damage: 3500, costCredits: 10000,
            radius: 0, aoeRadius: 350, color: '#f59e0b', instant: true,
            desc: 'Hits EVERYONE within 350 units instantly.' }
    },

    // ── EMP ──────────────────────────────────────
    emp: {
        'emp-01': { name: 'EMP-01', cooldown: 20, costCredits: 15000,
            range: 400, color: '#22d3ee',
            desc: 'Disables enemy targeting and grants invulnerability. High cost, essential.' }
    },

    // ── LASERS ─────────────────────────
    lasers: {
        'lf2': { name: 'LF-2', damage: 100, cost: 5000,   color: '#e6e6e6',
            desc: 'Standard laser cannon. Damage: 100 per shot.' },
        'lf3': { name: 'LF-3', damage: 150, cost: 25000,  color: '#66ff66',
            desc: 'Advanced laser cannon. +50% damage over LF-2. Damage: 150 per shot.' },
        'lf4': { name: 'LF-4', damage: 200, cost: 100000,  color: '#ff3333',
            desc: 'Military-grade laser cannon. High-energy beam. Damage: 200 per shot.' }
    },

    drones: {
        'flax': { name: 'Flax', slots: 1, cost: 15000,
            desc: 'Basic drone with 1 slot.' },
        'iris': { name: 'Iris', slots: 2, cost: 45000,
            desc: 'Advanced drone with 2 slots.' },
        'apis': { name: 'Apis', slots: 2, cost: 120000, shieldBonus: 0.08,
            desc: 'Epic drone with 2 slots. +8% Ship Shield.' },
        'zeus': { name: 'Zeus', slots: 2, cost: 300000, shieldBonus: 0.10, damageBonus: 0.06,
            desc: 'Legendary drone with 2 slots. +10% Ship Shield, +6% Ship Damage.' }
    },
    shields: {
        'sg3n-b01': { name: 'SG3N-B01', shield: 4000,  cost: 10000,  color: '#99ccff',
            desc: 'Basic shield generator. Shield: 4000 points.' },
        'sg3n-b02': { name: 'SG3N-B02', shield: 10000, cost: 40000,  color: '#3399ff',
            desc: 'Military heavy shield. Shield: 10000 points.' },
        'sg3n-b03': { name: 'SG3N-B03', shield: 18000, cost: 100000, color: '#00ccff',
            desc: 'Elite quantum shield. Shield: 18000 points. Maximum protection tier.' }
    },
    generators: {
        'g3n-3500': { name: 'G3N-3500', speed: 5, sprintBonus: 800, cost: 20000,
            desc: 'Speed generator (+5) and sprint (+800).' },
        'g3n-7900': { name: 'G3N-7900', speed: 10, sprintBonus: 1200, cost: 45000,
            desc: 'Speed generator (+10) and sprint (+1200).' },
        'g3n-10x': { name: 'G3N-10X', speed: 15, sprintBonus: 1900, cost: 95000,
            desc: 'Speed generator (+15) and sprint (+1900).' }
    },
    cpus: {
        'auto-rocket': { name: 'Auto-Rocket CPU', type: 'auto_missile', cost: 15000,
            desc: 'Automates missile firing.' },
        'auto-jump':   { name: 'Advanced Jump CPU', type: 'jump',        cost: 35000,
            desc: 'Jumps between maps in half the time.' }
    },
    pets: {
        'pet-10': { name: 'P.E.T. 10', cost: 150000, damage: 200, slots: 1,
            desc: 'Autonomous drone. Auto-collects loot and attacks enemies.' },
        'pet-20': { name: 'P.E.T. 20', cost: 300000, damage: 350, slots: 2,
            desc: 'Advanced drone. Auto-collects loot and attacks enemies.' },
        'pet-30': { name: 'P.E.T. 30', cost: 750000, damage: 500, slots: 3,
            desc: 'Elite drone. Auto-collects loot and attacks enemies.' }
    }
};

const ENEMY_TYPES = {
    'lordakia': { name: 'Lordakia', hp: 2200, speed: 170, damage: 60, radius: 14, reward: 110, color: '#8b0000', tier: 'Basic', attackType: 'Melee' },
    'saimon': { name: 'Saimon', hp: 5000, speed: 190, damage: 120, radius: 18, reward: 260, color: '#f97316', tier: 'Basic', attackType: 'Laser' },
    'mordon': { name: 'Mordon', hp: 14000, speed: 120, damage: 240, radius: 26, reward: 560, color: '#92400e', tier: 'Intermediate', attackType: 'Melee' },
    'sibelon': { name: 'Sibelon', hp: 52000, speed: 90, damage: 600, radius: 115, reward: 2200, color: '#4c1d95', tier: 'Advanced', attackType: 'Missile' },
    'kristallin': { name: 'Kristallin', hp: 18000, speed: 230, damage: 320, radius: 25, reward: 1200, color: '#06b6d4', tier: 'Advanced', attackType: 'Laser' },
    'kristallon': { name: 'Kristallon', hp: 120000, speed: 130, damage: 1200, radius: 90, reward: 5600, color: '#1d4ed8', tier: 'Elite', attackType: 'Laser' },
    'cubikon': { name: 'Cubikon', hp: 480000, speed: 20, damage: 1500, radius: 255, reward: 24000, color: '#d4d4d8', tier: 'Boss', attackType: 'Laser' },
    'uber_lordakia': { name: 'Uber Lordakia', hp: 10000, speed: 240, damage: 260, radius: 18, reward: 700, color: '#7f1d1d', tier: 'Uber', attackType: 'Melee' },
    'interceptor': { name: 'Interceptor', hp: 7000, speed: 310, damage: 170, radius: 12, reward: 450, color: '#22c55e', tier: 'Scout', attackType: 'Laser' },
    'barracuda': { name: 'Barracuda', hp: 26000, speed: 160, damage: 420, radius: 30, reward: 1700, color: '#f59e0b', tier: 'Hunter', attackType: 'Missile' },
    'annihilator': { name: 'Annihilator', hp: 180000, speed: 85, damage: 1900, radius: 155, reward: 9000, color: '#991b1b', tier: 'Titan', attackType: 'Missile' },
    'phantom': { name: 'Phantom', hp: 16000, speed: 280, damage: 280, radius: 16, reward: 1400, color: '#6366f1', tier: 'Assassin', attackType: 'Laser' },
    'drone': { name: 'Fugitive Drone', hp: 350000, speed: 450, damage: 0, radius: 25, reward: 50000, color: '#facc15', tier: 'Special', attackType: 'Flee' }
};
