// ============================================================
//  botAi.js — AI Bot completa con logiche realistiche
//  v2: scheduling orario, AFK, munizioni, EXP, party, log bordo
// ============================================================
const { registerBot, loadUserData, saveUserData, saveBotData } = require('../db');
const { bases, ENEMY_TYPES } = require('./config');
const { getNextId } = require('./maps');
const { calcShieldStats, addPilotExp } = require('./playerHandler');
// broadcastBoardLog: lazy require per evitare circular dependency
function broadcastBoardLog(msg, color) {
    try { require('./playerHandler').broadcastBoardLog(msg, color); } catch(e) {}
}

// ── Limite mappa (bordo rosso) ────────────────────────────────
const MAP_LIMIT = 9400; // leggermente interno al bordo reale 9500

// ── Dati items server-side ────────────────────────────────────
const ITEMS_DATA = {
    ships: {
        'phoenix':   { hp: 4000,   speed: 280, laserSlots: 1,  shieldSlots: 1,  generatorSlots: 1,  cargo: 200,  cost: 0      },
        'liberator': { hp: 16000,  speed: 300, laserSlots: 3,  shieldSlots: 2,  generatorSlots: 2,  cargo: 500,  cost: 10000  },
        'nostromo':  { hp: 64000,  speed: 320, laserSlots: 4,  shieldSlots: 3,  generatorSlots: 3,  cargo: 1000, cost: 50000  },
        'bigboy':    { hp: 128000, speed: 260, laserSlots: 4,  shieldSlots: 4,  generatorSlots: 4,  cargo: 1600, cost: 100000 },
        'leonov':    { hp: 64000,  speed: 360, laserSlots: 5,  shieldSlots: 5,  generatorSlots: 5,  cargo: 1200, cost: 150000 },
        'vengeance': { hp: 180000, speed: 400, laserSlots: 6,  shieldSlots: 6,  generatorSlots: 6,  cargo: 2000, cost: 300000 },
        'goliath':   { hp: 256000, speed: 300, laserSlots: 15, shieldSlots: 15, generatorSlots: 15, cargo: 3000, cost: 500000 },
        'aegis':     { hp: 256000, speed: 300, laserSlots: 7,  shieldSlots: 8,  generatorSlots: 8,  cargo: 2400, cost: 600000 },
        'spearhead': { hp: 100000, speed: 420, laserSlots: 5,  shieldSlots: 5,  generatorSlots: 8,  cargo: 1200, cost: 450000 },
        'citadel':   { hp: 512000, speed: 240, laserSlots: 5,  shieldSlots: 20, generatorSlots: 15, cargo: 6000, cost: 800000 }
    },
    lasers:     { 'lf2': { damage: 100, cost: 5000 }, 'lf3': { damage: 150, cost: 25000 }, 'lf4': { damage: 200, cost: 100000 } },
    shields:    { 'sg3n-b01': { shield: 4000, cost: 10000 }, 'sg3n-b02': { shield: 10000, cost: 40000 }, 'sg3n-b03': { shield: 18000, cost: 100000 } },
    generators: { 'g3n-7900': { speed: 10, cost: 20000 } },
    drones:     { 'flax': { slots: 1, cost: 15000 }, 'iris': { slots: 2, cost: 45000 }, 'apis': { slots: 2, cost: 120000 }, 'zeus': { slots: 2, cost: 250000 } },
    pets:       { 'pet-10': { cost: 200000 } }
};

// ── Nomi realistici ───────────────────────────────────────────
const REALISTIC_NAMES = [
    'Marco92','xXSniperFoxXx','Ale-89','ShadowITA','Luca','D4rkSoul','Nico_1991','TitanWolf','Roby-DO','GhostRider',
    'Simo88','V1per-X','Daniel','ZetaHunter','M4xPower','Falcon','Fede_94','Night-Wolf','Gabriele','xRazorx',
    'Tony-ITA','BlackNova','Vale','Cr4sh_90','IronMike','Peppe','D3stroyer','AlphaOne','Ricky-87','Void',
    'Leon-91','SkullX','Dany','M4rco-x','Orion','Samu_ITA','Frost','R0byDark','NeoPilot','Teo',
    'H4wk','Vortex','P4olo','Zero_One','Nik','D4rkNiko','HyperWolf','Albe-93','Kira','WolfHunter'
];
const HUNTER_NAMES = [
    'BountyKill3r','Pred4tor','xHunterX','NullM3rcy','GrimReap3r',
    'H4unter-ITA','SilentBlade','D3adEye','GhostStalker','VoidHunter'
];

// ── Formazioni droni disponibili ──────────────────────────────
const DRONE_FORMATIONS = ['standard','diamond','arrow','star','orbit','defense'];
// Formazione ottimale per stato
function getBestFormation(state, profile) {
    if (state === 'ATTACK_PLAYER' || state === 'ATTACK_NPC') {
        if (profile === 'CACCIATORE') return 'arrow';
        if (profile === 'AGGRESSIVO') return 'diamond';
        return 'orbit';
    }
    if (state === 'FLEE') return 'defense';
    if (state === 'REPAIRING') return 'defense';
    if (state === 'LOOT') return 'standard';
    return 'standard';
}

// ── Mock WebSocket per i bot ──────────────────────────────────
const fakeWs = { readyState: 1, send: () => {} };

// ── Stato globale bot ─────────────────────────────────────────
let allBots = [];
let activeBotsPool = []; // pool di bot "pronti" non ancora connessi

// ── Cooldown armi realistici (secondi) ───────────────────────
const WEAPON_COOLDOWNS = {
    laser:     1.0,   // sparo laser
    missile:   3.5,   // missile R310 / PLT-2026
    emp:      30.0,   // EMP — cooldown lungo e realistico
    mine:     10.0,   // mina normale
    smartBomb:25.0    // smart bomb
};

// ── Munizioni iniziali bot (simulate come player) ────────────
function createBotAmmo(profile) {
    // Ogni tipo di bot compra diverse quantità
    const isHunter  = profile === 'CACCIATORE';
    const isAggro   = profile === 'AGGRESSIVO';
    return {
        ammo:        { x1: 9999, x2: isAggro||isHunter ? 3000 : 1000, x3: isHunter ? 2000 : 500, x4: isHunter ? 500 : 0, sab: 0 },
        missileAmmo: { 'r-310': isHunter?20:5, 'plt-2026': isAggro||isHunter?30:10, 'plt-3030': isHunter?10:0, 'pld-8': isHunter?5:0 },
        mineAmmo:    { 'mine-normal': isAggro||isHunter?5:2, 'mine-slow': isAggro?3:0 },
        empAmmo:     { emp: isHunter?3:isAggro?2:1 },
        // Tipo munizione laser attiva
        activeAmmo:  isHunter ? 'x3' : isAggro ? 'x2' : 'x1'
    };
}

// ════════════════════════════════════════════════════════════
//  SCHEDULING ORARIO: quanti bot online per ora del giorno
// ════════════════════════════════════════════════════════════
function getTargetBotCount() {
    const hour = new Date().getHours(); // ora locale del server
    // Fascia notte/mattina presto (0-7): 8-12 bot
    if (hour >= 0  && hour < 7)  return 8  + Math.floor(Math.random() * 5);
    // Mattina (7-11): 12-18
    if (hour >= 7  && hour < 11) return 12 + Math.floor(Math.random() * 7);
    // Mezzogiorno (11-14): 18-25
    if (hour >= 11 && hour < 14) return 18 + Math.floor(Math.random() * 8);
    // Pomeriggio (14-17): 22-30
    if (hour >= 14 && hour < 17) return 22 + Math.floor(Math.random() * 9);
    // Ora di punta (17-22): 28-35
    if (hour >= 17 && hour < 22) return 28 + Math.floor(Math.random() * 8);
    // Sera tarda (22-24): 15-22
    return 15 + Math.floor(Math.random() * 8);
}

// Durata sessione bot: da 15 min a 2 ore (in secondi)
function getSessionDuration() {
    const r = Math.random();
    if (r < 0.25) return 60 * (15 + Math.floor(Math.random() * 15));    // 15-30 min
    if (r < 0.55) return 60 * (30 + Math.floor(Math.random() * 30));    // 30-60 min
    if (r < 0.85) return 60 * (60 + Math.floor(Math.random() * 30));    // 60-90 min
    return 60 * (90 + Math.floor(Math.random() * 30));                   // 90-120 min
}

// ════════════════════════════════════════════════════════════
//  DISTORSIONE MOVIMENTO
// ════════════════════════════════════════════════════════════
function initMovementNoise(bot) {
    bot.noiseOffset      = Math.random() * Math.PI * 2;
    bot.noiseFreqA       = 0.15 + Math.random() * 0.10;
    bot.noiseAmpA        = 0.04 + Math.random() * 0.03;
    bot.noiseUpdateTimer = 0;
}
function getDistortedAngle(bot, baseAngle, now) {
    bot.noiseUpdateTimer -= 0.016;
    if (bot.noiseUpdateTimer <= 0) {
        bot.noiseUpdateTimer = 2.0 + Math.random() * 3.0;
        bot.noiseAmpA = 0.03 + Math.random() * 0.04;
    }
    return baseAngle + Math.sin((now + bot.noiseOffset) * bot.noiseFreqA) * bot.noiseAmpA;
}

// ════════════════════════════════════════════════════════════
//  CLAMP MAPPA — impedisce ai bot di uscire dal bordo rosso
// ════════════════════════════════════════════════════════════
function clampToMap(bot) {
    const dist = Math.hypot(bot.x, bot.y);
    if (dist > MAP_LIMIT) {
        const angle = Math.atan2(bot.y, bot.x);
        bot.x = Math.cos(angle) * MAP_LIMIT;
        bot.y = Math.sin(angle) * MAP_LIMIT;
        // Forza rientro verso il centro
        if (bot.patrolTarget) {
            bot.patrolTarget.x = bot.x * 0.6;
            bot.patrolTarget.y = bot.y * 0.6;
        }
    }
}

// ════════════════════════════════════════════════════════════
//  PATTERN DI COMBATTIMENTO
// ════════════════════════════════════════════════════════════
function pickCombatPattern(bot, targetDist) {
    const isHunter  = bot.botProfile === 'CACCIATORE';
    const isAggro   = bot.botProfile === 'AGGRESSIVO';
    const isPacific = bot.botProfile === 'PACIFICO';
    const patterns  = [
        { type:'ORBIT',         weight: isPacific ? 3 : 2 },
        { type:'STRAFE',        weight: 2 },
        { type:'APPROACH_FIRE', weight: isAggro||isHunter ? 3 : 1 },
        { type:'SPIRAL',        weight: isAggro ? 2 : 1 },
        { type:'ZIGZAG',        weight: isHunter ? 3 : 1 },
        { type:'HIT_AND_RUN',   weight: isHunter ? 4 : isPacific ? 2 : 1 },
        { type:'FIGURE8',       weight: 1 }
    ];
    const totalWeight = patterns.reduce((s,p) => s+p.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = patterns[0];
    for (const p of patterns) { r -= p.weight; if (r <= 0) { chosen = p; break; } }
    const orbitRadius = 300 + Math.random()*250;
    const orbitDir    = Math.random()<0.5 ? 1:-1;
    return {
        type: chosen.type, orbitRadius, orbitDir,
        orbitSpeed: (0.6+Math.random()*0.8)*orbitDir,
        orbitAngle: 0, strafeDir: Math.random()<0.5?1:-1, strafeTimer:0,
        spiralRadius: targetDist||600, hitRunPhase:'approach', hitRunTimer:0,
        zigzagDir: Math.random()<0.5?1:-1, zigzagTimer:0, fig8T:0,
        lifetime: 8+Math.random()*8
    };
}

function applyCombatPattern(bot, target, speed, DELTA_TIME, now) {
    const cp = bot.combatPattern;
    if (!cp) return { dx:0, dy:0 };
    cp.lifetime -= DELTA_TIME;
    if (cp.lifetime <= 0) {
        bot.combatPattern = pickCombatPattern(bot, Math.hypot(target.x-bot.x, target.y-bot.y));
        return { dx:0, dy:0 };
    }
    const tx=target.x, ty=target.y;
    const dist=Math.hypot(tx-bot.x,ty-bot.y);
    const aTgt=Math.atan2(ty-bot.y,tx-bot.x);
    let dx=0,dy=0;
    switch(cp.type) {
        case 'ORBIT': {
            cp.orbitAngle += cp.orbitSpeed*DELTA_TIME;
            const ox=tx+Math.cos(cp.orbitAngle)*cp.orbitRadius, oy=ty+Math.sin(cp.orbitAngle)*cp.orbitRadius;
            const a=Math.atan2(oy-bot.y,ox-bot.x);
            dx=Math.cos(a)*speed*DELTA_TIME; dy=Math.sin(a)*speed*DELTA_TIME; break;
        }
        case 'STRAFE': {
            cp.strafeTimer+=DELTA_TIME;
            if(cp.strafeTimer>2.0+Math.random()*1.5){cp.strafeTimer=0;cp.strafeDir*=-1;}
            const sa=aTgt+Math.PI/2*cp.strafeDir;
            let rx=0,ry=0;
            if(dist>cp.orbitRadius+60){rx=Math.cos(aTgt)*speed*0.4*DELTA_TIME;ry=Math.sin(aTgt)*speed*0.4*DELTA_TIME;}
            else if(dist<cp.orbitRadius-60){rx=-Math.cos(aTgt)*speed*0.4*DELTA_TIME;ry=-Math.sin(aTgt)*speed*0.4*DELTA_TIME;}
            dx=Math.cos(sa)*speed*0.6*DELTA_TIME+rx; dy=Math.sin(sa)*speed*0.6*DELTA_TIME+ry; break;
        }
        case 'APPROACH_FIRE': {
            if(dist>250+Math.random()*100){dx=Math.cos(aTgt)*speed*DELTA_TIME;dy=Math.sin(aTgt)*speed*DELTA_TIME;}
            else{dx=Math.cos(aTgt+Math.PI)*speed*DELTA_TIME;dy=Math.sin(aTgt+Math.PI)*speed*DELTA_TIME;if(dist>cp.orbitRadius)cp.lifetime=0;}
            break;
        }
        case 'SPIRAL': {
            cp.orbitAngle+=cp.orbitSpeed*DELTA_TIME; cp.spiralRadius=Math.max(200,cp.spiralRadius-15*DELTA_TIME);
            const sx=tx+Math.cos(cp.orbitAngle)*cp.spiralRadius,sy=ty+Math.sin(cp.orbitAngle)*cp.spiralRadius;
            const sa2=Math.atan2(sy-bot.y,sx-bot.x);
            dx=Math.cos(sa2)*speed*DELTA_TIME; dy=Math.sin(sa2)*speed*DELTA_TIME; break;
        }
        case 'ZIGZAG': {
            cp.zigzagTimer+=DELTA_TIME;
            if(cp.zigzagTimer>1.2+Math.random()*0.8){cp.zigzagTimer=0;cp.zigzagDir*=-1;}
            const za=aTgt+(Math.PI/7)*cp.zigzagDir;
            const ba2=dist>cp.orbitRadius?za:aTgt+Math.PI;
            dx=Math.cos(ba2)*speed*DELTA_TIME; dy=Math.sin(ba2)*speed*DELTA_TIME; break;
        }
        case 'HIT_AND_RUN': {
            if(cp.hitRunPhase==='approach'){
                if(dist<220){cp.hitRunPhase='flee';cp.hitRunTimer=2.0+Math.random()*1.0;}
                else{dx=Math.cos(aTgt)*speed*1.15*DELTA_TIME;dy=Math.sin(aTgt)*speed*1.15*DELTA_TIME;}
            } else {
                cp.hitRunTimer-=DELTA_TIME;
                dx=Math.cos(aTgt+Math.PI)*speed*DELTA_TIME;dy=Math.sin(aTgt+Math.PI)*speed*DELTA_TIME;
                if(cp.hitRunTimer<=0)cp.hitRunPhase='approach';
            }
            break;
        }
        case 'FIGURE8': {
            cp.fig8T+=DELTA_TIME*Math.abs(cp.orbitSpeed||0.7);
            const s8=Math.sin(cp.fig8T),c8=Math.cos(cp.fig8T),d8=1+s8*s8;
            const f8x=tx+cp.orbitRadius*c8/d8,f8y=ty+cp.orbitRadius*s8*c8/d8;
            const fa=Math.atan2(f8y-bot.y,f8x-bot.x);
            dx=Math.cos(fa)*speed*DELTA_TIME; dy=Math.sin(fa)*speed*DELTA_TIME; break;
        }
        default: dx=Math.cos(aTgt)*speed*DELTA_TIME; dy=Math.sin(aTgt)*speed*DELTA_TIME;
    }
    return {dx,dy};
}

// ════════════════════════════════════════════════════════════
//  COOPERAZIONE ALLEATI
// ════════════════════════════════════════════════════════════
function callAlliesOnTarget(callerBot, targetId, targetType, map) {
    let engaged = 0;
    allBots.forEach(ally => {
        if (ally.username===callerBot.username || ally.faction!==callerBot.faction || ally.isDead || !ally.online) return;
        const dist=Math.hypot(ally.x-callerBot.x, ally.y-callerBot.y);
        if(ally.targetId===targetId){engaged++;return;}
        const listenR = callerBot.botProfile==='CACCIATORE'?2500:1800;
        if(dist>listenR) return;
        if(ally.botProfile==='PACIFICO'&&ally.state==='IDLE') return;
        const isPvp=targetType==='PLAYER';
        const willHelp =
            ally.botProfile==='CACCIATORE' ||
            (ally.botProfile==='AGGRESSIVO'&&Math.random()<0.75) ||
            (ally.botProfile==='NORMALE'&&Math.random()<0.45&&!isPvp) ||
            (ally.botProfile==='NORMALE'&&Math.random()<0.60&&isPvp);
        if(!willHelp||engaged>=3) return;
        ally.state=isPvp?'ATTACK_PLAYER':'ATTACK_NPC';
        ally.targetId=targetId; ally.targetType=targetType;
        ally.pauseTimer=0.2+Math.random()*0.5; ally.combatPattern=null;
        engaged++;
    });
    return engaged;
}

// ════════════════════════════════════════════════════════════
//  STATS / UPGRADES
// ════════════════════════════════════════════════════════════
function calculateBotStats(userData) {
    const shipDef = ITEMS_DATA.ships[userData.shipType||'phoenix']||ITEMS_DATA.ships['phoenix'];
    let maxHp=shipDef.hp, speed=shipDef.speed, damage=0;
    const config=userData.configs?(userData.configs[userData.activeConfig||1]||null):null;
    if(config){
        if(config.lasers&&config.lasers.length>0) damage+=config.lasers.reduce((s,l)=>s+(ITEMS_DATA.lasers[l]?.damage||0),0);
        if(config.generators&&config.generators.length>0) speed+=config.generators.reduce((s,g)=>s+(ITEMS_DATA.generators[g]?.speed||0),0);
    }
    if(damage===0) damage=100;
    if(userData.botProfile==='PACIFICO')    speed*=1.15;
    if(userData.botProfile==='AGGRESSIVO')  damage*=1.2;
    if(userData.botProfile==='CACCIATORE'){damage*=1.3;speed*=1.1;}
    // Bonus da pilot skills
    if(userData.pilotSkills){
        damage *= 1+(userData.pilotSkills.damage||0)/100;
        speed  *= 1+(userData.pilotSkills.speed||0)/100;
        maxHp  *= 1+(userData.pilotSkills.hp||0)/100;
    }
    return { maxHp:Math.floor(maxHp), speed:Math.floor(speed), damage:Math.floor(damage) };
}

function equipBestItems(userData) {
    if(!userData.configs) return;
    const config=userData.configs[1];
    const shipDef=ITEMS_DATA.ships[userData.shipType||'phoenix']||ITEMS_DATA.ships['phoenix'];
    let droneSlots=0;
    (config.drones||[]).forEach(d=>{droneSlots+=(ITEMS_DATA.drones[d]?.slots||0);});
    const equipCategory=(invArray,dict,sortKey,maxSlots)=>{
        if(!invArray) return [];
        return [...invArray].sort((a,b)=>(dict[b]?.[sortKey]||0)-(dict[a]?.[sortKey]||0)).slice(0,maxSlots);
    };
    let totalLaser=shipDef.laserSlots, totalShield=shipDef.shieldSlots;
    if(userData.botProfile==='AGGRESSIVO'||userData.botProfile==='CACCIATORE') totalLaser+=droneSlots;
    else if(userData.botProfile==='PACIFICO') totalShield+=droneSlots;
    else{totalLaser+=Math.ceil(droneSlots/2);totalShield+=Math.floor(droneSlots/2);}
    config.lasers    =equipCategory(userData.inventory.lasers,    ITEMS_DATA.lasers,    'damage', totalLaser);
    config.shields   =equipCategory(userData.inventory.shields,   ITEMS_DATA.shields,   'shield', totalShield);
    config.generators=equipCategory(userData.inventory.generators,ITEMS_DATA.generators,'speed',  shipDef.generatorSlots);
    config.drones    =[...(userData.inventory.drones||[])].slice(0,8);
    config.pets      =[...(userData.inventory.pets||[])].slice(0,1);
}

function simulateBotUpgrades(botPlayer, forceSave=false) {
    let userData=loadUserData(botPlayer.username);
    if(!userData) return;
    let changed=false, credits=botPlayer.credits;
    let inv=userData.inventory;
    ['lasers','shields','generators','drones','pets'].forEach(k=>{if(!inv[k])inv[k]=[];});
    if(!inv.ships) inv.ships=[userData.shipType];

    // Sincronizza pilotSkills/pilotLevel
    if(botPlayer.pilotSkills) userData.pilotSkills = botPlayer.pilotSkills;
    if(botPlayer.pilotLevel  !== undefined) userData.pilotLevel  = botPlayer.pilotLevel;
    if(botPlayer.pilotExp    !== undefined) userData.pilotExp    = botPlayer.pilotExp;
    if(botPlayer.skillPoints !== undefined) userData.skillPoints = botPlayer.skillPoints;

    // SHOPPING NAVE (scala tutte senza limitazioni)
    const allShips=['phoenix','liberator','nostromo','bigboy','leonov','spearhead','vengeance','goliath','aegis','citadel'];
    const myIdx=allShips.indexOf(userData.shipType);
    if(myIdx>=0){
        for(let i=allShips.length-1;i>myIdx;i--){
            const cand=allShips[i],cost=ITEMS_DATA.ships[cand]?.cost;
            if(cost && credits>=cost){
                if(!inv.ships.includes(cand))inv.ships.push(cand);
                userData.shipType=cand;credits-=cost;changed=true;break;
            }
        }
    }
    // SHOPPING DRONI
    if(inv.drones.length<8){
        for(let dt of['zeus','apis','iris','flax']){
            if(credits>=ITEMS_DATA.drones[dt].cost){inv.drones.push(dt);credits-=ITEMS_DATA.drones[dt].cost;changed=true;break;}
        }
    }
    // SHOPPING PETS
    if(inv.pets.length<1&&credits>=ITEMS_DATA.pets['pet-10'].cost){
        inv.pets.push('pet-10');credits-=ITEMS_DATA.pets['pet-10'].cost;changed=true;
    }
    // SHOPPING EQUIPAGGIAMENTO
    let buys=0;
    while(credits>=5000&&buys<20){
        let bought=false;
        if(credits>=100000){inv.lasers.push('lf4');credits-=100000;bought=true;}
        else if(credits>=40000){inv.shields.push('sg3n-b02');credits-=40000;bought=true;}
        else if(credits>=25000){inv.lasers.push('lf3');credits-=25000;bought=true;}
        else if(credits>=20000){inv.generators.push('g3n-7900');credits-=20000;bought=true;}
        else if(credits>=10000){inv.shields.push('sg3n-b01');credits-=10000;bought=true;}
        else if(credits>=5000){inv.lasers.push('lf2');credits-=5000;bought=true;}
        if(bought){changed=true;buys++;}else break;
    }

    // SHOPPING MUNIZIONI (Struttura corretta darkorbit .counts)
    if(!botPlayer.ammo)        botPlayer.ammo        = { laserAmmo: 'x1', counts: { x1:999999, x2:500, x3:200, x4:100, sab:100 } };
    if(!botPlayer.missileAmmo) botPlayer.missileAmmo = { selected: 'plt-2026', counts: { 'plt-2026':30, 'r-310':50, 'plt-3030':10, 'pld-8':20 } };
    if(!botPlayer.empAmmo)     botPlayer.empAmmo     = { counts: { 'emp-01':5 } };

    if(credits>=50000 && (botPlayer.ammo.counts.x4||0)<2000){ botPlayer.ammo.counts.x4=(botPlayer.ammo.counts.x4||0)+1000; credits-=50000; changed=true; }
    if(credits>=20000 && (botPlayer.ammo.counts.x3||0)<5000){ botPlayer.ammo.counts.x3=(botPlayer.ammo.counts.x3||0)+2000; credits-=20000; changed=true; }
    if(credits>=10000 && (botPlayer.ammo.counts.x2||0)<10000){ botPlayer.ammo.counts.x2=(botPlayer.ammo.counts.x2||0)+5000; credits-=10000; changed=true; }
    if(credits>=10000 && (botPlayer.missileAmmo.counts['plt-3030']||0)<100){ botPlayer.missileAmmo.counts['plt-3030']=(botPlayer.missileAmmo.counts['plt-3030']||0)+20; credits-=10000; changed=true; }
    if(credits>=5000 && (botPlayer.missileAmmo.counts['plt-2026']||0)<500){ botPlayer.missileAmmo.counts['plt-2026']=(botPlayer.missileAmmo.counts['plt-2026']||0)+50; credits-=5000; changed=true; }
    if(credits>=20000 && (botPlayer.empAmmo.counts['emp-01']||0)<5){ botPlayer.empAmmo.counts['emp-01']=(botPlayer.empAmmo.counts['emp-01']||0)+1; credits-=20000; changed=true; }

    if(changed||forceSave){
        equipBestItems(userData);
        userData.credits=credits; botPlayer.credits=credits;
        botPlayer.shipType=userData.shipType;
        // Usa saveBotData (aggiornamento mirato) invece di saveUserData completo
        saveBotData(botPlayer.username, {
            botProfile:  userData.botProfile,
            shipType:    userData.shipType,
            credits:     userData.credits,
            score:       userData.score    || 0,
            kills:       userData.kills    || 0,
            deaths:      userData.deaths   || 0,
            pilotLevel:  userData.pilotLevel  || 1,
            pilotExp:    userData.pilotExp    || 0,
            skillPoints: userData.skillPoints || 0,
            pilotSkills: userData.pilotSkills || {},
            configs:     userData.configs     || {},
            inventory:   userData.inventory   || {},
            ammo:        botPlayer.ammo        || {},
            missileAmmo: botPlayer.missileAmmo || {},
            empAmmo:     botPlayer.empAmmo     || {},
        });
        const stats=calculateBotStats(userData);
        botPlayer.maxHp=stats.maxHp; botPlayer.speed=stats.speed; botPlayer.damage=stats.damage;
        botPlayer.maxCargo=ITEMS_DATA.ships[botPlayer.shipType]?.cargo||200;
        botPlayer.drones=userData.configs[1].drones||[];
        const sd=calcShieldStats(userData.configs,userData.activeConfig||1);
        botPlayer.maxShield=sd.maxShield; botPlayer.shieldRings=sd.shieldRings;
        botPlayer.fillRatio=sd.fillRatio; botPlayer.shieldSlots=sd.shieldSlots;
        botPlayer.usedShieldSlots=sd.usedShieldSlots;
        botPlayer.equipped=userData.configs[userData.activeConfig||1]||{};
        if(changed) console.log(`[AI] SHOP -> ${botPlayer.username} (${botPlayer.botProfile}) ship: ${botPlayer.shipType}. Dmg:${botPlayer.damage}`);
    }
}

// ════════════════════════════════════════════════════════════
//  AUTO-ASSEGNAZIONE PUNTI PILOTA PER BOT (al level-up)
// ════════════════════════════════════════════════════════════
function botAutoAssignSkillPoints(bot) {
    if(!bot.skillPoints||bot.skillPoints<=0) return;
    // Priorità skill per profilo
    const priorities = {
        'CACCIATORE': ['damage','speed','laser','missile','hp','shield'],
        'AGGRESSIVO':  ['damage','laser','hp','speed','missile','shield'],
        'NORMALE':     ['hp','damage','speed','shield','laser','loot'],
        'PACIFICO':    ['shield','hp','speed','loot','exp','coins']
    };
    const order = priorities[bot.botProfile] || priorities['NORMALE'];
    if(!bot.pilotSkills) bot.pilotSkills={hp:0,speed:0,sprint:0,shield:0,damage:0,laser:0,missile:0,coins:0,loot:0,exp:0};
    while(bot.skillPoints>0){
        let assigned=false;
        for(const skill of order){
            if((bot.pilotSkills[skill]||0)<10){
                bot.pilotSkills[skill]=(bot.pilotSkills[skill]||0)+1;
                bot.skillPoints--;
                assigned=true;
                break;
            }
        }
        if(!assigned) break; // tutti al max
    }
    // Salva nel DB con saveBotData (aggiornamento mirato)
    const userData=loadUserData(bot.username);
    if(userData){
        saveBotData(bot.username, {
            botProfile:  userData.botProfile,
            shipType:    userData.shipType     || bot.shipType,
            credits:     userData.credits      || bot.credits,
            score:       userData.score        || 0,
            kills:       userData.kills        || 0,
            deaths:      userData.deaths       || 0,
            pilotLevel:  bot.pilotLevel,
            pilotExp:    bot.pilotExp,
            skillPoints: bot.skillPoints,
            pilotSkills: bot.pilotSkills,
            configs:     userData.configs      || {},
            inventory:   userData.inventory    || {},
            ammo:        bot.ammo              || {},
            missileAmmo: bot.missileAmmo       || {},
            empAmmo:     bot.empAmmo           || {},
        });
    }
}

// ════════════════════════════════════════════════════════════
//  ZONE BASI — sicurezza
// ════════════════════════════════════════════════════════════
const ENEMY_BASE_EXCLUSION=1400;
function isNearEnemyBase(bot){
    for(const f in bases){
        if(f===bot.faction) continue;
        if(Math.hypot(bot.x-bases[f].x,bot.y-bases[f].y)<ENEMY_BASE_EXCLUSION) return true;
    }
    return false;
}
function isTargetInSafeZone(bot,target){
    if(!target?.faction) return false;
    const b=bases[target.faction];
    if(!b) return false;
    return Math.hypot(target.x-b.x,target.y-b.y)<ENEMY_BASE_EXCLUSION;
}
function isTargetTooStrong(bot,npc){
    const eff=bot.maxHp+(bot.maxShield||0);
    if(npc.maxHp>eff*3&&bot.botProfile!=='AGGRESSIVO'&&bot.botProfile!=='CACCIATORE') return true;
    if(npc.maxHp>eff*6) return true;
    return false;
}

// ════════════════════════════════════════════════════════════
//  CREAZIONE SINGOLO BOT
// ════════════════════════════════════════════════════════════
const FACTIONS=['MMO','EIC','VRU'];
const PROFILES=['PACIFICO','NORMALE','AGGRESSIVO'];

function createBotPlayer(botName, isHunter, map) {
    let userData=loadUserData(botName);
    if(!userData){
        const faction=FACTIONS[Math.floor(Math.random()*FACTIONS.length)];
        const profile=isHunter?'CACCIATORE':PROFILES[Math.floor(Math.random()*PROFILES.length)];
        const sType=isHunter?'spearhead':'phoenix';
        const initCfg={
            1:{shipType:'phoenix', lasers:['lf2'],shields:[],generators:['g3n-7900'],cpus:['auto-rocket'],missiles:['plt-2026'],drones:['flax'],droneItems:[[]],pets:[]},
            2:{shipType:'phoenix', lasers:[],shields:['sg3n-b01'],generators:[],cpus:[],missiles:['plt-2026'],drones:['flax'],droneItems:[[]],pets:[]}
        };
        const initInv={lasers:['lf2'],shields:['sg3n-b01'],generators:['g3n-7900'],missiles:['plt-2026'],drones:['flax'],cpus:['auto-rocket'],pets:[],ships:['phoenix']};
        const initCr=25000;
        registerBot(botName,faction,profile,'phoenix',initCr,initCfg,initInv);
        userData=loadUserData(botName);
        saveBotData(botName,userData);
    } else {
        if(!userData.botProfile){userData.isBot=true;userData.botProfile=isHunter?'CACCIATORE':PROFILES[Math.floor(Math.random()*PROFILES.length)];saveUserData(botName,userData);}
        if(userData.pilotLevel===undefined){userData.pilotLevel=1;userData.pilotExp=0;userData.skillPoints=0;userData.pilotSkills={hp:0,speed:0,sprint:0,shield:0,damage:0,laser:0,missile:0,coins:0,loot:0,exp:0};saveUserData(botName,userData);}
    }

    const dummy={username:botName,credits:userData.credits,shipType:userData.shipType};
    simulateBotUpgrades(dummy,true);
    userData=loadUserData(botName);

    const base=bases[userData.faction]||{x:0,y:0};
    const stats=calculateBotStats(userData);
    const sd=calcShieldStats(userData.configs,userData.activeConfig||1);

    const bot={
        ws:fakeWs, username:userData.username, faction:userData.faction,
        map:'Arena',
        x:base.x+Math.cos(Math.random()*Math.PI*2)*(100+Math.random()*350),
        y:base.y+Math.sin(Math.random()*Math.PI*2)*(100+Math.random()*350),
        angle:0, shipType:userData.shipType||'phoenix',
        hp:stats.maxHp, maxHp:stats.maxHp,
        shield:sd.maxShield, maxShield:sd.maxShield,
        shieldRings:sd.shieldRings, fillRatio:sd.fillRatio,
        shieldSlots:sd.shieldSlots, usedShieldSlots:sd.usedShieldSlots,
        equipped:userData.configs?(userData.configs[userData.activeConfig||1]||{}):{},
        speed:stats.speed, damage:stats.damage, radius:20,
        drones:userData.configs?(userData.configs[userData.activeConfig||1]?.drones||[]):[],
        score:userData.score||0, kills:userData.kills||0, deaths:userData.deaths||0,
        credits:userData.credits||0, cargo:0,
        maxCargo:ITEMS_DATA.ships[userData.shipType]?.cargo||200,
        materials:{}, isDead:false, isBot:true,
        botProfile:userData.botProfile,
        // Pilot
        pilotLevel:userData.pilotLevel||1, pilotExp:userData.pilotExp||0,
        skillPoints:userData.skillPoints||0, pilotSkills:userData.pilotSkills||{},
        // Munizioni finite (da userData se presenti, o default standard)
        ammo: userData.ammo || { laserAmmo: 'x1', counts: { x1: 999999, x2: 500, x3: 200, x4: 100, sab: 100 } },
        missileAmmo: userData.missileAmmo || { selected: 'plt-2026', counts: { 'r-310': 50, 'plt-2026': 30, 'plt-3030': 10, 'pld-8': 20, 'agt-500': 5 } },
        mineAmmo: userData.mineAmmo || { selected: 'mine-normal', counts: { 'mine-normal': 10, 'mine-slow': 10, 'smart-bomb': 3 } },
        empAmmo: userData.empAmmo || { counts: { 'emp-01': 5 } },
        activeAmmo: 'x1',
        // State machine
        state:'IDLE', targetId:null, targetType:null,
        patrolTarget:null, lastShot:0, lastMissile:0, lastEmp:0, lastMine:0,
        lastDamageTime:0, // reset → regen HP/Shield gestita dal game loop come per i player reali
        botTimer:Math.random()*5, respawnTimer:0, pauseTimer:0,
        lastHp:stats.maxHp, empInvulnerable:false,
        slowDebuffColor:null, slowTimer:0,
        combatPattern:null, allyCallCooldown:0,
        // Sessione online (gestita dallo scheduler)
        online:true,
        sessionEnd:0,      // timestamp (secondi) fine sessione
        droneFormation:'standard',
        // AFK / base sosta
        afkTimer:0,        // > 0 = in AFK
        baseStayTimer:0,   // sosta obbligatoria in base
        baseShopDone:false,// ha già fatto lo shop in questa sosta
        // Party bot
        partyId:null,
        partyInvitePending:null  // { from, partyId, acceptAt }
    };
    initMovementNoise(bot);
    return bot;
}

// ════════════════════════════════════════════════════════════
//  INIT BOT — pool totale + scheduling dinamico
// ════════════════════════════════════════════════════════════
function initBots(maps) {
    const map=maps['Arena'];
    if(!map) return;

    // Crea pool completo di nomi (non li mette in gioco tutti subito)
    const shuffled=[...REALISTIC_NAMES].sort(()=>0.5-Math.random());
    const hunters=[...HUNTER_NAMES].sort(()=>0.5-Math.random());
    allBots.length=0; // svuota in-place: preserva il riferimento importato da server.js

    shuffled.slice(0,REALISTIC_NAMES.length).forEach(n=>{
        const bot=createBotPlayer(n,false,map);
        bot.online=false; // non ancora connesso
        allBots.push(bot);
    });
    hunters.slice(0,HUNTER_NAMES.length).forEach(n=>{
        const bot=createBotPlayer(n,true,map);
        bot.online=false;
        allBots.push(bot);
    });

    // Prima connessione: popola fino al target orario
    updateBotConnections(map);

    // Ogni 60 secondi: controlla connessioni/disconnessioni
    setInterval(()=>updateBotConnections(map), 60000);
    console.log('[AI] Bot pool initialized. Total:', allBots.length);
}

// ── Gestione connessioni realistiche ─────────────────────────
function updateBotConnections(map) {
    const now=Date.now()/1000;
    const target=getTargetBotCount();
    // Disconnetti bot con sessione scaduta
    allBots.filter(b=>b.online&&b.sessionEnd>0&&now>=b.sessionEnd).forEach(bot=>{
        bot.online=false;
        map.players.delete(bot.username);
        bot.state='IDLE'; bot.targetId=null;
        if(!bot.isBot) return; // sicurezza
        broadcastBoardLog(`${bot.username} disconnected`, '#475569', { eventType: 'disconnect', faction: bot.faction });
        console.log(`[AI] Bot disconnected (session ended): ${bot.username}`);
    });
    const online=allBots.filter(b=>b.online).length;
    const diff=target-online;
    if(diff>0){
        // Connetti bot offline in modo casuale, non tutti insieme
        const offline=allBots.filter(b=>!b.online);
        const toConnect=offline.slice(0,diff).sort(()=>0.5-Math.random());
        toConnect.forEach((bot,i)=>{
            // Ritardo random 0-30s per non connettersi tutti nello stesso istante
            setTimeout(()=>{
                bot.online=true;
                bot.sessionEnd=now+getSessionDuration()+i*60;
                // Spawn inside safe zone (r < 500)
                const base=bases[bot.faction]||{x:0,y:0};
                const rA=Math.random()*Math.PI*2;
                bot.x=base.x+Math.cos(rA)*(100+Math.random()*350);
                bot.y=base.y+Math.sin(rA)*(100+Math.random()*350);
                bot.hp=bot.maxHp; bot.shield=bot.maxShield;
                bot.lastDamageTime=0; // reset → regen gestita dal game loop
                bot.isDead=false; bot.state='IDLE';
                bot.botTimer=2+Math.random()*5;
                map.players.set(bot.username,bot);
                broadcastBoardLog(`${bot.username} connected`, '#64748b', { eventType: 'connect', faction: bot.faction });
                console.log(`[AI] Bot connected: ${bot.username} (${bot.botProfile}) session end: ${Math.round((bot.sessionEnd-now)/60)}min`);
            }, i*Math.floor(Math.random()*30000));
        });
    } else if(diff<-3){
        // Troppi bot online → disconnetti qualcuno che sia in IDLE o ROAM
        const excess=allBots.filter(b=>b.online&&(b.state==='IDLE'||b.state==='ROAM')).slice(0,Math.abs(diff)-3);
        excess.forEach(bot=>{
            bot.online=false; bot.sessionEnd=0;
            map.players.delete(bot.username);
            broadcastBoardLog(`${bot.username} disconnected`, '#475569', { eventType: 'disconnect', faction: bot.faction });
        });
    }
}

// ════════════════════════════════════════════════════════════
//  PARTY BOT — logica inviti
// ════════════════════════════════════════════════════════════
function tryBotPartyInvite(bot, map) {
    // Già in party o timer non scaduto
    if(bot.partyId||bot.partyInvitePending) return;
    if(Math.random()>0.05) return; // 5% di chance per tick (bassa frequenza)

    // Cerca un player/bot vicino (raggio 600) della stessa fazione
    let candidate=null;
    const candidates=[];
    map.players.forEach(p=>{
        if(p.username===bot.username||p.isDead||p.faction!==bot.faction) return;
        if(Math.hypot(p.x-bot.x,p.y-bot.y)<600) candidates.push(p);
    });
    if(candidates.length===0) return;
    candidate=candidates[Math.floor(Math.random()*candidates.length)];

    // Crea party o usa quello esistente
    const { parties, broadcastPartyUpdate } = require('./partyHandler');
    let party=null;
    for(let p of parties.values()){if(p.members.has(bot.username)){party=p;break;}}

    if(!party){
        const { getNextId:gni } = require('./maps');
        party={ id:gni(), name:`${bot.username}'s Party`, leader:bot.username, members:new Set([bot.username]) };
        parties.set(party.id,party);
        bot.partyId=party.id;
        broadcastPartyUpdate(party);
    }

    if(candidate.isBot){
        // Invita un altro bot → accetta con 25% di prob dopo 5-20s di delay
        const delay=5000+Math.random()*15000;
        setTimeout(()=>{
            if(Math.random()<0.25&&!candidate.partyId&&!candidate.isDead&&candidate.online){
                candidate.partyId=party.id;
                party.members.add(candidate.username);
                broadcastPartyUpdate(party);
                console.log(`[AI Party] ${candidate.username} ha accettato l'invito di ${bot.username}`);
            }
        },delay);
    } else {
        // Invita player umano via WebSocket
        if(candidate.ws&&candidate.ws.readyState===1){
            candidate.ws.send(JSON.stringify({type:'partyInvite',from:bot.username,partyId:party.id}));
            // Il player ha 60s per rispondere — gestito nel partyHandler standard
        }
    }
}

function processBotPartyInvite(bot, partyId, accept) {
    const { parties, broadcastPartyUpdate } = require('./partyHandler');
    if(!bot.partyInvitePending) return;
    bot.partyInvitePending=null;
    if(!accept) return;
    const party=parties.get(partyId);
    if(!party) return;
    bot.partyId=partyId;
    party.members.add(bot.username);
    broadcastPartyUpdate(party);
}

// Quando un player invita un bot
function handlePlayerInviteBot(fromPlayer, botUsername) {
    const bot=allBots.find(b=>b.username===botUsername&&b.online);
    if(!bot||bot.partyId) return;
    // Evita inviti doppi pendenti
    if(bot.partyInvitePending) return;

    // ── Crea o recupera il party del player SUBITO (prima del timeout) ──
    const { parties, broadcastPartyUpdate } = require('./partyHandler');
    const { getNextId } = require('./maps');

    // Controlla che player e bot siano della stessa fazione
    if(bot.faction !== fromPlayer.faction){
        if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
            fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:`${bot.username} is from a different faction.`,isError:true}));
        return;
    }

    // Crea il party se il player non ne ha già uno, oppure recupera quello esistente
    let party=null;
    for(let p of parties.values()){if(p.members.has(fromPlayer.username)){party=p;break;}}
    if(!party){
        party={ id:getNextId(), name:`${fromPlayer.username}'s Party`, leader:fromPlayer.username, members:new Set([fromPlayer.username]) };
        parties.set(party.id, party);
        fromPlayer.partyId=party.id;
        broadcastPartyUpdate(party);
    }
    // Solo il leader può invitare
    if(party.leader !== fromPlayer.username){
        if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
            fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:'Only the party leader can invite players.',isError:true}));
        return;
    }

    bot.partyInvitePending=true;
    if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
        fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:`Invite sent to ${bot.username}.`}));

    // Accettazione: 25-50% — decisione presa UNA SOLA VOLTA prima del timeout
    const willAccept=Math.random()<(0.25+Math.random()*0.25);
    const partyId=party.id; // cattura l'id ora, prima del delay
    const delay=5000+Math.random()*10000;

    setTimeout(()=>{
        bot.partyInvitePending=false;
        // Verifica che il party esista ancora e il bot sia ancora disponibile
        const currentParty=parties.get(partyId);
        if(!currentParty){
            if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
                fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:`${bot.username} tried to join but the party no longer exists.`,isError:true}));
            return;
        }
        if(!bot.isDead&&bot.online&&willAccept&&!bot.partyId){
            bot.partyId=partyId;
            currentParty.members.add(bot.username);
            broadcastPartyUpdate(currentParty);
            if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
                fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:`${bot.username} accepted your party invite.`}));
            console.log(`[AI Party] ${bot.username} accepted invite from ${fromPlayer.username}`);
        } else {
            if(fromPlayer.ws&&fromPlayer.ws.readyState===1)
                fromPlayer.ws.send(JSON.stringify({type:'partyMessage',message:`${bot.username} declined your party invite.`,isError:true}));
            console.log(`[AI Party] ${bot.username} declined invite from ${fromPlayer.username} (willAccept:${willAccept}, dead:${bot.isDead}, online:${bot.online}, inParty:${!!bot.partyId})`);
        }
    },delay);
}

// ════════════════════════════════════════════════════════════
//  MAIN UPDATE LOOP
// ════════════════════════════════════════════════════════════
function updateBots(map, DELTA_TIME, now) {
    allBots.forEach(bot=>{
        if(!bot.online) return;

        // ── AFK check ────────────────────────────────────────
        if(bot.afkTimer>0){
            bot.afkTimer-=DELTA_TIME;
            return; // non fa nulla mentre è AFK
        }

        // ── Debuff / timer globali ────────────────────────────
        // slowDebuffTimer, slowPct, slowDebuffColor, empInvulnTimer sono gestiti
        // dal game loop esattamente come per i player reali. Qui gestiamo solo
        // allyCallCooldown che è specifico dei bot.
        if(bot.allyCallCooldown>0) bot.allyCallCooldown-=DELTA_TIME;

        // ── Respawn ──────────────────────────────────────────
        if(bot.isDead){
            if(!bot.respawnTimer) bot.respawnTimer=15;
            bot.respawnTimer-=DELTA_TIME;
            if(bot.respawnTimer<=0){
                bot.isDead=false;
                const base=bases[bot.faction]||{x:0,y:0};
                // spawn inside safe zone (r < 500)
                const rSpawn=Math.random()*Math.PI*2;
                bot.x=base.x+Math.cos(rSpawn)*(100+Math.random()*350);
                bot.y=base.y+Math.sin(rSpawn)*(100+Math.random()*350);
                bot.hp=bot.maxHp; bot.shield=bot.maxShield;
                bot.lastDamageTime=0; // reset → il game loop gestirà la regen come per i player
                bot.state='IDLE'; bot.targetId=null; bot.respawnTimer=0;
                bot.botTimer=5; bot.lastHp=bot.hp; bot.combatPattern=null;
                bot.isRegenerating=false; bot.isShieldRegen=false;
                // Sosta in base obbligatoria dopo respawn
                // FIX BUG1: baseStayInitial deve essere impostato anche qui (non solo nel percorso FLEE→REPAIRING)
                const respawnStay = 15 + Math.random() * 45;
                bot.baseStayTimer   = respawnStay;
                bot.baseStayInitial = respawnStay;
                bot.baseShopDone=false;
                map.players.set(bot.username,bot);
                console.log(`[AI] Bot respawned: ${bot.username}`);
            }
            return;
        }

        if(!bot.isBot) return;

        // ── Sosta in base (dopo respawn/riparazione) ──────────
        if(bot.baseStayTimer>0){
            bot.baseStayTimer-=DELTA_TIME;
            // A metà della sosta decide se fare shop (una sola volta)
            // FIX BUG3: soglia shop basata su percentuale del timer iniziale (robusto)
            // Attiva lo shop quando è trascorso il 40% della sosta (non metà del fallback 30)
            const shopThreshold = (bot.baseStayInitial || bot.baseStayTimer + 1) * 0.6;
            if(!bot.baseShopDone && bot.baseStayTimer < shopThreshold){
                bot.baseShopDone=true;
                simulateBotUpgrades(bot);
            }
            // 20% chance AFK nel mezzo della sosta
            if(bot.afkTimer<=0&&Math.random()<0.0005){ // ~0.05% per tick = ~20% in 60s
                bot.afkTimer=60+Math.random()*240; // 1-5 minuti
                console.log(`[AI] Bot AFK: ${bot.username} per ${Math.round(bot.afkTimer)}s`);
            }
            return;
        }

        bot.botTimer-=DELTA_TIME;
        let speed=bot.speed||300;
        if((bot.slowDebuffTimer||0)>0&&(bot.slowPct||0)>0) speed*=(1-(bot.slowPct||0));

        const damage=bot.damage||150;
        const base=bases[bot.faction];
        const hpPct=bot.maxHp>0?(bot.hp/bot.maxHp):0;
        const isTakingDamage=bot.hp<bot.lastHp;
        bot.lastHp=bot.hp;

        // ── Cambio formazione droni per stato ─────────────────
        const idealFormation=getBestFormation(bot.state,bot.botProfile);
        if(bot.droneFormation!==idealFormation) bot.droneFormation=idealFormation;

        // ── Reazione se attaccato mentre si ripara ────────────
        if(bot.state==='REPAIRING'&&isTakingDamage){
            bot.lastDamageTime=now; // reset timer regen — identico ai player reali
            bot.state='IDLE'; bot.pauseTimer=0.5;
            bot.isRegenerating=false; bot.isShieldRegen=false;
        }
        // ── Aggiorna lastDamageTime quando il bot riceve danno (qualsiasi stato) ──
        if(isTakingDamage) bot.lastDamageTime=now;

        // ── Rilevamento pericoli ──────────────────────────────
        let inDanger=false, attackerPlayer=null;
        map.enemies.forEach(e=>{
            if(e.target===bot.username&&isTargetTooStrong(bot,e)&&Math.hypot(e.x-bot.x,e.y-bot.y)<1000) inDanger=true;
        });
        map.players.forEach(p=>{
            if(p.faction!==bot.faction&&!p.isDead&&Math.hypot(p.x-bot.x,p.y-bot.y)<800)
                if(isTakingDamage) attackerPlayer=p;
        });

        // ── Bordo mappa: forzare rientro ──────────────────────
        if(isNearEnemyBase(bot)){
            bot.state='FLEE'; bot.targetId=null; bot.targetType=null; bot.combatPattern=null;
        }
        clampToMap(bot);

        // ── Soglie di fuga ────────────────────────────────────
        if(bot.state!=='REPAIRING'){
            const fleeHp=bot.botProfile==='PACIFICO'?0.45:bot.botProfile==='NORMALE'?0.25:bot.botProfile==='AGGRESSIVO'?0.10:0.12;
            if(hpPct<fleeHp||inDanger) bot.state='FLEE';
            if(isTakingDamage&&attackerPlayer&&bot.state!=='FLEE'&&bot.botProfile!=='PACIFICO'&&bot.state!=='ATTACK_PLAYER'&&bot.state!=='ATTACK_NPC'){
                bot.state='ATTACK_PLAYER'; bot.targetId=attackerPlayer.username; bot.targetType='PLAYER';
            }
        }

        // ── CACCIATORE: scansione player nemici ───────────────
        if(bot.botProfile==='CACCIATORE'&&bot.state!=='FLEE'&&bot.state!=='REPAIRING'&&bot.state!=='ATTACK_PLAYER'&&bot.state!=='ATTACK_NPC'){
            let closest=null,minD=3500;
            map.players.forEach(p=>{
                if(p.isDead||p.faction===bot.faction||p.empInvulnerable||p.username===bot.username) return;
                if(isTargetInSafeZone(bot,p)) return;
                const d=Math.hypot(p.x-bot.x,p.y-bot.y);
                if(d<minD){minD=d;closest=p;}
            });
            if(closest&&bot.botTimer<=0){
                bot.state='ATTACK_PLAYER'; bot.targetId=closest.username; bot.targetType='PLAYER';
                bot.combatPattern=null; bot.botTimer=2+Math.random()*3;
                if(bot.allyCallCooldown<=0){callAlliesOnTarget(bot,closest.username,'PLAYER',map);bot.allyCallCooldown=8;}
            }
        }

        // ── EMP di emergenza (con cooldown realistico) ────────
        if(bot.state==='FLEE'&&hpPct<0.15&&!bot.empInvulnerable&&(now-bot.lastEmp)>WEAPON_COOLDOWNS.emp&&(bot.empAmmo?.counts?.['emp-01']||0)>0&&Math.random()<0.05){
            bot.empInvulnerable=true; bot.empInvulnTimer=3.0;
            bot.lastEmp=now;
            bot.empAmmo.counts['emp-01']--;
            map.enemies.forEach(e=>{if(e.target===bot.username)e.target=null;});
            map.players.forEach(p=>{if(!p.isBot&&p.ws&&p.ws.readyState===1)p.ws.send(JSON.stringify({type:'empEffect',x:bot.x,y:bot.y}));});
        }

        // ── Party bot: tenta invito occasionale ──────────────
        if(bot.botTimer<=0&&bot.state==='ROAM'&&!bot.partyId){
            tryBotPartyInvite(bot,map);
        }

        // ── Loot di prossimità (solo fuori combattimento) ─────
        let nearbyLoot=null;
        const isInCombat=(bot.state==='ATTACK_PLAYER'||bot.state==='ATTACK_NPC');
        if(!isInCombat&&bot.cargo<bot.maxCargo){
            let minD=300;
            map.resources.forEach(r=>{const d=Math.hypot(r.x-bot.x,r.y-bot.y);if(d<minD){minD=d;nearbyLoot=r;}});
        }

        // ════════════════════════════════════════════════════
        //  STATO: FLEE
        // ════════════════════════════════════════════════════
        if(bot.state==='FLEE'){
            bot.isRegenerating=false; bot.isShieldRegen=false;
            const distToBase=Math.hypot(bot.x-base.x,bot.y-base.y);
            let fleeTarget=null;
            if(bot.targetId){
                fleeTarget=bot.targetType==='PLAYER'?map.players.get(bot.targetId):map.enemies.get(bot.targetId);
                if(fleeTarget&&(fleeTarget.isDead||fleeTarget.hp<=0)){fleeTarget=null;bot.targetId=null;}
            }
            if(!fleeTarget&&isTakingDamage){
                map.players.forEach(p=>{if(p.faction!==bot.faction&&!p.isDead&&Math.hypot(p.x-bot.x,p.y-bot.y)<800)fleeTarget=p;});
                if(fleeTarget){bot.targetId=fleeTarget.username;bot.targetType='PLAYER';}
            }
            // Bot must reach INSIDE the safe zone (r<600) before repairing
            if(distToBase<600&&!inDanger&&!isTakingDamage){
                bot.state='REPAIRING';
                bot.targetId=null;
                // patrol target clamped tightly inside safe zone (max r=450)
                const rAngle=Math.random()*Math.PI*2;
                const rDist=200+Math.random()*250;
                bot.patrolTarget={x:base.x+Math.cos(rAngle)*rDist, y:base.y+Math.sin(rAngle)*rDist};
                // mandatory base stay
                bot.baseStayInitial=15+Math.random()*45;
                bot.baseStayTimer=bot.baseStayInitial;
                bot.baseShopDone=false;
            } else {
                const bAngle=Math.atan2(base.y-bot.y,base.x-bot.x);
                bot.angle=getDistortedAngle(bot,bAngle,now);
                bot.x+=Math.cos(bot.angle)*speed*DELTA_TIME;
                bot.y+=Math.sin(bot.angle)*speed*DELTA_TIME;
                clampToMap(bot);
                // Fuoco di copertura
                if(fleeTarget){
                    const fd=Math.hypot(fleeTarget.x-bot.x,fleeTarget.y-bot.y);
                    if((now-bot.lastShot)>WEAPON_COOLDOWNS.laser&&fd<=700&&(bot.ammo?.counts?.x1||0)>0){
                        bot.lastShot=now;
                        const laserAmmoKey=bot.activeAmmo||'x1';
                        if(bot.ammo.counts[laserAmmoKey]>0) bot.ammo.counts[laserAmmoKey]--;
                        const sa=Math.atan2(fleeTarget.y-bot.y,fleeTarget.x-bot.x);
                        map.projectiles.set(getNextId(),{id:getNextId(),x:bot.x,y:bot.y,angle:sa,speed:1200,damage:damage*0.85,isPlayerOwned:true,ownerId:bot.username,color:'#ff8800',thickness:3,life:2,age:0,radius:4,targetId:bot.targetId});
                    }
                    if((now-bot.lastMissile)>WEAPON_COOLDOWNS.missile&&fd<=750&&Math.random()<0.4&&(bot.missileAmmo?.counts?.['plt-2026']||0)>0){
                        bot.lastMissile=now; bot.missileAmmo.counts['plt-2026']--;
                        const sa=Math.atan2(fleeTarget.y-bot.y,fleeTarget.x-bot.x);
                        map.projectiles.set(getNextId(),{id:getNextId(),x:bot.x,y:bot.y,angle:sa,speed:800,damage:2000,isPlayerOwned:true,ownerId:bot.username,color:'#ff4400',thickness:4,isMissile:true,life:3,age:0,radius:6,targetId:bot.targetId});
                    }
                }
            }
        }

        // ════════════════════════════════════════════════════
        //  STATO: REPAIRING
        //  La regen HP e Shield è gestita dal game loop (uguale ai player reali).
        //  Qui azzeriamo lastDamageTime così il game loop parte subito con la regen.
        // ════════════════════════════════════════════════════
        else if(bot.state==='REPAIRING'){
            // Forza il timer danno a 0 → il game loop avvierà la regen dopo 10/15s
            // (questo evita che resti bloccato su un valore vecchio)
            if(!bot.lastDamageTime) bot.lastDamageTime=0;
            // isRegenerating e isShieldRegen sono settati dal game loop, non qui

            // ── Micro-movimento nella base: ogni 8-20s cambia punto target ──────
            if(!bot.baseWanderTimer) bot.baseWanderTimer=8+Math.random()*12;
            bot.baseWanderTimer-=DELTA_TIME;
            if(bot.baseWanderTimer<=0){
                // Nuovo punto random dentro la safe zone
                const rA=Math.random()*Math.PI*2;
                const rD=80+Math.random()*320; // r tra 80 e 400 dalla base
                bot.patrolTarget={x:base.x+Math.cos(rA)*rD, y:base.y+Math.sin(rA)*rD};
                // Pausa casuale prima di muoversi di nuovo (simula giocatore fermo)
                bot.baseWanderTimer=8+Math.random()*12;
                // 30% di probabilità di stare fermi per un po' (simula AFK breve)
                if(Math.random()<0.30) bot.baseWanderPause=(3+Math.random()*8);
            }
            // Pausa: il bot è fermo, non segue il patrolTarget
            if(bot.baseWanderPause>0){
                bot.baseWanderPause-=DELTA_TIME;
            } else if(bot.patrolTarget){
                const tx=bot.patrolTarget.x,ty=bot.patrolTarget.y;
                if(Math.hypot(tx-bot.x,ty-bot.y)>40){
                    const a=Math.atan2(ty-bot.y,tx-bot.x);
                    bot.angle=getDistortedAngle(bot,a,now);
                    bot.x+=Math.cos(bot.angle)*speed*0.20*DELTA_TIME;
                    bot.y+=Math.sin(bot.angle)*speed*0.20*DELTA_TIME;
                    clampToMap(bot);
                }
            }
            if(bot.hp>=bot.maxHp&&bot.shield>=bot.maxShield&&bot.botTimer<=0&&bot.baseStayTimer<=0){
                // Vende cargo
                if(bot.cargo>0){bot.credits+=bot.cargo*20;bot.cargo=0;bot.materials={};}
                // Salva progressione
                const ud=loadUserData(bot.username);
                if(ud){ud.credits=bot.credits;ud.kills=bot.kills;ud.deaths=bot.deaths;ud.score=bot.score;ud.pilotLevel=bot.pilotLevel;ud.pilotExp=bot.pilotExp;ud.skillPoints=bot.skillPoints;ud.pilotSkills=bot.pilotSkills;saveUserData(bot.username,ud);}
                bot.isRegenerating=false; bot.isShieldRegen=false;
                bot.state='IDLE'; bot.botTimer=3+Math.random()*5;
            }
        }
        // ════════════════════════════════════════════════════
        //  STATI: IDLE / ROAM / LOOT / ATTACK
        //  HP e Shield sono rigenerati dal game loop (identico ai player reali).
        // ════════════════════════════════════════════════════
        else {
            // isRegenerating e isShieldRegen sono gestiti dal game loop, non qui

            // ── Scelta nuovo stato ────────────────────────────
            if(bot.botTimer<=0&&bot.state!=='ATTACK_PLAYER'){
                bot.botTimer=3+Math.random()*4;
                let found=false;
                // 1. Loot
                const lootChance=bot.botProfile==='CACCIATORE'?0.35:0.9;
                if(bot.cargo<bot.maxCargo&&Math.random()<lootChance){
                    let cl=null,md=2500;
                    map.resources.forEach(r=>{const d=Math.hypot(r.x-bot.x,r.y-bot.y);if(d<md){md=d;cl=r;}});
                    if(cl){bot.state='LOOT';bot.targetId=cl.id;bot.targetType='LOOT';found=true;}
                }
                // 2. PvP
                if(!found&&bot.botProfile!=='PACIFICO'){
                    const pvpR=bot.botProfile==='CACCIATORE'?3500:bot.botProfile==='AGGRESSIVO'?2500:1200;
                    let cp2=null,md2=pvpR;
                    map.players.forEach(p=>{
                        if(p.isDead||p.faction===bot.faction||p.empInvulnerable||p.username===bot.username) return;
                        if(isTargetInSafeZone(bot,p)) return;
                        const d=Math.hypot(p.x-bot.x,p.y-bot.y);
                        if(d<md2){md2=d;cp2=p;}
                    });
                    if(cp2){
                        bot.state='ATTACK_PLAYER';bot.targetId=cp2.username;bot.targetType='PLAYER';
                        bot.pauseTimer=0.5+Math.random()*1.0;bot.combatPattern=null;found=true;
                        if(bot.allyCallCooldown<=0){callAlliesOnTarget(bot,cp2.username,'PLAYER',map);bot.allyCallCooldown=10;}
                    }
                }
                // 3. PvE
                if(!found&&bot.botProfile!=='PACIFICO'){
                    const pveR=bot.botProfile==='CACCIATORE'?1000:1500;
                    let ce=null,md3=pveR;
                    map.enemies.forEach(e=>{const d=Math.hypot(e.x-bot.x,e.y-bot.y);if(d<md3&&!isTargetTooStrong(bot,e)){md3=d;ce=e;}});
                    if(ce){
                        bot.state='ATTACK_NPC';bot.targetId=ce.id;bot.targetType='NPC';
                        bot.pauseTimer=0.3+Math.random()*0.5;bot.combatPattern=null;found=true;
                        if(bot.allyCallCooldown<=0){callAlliesOnTarget(bot,ce.id,'NPC',map);bot.allyCallCooldown=12;}
                    }
                }
                // 4. ROAM
                if(!found){
                    bot.state='ROAM';
                    const rR=bot.botProfile==='CACCIATORE'?7000:5000; // ridotto per stare entro i limiti
                    const rAngle=Math.random()*Math.PI*2;
                    const rDist=1000+Math.random()*rR;
                    bot.patrolTarget={x:Math.cos(rAngle)*rDist,y:Math.sin(rAngle)*rDist};
                    // Clamp target roam entro mappa
                    const pd=Math.hypot(bot.patrolTarget.x,bot.patrolTarget.y);
                    if(pd>MAP_LIMIT*0.9){const a=Math.atan2(bot.patrolTarget.y,bot.patrolTarget.x);bot.patrolTarget.x=Math.cos(a)*MAP_LIMIT*0.85;bot.patrolTarget.y=Math.sin(a)*MAP_LIMIT*0.85;}
                }
            }

            // ── Loot di prossimità (override) ────────────────
            let moveNormal=true;
            if(nearbyLoot&&bot.state!=='LOOT'){
                const d=Math.hypot(nearbyLoot.x-bot.x,nearbyLoot.y-bot.y);
                if(d>bot.radius+15){
                    const a=Math.atan2(nearbyLoot.y-bot.y,nearbyLoot.x-bot.x);
                    bot.angle=getDistortedAngle(bot,a,now);
                    bot.x+=Math.cos(bot.angle)*speed*DELTA_TIME;
                    bot.y+=Math.sin(bot.angle)*speed*DELTA_TIME;
                    clampToMap(bot);
                }
                moveNormal=false;
            }

            // ── ROAM ─────────────────────────────────────────
            if(bot.state==='ROAM'&&bot.patrolTarget&&moveNormal){
                const tx=bot.patrolTarget.x,ty=bot.patrolTarget.y;
                if(Math.hypot(tx-bot.x,ty-bot.y)<100){bot.botTimer=0;}
                else{
                    const a=Math.atan2(ty-bot.y,tx-bot.x);
                    bot.angle=getDistortedAngle(bot,a,now);
                    bot.x+=Math.cos(bot.angle)*speed*DELTA_TIME;
                    bot.y+=Math.sin(bot.angle)*speed*DELTA_TIME;
                    clampToMap(bot);
                }
            }
            // ── LOOT ─────────────────────────────────────────
            else if(bot.state==='LOOT'&&bot.targetId&&moveNormal){
                const loot=map.resources.get(bot.targetId);
                if(!loot){bot.botTimer=1.0+Math.random();bot.state='ROAM';bot.patrolTarget={x:bot.x+Math.cos(bot.angle)*1000,y:bot.y+Math.sin(bot.angle)*1000};}
                else{
                    const d=Math.hypot(loot.x-bot.x,loot.y-bot.y);
                    if(d>bot.radius+15){
                        const a=Math.atan2(loot.y-bot.y,loot.x-bot.x);
                        bot.angle=getDistortedAngle(bot,a,now);
                        bot.x+=Math.cos(bot.angle)*speed*DELTA_TIME;
                        bot.y+=Math.sin(bot.angle)*speed*DELTA_TIME;
                        clampToMap(bot);
                    }
                }
            }
            // ── COMBATTIMENTO ─────────────────────────────────
            else if((bot.state==='ATTACK_PLAYER'||bot.state==='ATTACK_NPC')&&bot.targetId&&moveNormal){
                const target=bot.targetType==='PLAYER'?map.players.get(bot.targetId):map.enemies.get(bot.targetId);
                if(!target||target.hp<=0||target.isDead){
                    bot.botTimer=1.0+Math.random();bot.targetId=null;bot.state='ROAM';
                    bot.patrolTarget={x:bot.x+Math.cos(bot.angle)*1500,y:bot.y+Math.sin(bot.angle)*1500};
                    bot.combatPattern=null;
                } else if(bot.targetType==='PLAYER'&&isTargetInSafeZone(bot,target)){
                    bot.botTimer=0;bot.targetId=null;bot.targetType=null;bot.combatPattern=null;
                    bot.pauseTimer=2.0+Math.random()*2.0;bot.state='ROAM';
                    const aw=Math.atan2(bot.y-target.y,bot.x-target.x);
                    bot.patrolTarget={x:bot.x+Math.cos(aw)*3000,y:bot.y+Math.sin(aw)*3000};
                } else {
                    const tDist=Math.hypot(target.x-bot.x,target.y-bot.y);
                    const cAngle=Math.atan2(target.y-bot.y,target.x-bot.x);
                    bot.angle=cAngle;
                    if(!bot.combatPattern){
                        bot.combatPattern=pickCombatPattern(bot,tDist);
                        bot.combatPattern.orbitAngle=Math.atan2(bot.y-target.y,bot.x-target.x);
                    }
                    const {dx,dy}=applyCombatPattern(bot,target,speed,DELTA_TIME,now);
                    bot.x+=dx; bot.y+=dy;
                    bot.angle=Math.atan2(target.y-bot.y,target.x-bot.x);
                    clampToMap(bot);

                    // ── Scelta munizioni speciali in base alla % HP e Target ──
                    bot.activeAmmo = 'x1';
                    const targetHpPct = target.maxHp > 0 ? (target.hp / target.maxHp) : 1;
                    const myHpPct = bot.maxHp > 0 ? (bot.hp / bot.maxHp) : 1;
                    
                    if (bot.targetType === 'NPC') {
                        // Contro NPC: 15% al 50% di prob. sotto il 50% HP usa x2/x3
                        if (myHpPct < 0.50) {
                            const useSpecial = 0.15 + Math.random() * 0.35; // 15% - 50%
                            if (Math.random() < useSpecial) {
                                bot.activeAmmo = Math.random() > 0.5 ? 'x3' : 'x2';
                            }
                        }
                    } else if (bot.targetType === 'PLAYER') {
                        // Contro PLAYER: 35% al 80% di prob. sotto l'80% HP usa x2/x3/x4
                        if (myHpPct < 0.80) {
                            const useSpecial = 0.35 + Math.random() * 0.45; // 35% - 80%
                            if (Math.random() < useSpecial) {
                                const roll = Math.random();
                                if (roll < 0.33) bot.activeAmmo = 'x2';
                                else if (roll < 0.66) bot.activeAmmo = 'x3';
                                else bot.activeAmmo = 'x4';
                            }
                        }
                    }

                    // ── Sparo laser (con munizioni) ───────────
                    const laserKey=bot.activeAmmo||'x1';
                    const hasLaserAmmo=(bot.ammo?.counts?.[laserKey]||0)>0||(bot.ammo?.counts?.x1||0)>0;
                    if((now-bot.lastShot)>WEAPON_COOLDOWNS.laser&&tDist<=650&&hasLaserAmmo){
                        bot.lastShot=now;
                        const useKey=(bot.ammo?.counts?.[laserKey]||0)>0?laserKey:'x1';
                        if(bot.ammo?.counts?.[useKey]>0) bot.ammo.counts[useKey]--;
                        const isCrit=Math.random()<0.15;
                        const ammoMultiplier = useKey === 'x4' ? 4 : useKey === 'x3' ? 3 : useKey === 'x2' ? 2 : 1;
                        const finalDmg=(isCrit?damage*1.5:damage) * ammoMultiplier;
                        const col=useKey==='x4'?'#ffffff':useKey==='x3'?'#16a34a':useKey==='x2'?'#3b82f6':'#ef4444';
                        map.projectiles.set(getNextId(),{id:getNextId(),x:bot.x,y:bot.y,angle:cAngle,speed:1200,damage:finalDmg,isPlayerOwned:true,ownerId:bot.username,color:col,thickness:isCrit?6:3,life:2,age:0,radius:4,targetId:bot.targetId,isCrit,ammoType:useKey});
                    }
                    // ── Missile (con munizioni scalate) ───────────────
                    // Sceglie missile migliore disponibile in base al target
                    let mKey = 'plt-2026';
                    if (bot.targetType === 'PLAYER' && (bot.missileAmmo?.counts?.['plt-3030']||0)>0) mKey = 'plt-3030';
                    else if ((bot.missileAmmo?.counts?.['plt-2026']||0)>0) mKey = 'plt-2026';
                    else if ((bot.missileAmmo?.counts?.['r-310']||0)>0) mKey = 'r-310';

                    if((now-bot.lastMissile)>WEAPON_COOLDOWNS.missile&&tDist<=700&&(bot.missileAmmo?.counts?.[mKey]||0)>0){
                        bot.lastMissile=now; bot.missileAmmo.counts[mKey]--;
                        const missDmg = mKey === 'plt-3030' ? 6000 : mKey === 'plt-2026' ? 4000 : 2000;
                        const missCol = mKey === 'plt-3030' ? '#ef4444' : mKey === 'plt-2026' ? '#f97316' : '#eab308';
                        map.projectiles.set(getNextId(),{id:getNextId(),x:bot.x,y:bot.y,angle:cAngle,speed:800,damage:missDmg,isPlayerOwned:true,ownerId:bot.username,color:missCol,thickness:4,isMissile:true,life:3,age:0,radius:6,targetId:bot.targetId});
                    }
                    // ── Mina occasionale (AGGRESSIVO/CACCIATORE) ─
                    if((bot.botProfile==='AGGRESSIVO'||bot.botProfile==='CACCIATORE')&&(now-bot.lastMine)>WEAPON_COOLDOWNS.mine&&(bot.mineAmmo?.counts?.['mine-normal']||0)>0&&tDist<400&&Math.random()<0.03){
                        bot.lastMine=now; bot.mineAmmo.counts['mine-normal']--;
                        map.mines.set(getNextId(),{id:getNextId(),x:bot.x,y:bot.y,ownerId:bot.username,ownerFaction:bot.faction,def:{damage:2000,triggerRadius:60,color:'#dc2626',slowPct:0,slowDuration:0},age:0,triggered:false});
                    }
                    // ── EXP da NPC kill (gestita nel gameLoop, ma aggiunge score/kills) ─
                    // (già gestito nel gameLoop per player, per bot viene fatto qui per semplicità)
                }
            }
        } // fine else IDLE/ROAM/ATTACK
    }); // fine forEach allBots
}

module.exports = { initBots, updateBots, handlePlayerInviteBot, botAutoAssignSkillPoints, allBots };
