// ============================================================
//  gameLoop.js — Game loop principale (tick 20/s)
// ============================================================
const WebSocket = require('ws');
const { TICK_RATE, DELTA_TIME, ENEMY_TYPES, bases, LOOT_ITEMS, ENEMY_LOOT, CARGO_BOX_CONFIG } = require('./config');
const { maps, getNextId, circleIntersect } = require('./maps');
const { addCredits, sendPlayerStats, persistPlayerMeta, broadcastLeaderboard, handlePlayerDeath, addPilotExp, broadcastBoardLog } = require('./playerHandler');
const { handlePartyReward, parties, broadcastPartyUpdate } = require('./partyHandler');
const { updateBots, allBots: botList, botAutoAssignSkillPoints } = require('./botAi');

const SHIP_CARGO = {
    phoenix:   200,
    liberator: 500,
    nostromo:  1000,
    bigboy:    1600,
    leonov:    1200,
    vengeance: 2000,
    goliath:   3000,
    aegis:     2400,
    spearhead: 1600,
    citadel:   6000,
    tartarus:  2000,
    pusat:     1200
};

function startGameLoop() {
    let tickCount = 0;

    // ── Helper: applica debuff slow server-side + broadcast globale ───────
    function applySlowDebuff(map, targetPlayer, slowPct, duration, debuffColor) {
        targetPlayer.slowDebuffTimer = duration;
        targetPlayer.slowDebuffColor = debuffColor;
        targetPlayer.slowPct         = slowPct;
        // Notifica client locale con durata e percentuale
        if (targetPlayer.ws && targetPlayer.ws.readyState === WebSocket.OPEN)
            targetPlayer.ws.send(JSON.stringify({ type: 'slowDebuff', slowPct, duration, enemyColor: debuffColor }));
        // Broadcast animEvent a TUTTI → animazione onde su tutti i client
        const debuffEvt = JSON.stringify({
            type: 'animEvent', kind: 'debuffApplied',
            targetId: targetPlayer.username, targetType: 'player',
            slowPct, duration, color: debuffColor
        });
        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(debuffEvt); });
    }

    // ── Helper: genera loot per una Cargo Box ───────────────────────────
    function generateCargoBoxLoot() {
        const cfg = CARGO_BOX_CONFIG;
        // Scegli categoria
        const roll = Math.random();
        let cumW = 0;
        let category = 'credits';
        for (const [cat, w] of Object.entries(cfg.LOOT_CATEGORY_WEIGHTS)) {
            cumW += w;
            if (roll <= cumW) { category = cat; break; }
        }

        if (category === 'credits') {
            // Determina fascia
            const tierRoll = Math.random();
            let amount;
            if (tierRoll < cfg.CREDITS.TIER1.weight) {
                // Fascia 1: 1000–15000, distribuzione uniforme
                amount = Math.floor(cfg.CREDITS.TIER1.min + Math.random() * (cfg.CREDITS.TIER1.max - cfg.CREDITS.TIER1.min + 1));
            } else {
                // Fascia 2: 15001–50000, scala decrescente: più alto = meno probabile
                // Usiamo distribuzione esponenziale inversa: rand^2 sposta verso il basso
                // Per 50000 la prob è ~1% relativa alla fascia 2
                const t2 = cfg.CREDITS.TIER2;
                const range = t2.max - t2.min; // 34999
                // bias forte verso il basso: Math.random()^3 → valori concentrati vicini a min
                const biased = Math.pow(Math.random(), 3);
                amount = Math.floor(t2.min + biased * range);
            }
            return { category: 'credits', credits: amount };
        }

        if (category === 'ammo') {
            const ammoType = cfg.AMMO_TYPES[Math.floor(Math.random() * cfg.AMMO_TYPES.length)];
            const qty = cfg.AMMO_MIN + Math.floor(Math.random() * (cfg.AMMO_MAX - cfg.AMMO_MIN + 1));
            return { category: 'ammo', ammoType, quantity: qty };
        }

        if (category === 'missiles') {
            const missileType = cfg.MISSILE_TYPES[Math.floor(Math.random() * cfg.MISSILE_TYPES.length)];
            const qty = cfg.MISSILE_MIN + Math.floor(Math.random() * (cfg.MISSILE_MAX - cfg.MISSILE_MIN + 1));
            return { category: 'missiles', missileType, quantity: qty };
        }

        // special: emp o mine
        const specialType = cfg.SPECIAL_TYPES[Math.floor(Math.random() * cfg.SPECIAL_TYPES.length)];
        const qty = cfg.SPECIAL_MIN + Math.floor(Math.random() * (cfg.SPECIAL_MAX - cfg.SPECIAL_MIN + 1));
        return { category: 'special', specialType, quantity: qty };
    }

    // ── Helper: spawna una nuova Cargo Box in posizione casuale ─────────
    function spawnCargoBox(map) {
        const MAP_RADIUS = 9000;
        const BASE_EXCLUSION = 1800;
        let x, y, attempts = 0, tooClose;
        do {
            const angle = Math.random() * Math.PI * 2;
            const dist  = 1500 + Math.random() * (MAP_RADIUS - 1500);
            x = Math.cos(angle) * dist;
            y = Math.sin(angle) * dist;
            tooClose = false;
            for (const f in bases) {
                if (Math.hypot(x - bases[f].x, y - bases[f].y) < BASE_EXCLUSION) { tooClose = true; break; }
            }
            attempts++;
        } while (tooClose && attempts < 15);

        if (tooClose) return null;

        const loot = generateCargoBoxLoot();
        const box = {
            id:   getNextId(),
            x, y,
            radius: 18,
            loot,
            age:  0,
            collected: false
        };
        map.cargoBoxes.set(box.id, box);
        return box;
    }

    setInterval(() => {
        try {
            const now = Date.now() / 1000;
            for (const mapName in maps) {
                const map = maps[mapName];
                if (!map.mines) map.mines = new Map();

                // ── 0. EMP invulnerabilità tick + regen scudo + tick debuff slow ─
                map.players.forEach(p => {
                    // EMP timer
                    if (p.empInvulnerable && p.empInvulnTimer > 0) {
                        p.empInvulnTimer -= DELTA_TIME;
                        if (p.empInvulnTimer <= 0) {
                            p.empInvulnerable = false;
                            p.empInvulnTimer = 0;
                            if (p.ws && p.ws.readyState === WebSocket.OPEN)
                                p.ws.send(JSON.stringify({ type: 'empInvulnEnd' }));
                        }
                    }
                    // ── Debuff rallentamento — tick server-side ───────────
                    if (p.slowDebuffTimer > 0) {
                        p.slowDebuffTimer -= DELTA_TIME;
                        if (p.slowDebuffTimer <= 0) {
                            p.slowDebuffTimer = 0;
                            p.slowDebuffColor = null;
                            p.slowPct = 0;
                            // Notifica client locale che il debuff è finito
                            if (p.ws && p.ws.readyState === WebSocket.OPEN)
                                p.ws.send(JSON.stringify({ type: 'debuffEnd' }));
                            // Broadcast animEvent a tutti: debuff terminato
                            const debuffEndEvt = JSON.stringify({
                                type: 'animEvent', kind: 'debuffEnd',
                                targetId: p.username, targetType: 'player'
                            });
                            map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(debuffEndEvt); });
                        }
                    }
                    // ── Regen HP + Scudo server-side — identici per player reali E bot ──
                    // Stessa logica, stessi timer, stessi rate: nessuna distinzione isBot.
                    if (!p.isDead) {
                        if (!p.lastDamageTime) p.lastDamageTime = 0;
                        const secSinceDmg = now - p.lastDamageTime;

                        // Regen HP: 2%/s dopo 15s senza danno ricevuto
                        if (p.maxHp > 0 && (p.hp || 0) < p.maxHp && secSinceDmg > 15) {
                            p.hp = Math.min(p.maxHp, (p.hp || 0) + p.maxHp * 0.02 * DELTA_TIME);
                            p.isRegenerating = true;
                        } else {
                            p.isRegenerating = false;
                        }

                        // Regen Scudo: 8%/s dopo 10s senza danno ricevuto
                        if (p.maxShield > 0 && (p.shield || 0) < p.maxShield && secSinceDmg > 10) {
                            p.shield = Math.min(p.maxShield, (p.shield || 0) + p.maxShield * 0.08 * DELTA_TIME);
                            p.isShieldRegen = true;
                        } else {
                            p.isShieldRegen = false;
                        }
                    }
                });

                // ── 1. Proiettili ─────────────────────────────────────────
                map.projectiles.forEach((p, id) => {
                    const steps = 4;
                    if (p.targetId) {
                        const targetEnt = map.players.get(p.targetId) || map.enemies.get(p.targetId);
                        if (targetEnt) p.angle = Math.atan2(targetEnt.y - p.y, targetEnt.x - p.x);
                    }
                    const stepX = (Math.cos(p.angle) * p.speed * DELTA_TIME) / steps;
                    const stepY = (Math.sin(p.angle) * p.speed * DELTA_TIME) / steps;
                    p.age += DELTA_TIME;
                    let hit = false;

                    for (let step = 0; step < steps && !hit; step++) {
                        p.x += stepX; p.y += stepY;

                        if (p.isPlayerOwned) {
                            // Colpisce nemici — logica scudo 80/20
                            for (let [eId, e] of map.enemies) {
                                if (!circleIntersect(p, e)) continue;
                                if (p.sabPct && p.sabPct > 0) {
                                    // SAB: ruba scudo al nemico. Se il nemico non ha scudo → 0 effetto, munizione sprecata.
                                    const enemyShield = e.shield || 0;
                                    const stolenShield = Math.floor(enemyShield * p.sabPct);
                                    if (stolenShield > 0) {
                                        // Rimuovi scudo dal nemico
                                        e.shield = Math.max(0, enemyShield - stolenShield);
                                        // Cura lo scudo dello sparatore
                                        const shooter = map.players.get(p.ownerId);
                                        if (shooter) {
                                            const oldShield = shooter.shield || 0;
                                            shooter.shield = Math.min(shooter.maxShield || 0, oldShield + stolenShield);
                                            const actualHeal = shooter.shield - oldShield;
                                            if (actualHeal > 0 && shooter.ws && shooter.ws.readyState === 1)
                                                shooter.ws.send(JSON.stringify({ type: 'sabHeal', amount: actualHeal }));
                                        }
                                        // Effetto visivo: colore verde sul nemico (scudo rubato)
                                        const sabEvt = JSON.stringify({
                                            type: 'animEvent', kind: 'shieldHit',
                                            targetId: e.id, targetType: 'enemy',
                                            x: p.x, y: p.y, color: '#22c55e', damage: stolenShield, isCrit: false
                                        });
                                        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(sabEvt); });
                                    }
                                    // Nessun danno HP — le SAB non fanno danni, solo rubano scudo
                                    hit = true; break;
                                }
                                // Scudo 80/20: 80% del danno colpisce lo scudo, 20% gli HP
                                const shieldPart = Math.floor(p.damage * 0.8);
                                const hpPart     = p.damage - shieldPart;
                                const hadShieldBeforeHit = (e.shield || 0) > 0; // cattura PRIMA della modifica
                                if ((e.shield || 0) > 0) {
                                    const absorbed = Math.min(e.shield, shieldPart);
                                    const overflow = shieldPart - absorbed;
                                    e.shield = Math.max(0, e.shield - shieldPart);
                                    e.hp -= hpPart + overflow;
                                } else {
                                    e.hp -= p.damage;
                                }
                                hit = true;
                                const dmgMsg = JSON.stringify({ type: 'damageTaken', targetId: e.id, amount: p.damage, isLaser: !p.isMissile, laserColor: p.color, hitX: p.x, hitY: p.y });
                                // amount = danno TOTALE del colpo (scudo+hp), non solo hp
                                map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(dmgMsg); });

                                // Fuga da torretta o aggro
                                if (p.ownerId === 'BASE_TURRET') {
                                    const fleeAngle = Math.atan2(e.y - p.y, e.x - p.x);
                                    e.fleeMode = true; e.fleeAngle = fleeAngle; e.fleeTimer = 4.0; e.target = null;
                                    if (e.groupId) map.enemies.forEach(oe => { if (oe.groupId === e.groupId) { oe.fleeMode=true; oe.fleeAngle=fleeAngle; oe.fleeTimer=4.0; oe.target=null; } });
                                } else if (!e.target) {
                                    e.target = p.ownerId;
                                    if (e.groupId) map.enemies.forEach(oe => { if (oe.groupId === e.groupId && !oe.target) oe.target = p.ownerId; });
                                }

                                // ── animEvent broadcast globale (scudo/hull separati) ─
                                const isShieldHit = hadShieldBeforeHit; // usa il flag catturato prima
                                const animEvt = JSON.stringify({
                                    type: 'animEvent',
                                    kind: isShieldHit ? 'shieldHit' : 'hullHit',
                                    targetId: e.id,
                                    targetType: 'enemy',
                                    x: p.x, y: p.y,
                                    color: isShieldHit ? '#38bdf8' : (p.color || '#f97316'),
                                    damage: p.damage,
                                    isCrit: false
                                });
                                map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(animEvt); });

                                if (e.hp <= 0) {
                                    // ── Board Log: only bosses (isBoss flag in config) ──
                                    const enemyTypeDef = ENEMY_TYPES[e.type];
                                    if (enemyTypeDef && enemyTypeDef.isBoss && p.ownerId !== 'BASE_TURRET') {
                                        const killerOwner = map.players.get(p.ownerId);
                                        const bossName = e.type.charAt(0).toUpperCase() + e.type.slice(1);
                                        if (killerOwner) {
                                            const party = killerOwner.partyId ? require('./partyHandler').parties.get(killerOwner.partyId) : null;
                                            if (party) {
                                                broadcastBoardLog(`Party ${party.name} defeated boss ${bossName}!`, '#facc15', { eventType: 'boss', killerFaction: killerOwner.faction });
                                            } else {
                                                broadcastBoardLog(`${killerOwner.username} defeated boss ${bossName}!`, '#facc15', { eventType: 'boss', killerFaction: killerOwner.faction });
                                            }
                                        }
                                    }
                                    if (p.ownerId !== 'BASE_TURRET') {
                                        const owner = map.players.get(p.ownerId);
                                        if (owner) {
                                            const td = ENEMY_TYPES[e.type];
                                            const partyShared = owner.partyId ? handlePartyReward(owner.partyId, td.reward, map, td.exp || 0) : false;
                                            if (!partyShared) {
                                                addCredits(owner, td.reward);
                                                if (owner.ws) owner.ws.send(JSON.stringify({ type: 'reward', credits: td.reward }));
                                                owner.score += Math.floor(td.reward / 10);
                                                owner.kills += 1;
                                                owner.alienKills = (owner.alienKills || 0) + 1;
                                                                // ── EXP pilota: stessa logica per bot e player reali ──
                                                addPilotExp(owner, td.exp || 0);
                                                sendPlayerStats(owner); persistPlayerMeta(owner); broadcastLeaderboard();
                                                // ── Auto-assegna skill points ai bot dopo level-up ──
                                                if (owner.isBot) {
                                                    const botRef = botList.find(b => b.username === owner.username);
                                                    if (botRef) {
                                                        botRef.pilotLevel  = owner.pilotLevel;
                                                        botRef.pilotExp    = owner.pilotExp;
                                                        botRef.skillPoints = owner.skillPoints;
                                                        botAutoAssignSkillPoints(botRef);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    // ── Genera loot ──
                                    const lootTable = ENEMY_LOOT[e.type] || [];
                                    lootTable.forEach(entry => {
                                        if (Math.random() > entry.chance) return;
                                        const qty = Math.floor(entry.minQty + Math.random() * (entry.maxQty - entry.minQty + 1));
                                        if (qty <= 0) return;
                                        const itemDef = LOOT_ITEMS[entry.itemId];
                                        if (!itemDef) return;
                                        const angle = Math.random() * Math.PI * 2;
                                        const dist  = 20 + Math.random() * 60;
                                        const res = {
                                            id: getNextId(),
                                            x: e.x + Math.cos(angle) * dist,
                                            y: e.y + Math.sin(angle) * dist,
                                            resType: entry.itemId,
                                            itemName: itemDef.name,
                                            rarity: itemDef.rarity,
                                            isRare: !!itemDef.isRare,
                                            color: itemDef.color,
                                            value: itemDef.value,
                                            quantity: qty,
                                            age: 0,
                                            vx: Math.cos(angle) * (40 + Math.random() * 80),
                                            vy: Math.sin(angle) * (40 + Math.random() * 80),
                                            radius: itemDef.isRare ? 12 : 8
                                        };
                                        map.resources.set(res.id, res);
                                    });
                                    map.enemies.delete(eId);
                                }
                                break;
                            }

                            // PvP
                            if (!hit) {
                                for (let [pId, pl] of map.players) {
                                    const isTurretShot = p.ownerId === 'BASE_TURRET';
                                    if (!isTurretShot && pId === p.ownerId) continue;
                                    if (isTurretShot && p.ownerFaction === pl.faction) continue;
                                    // ── FRIENDLY FIRE OFF: laser attraversa compagni di fazione ──
                                    if (!isTurretShot) {
                                        const attFaction = map.players.get(p.ownerId)?.faction;
                                        if (attFaction && pl.faction === attFaction) continue;
                                    }
                                    const expandedHitbox = { x: pl.x, y: pl.y, radius: (pl.radius || 20) + 60 };
                                    if (!circleIntersect(p, expandedHitbox)) continue;
                                    const attacker = map.players.get(p.ownerId);
                                    let canPvP = false;
                                    if (isTurretShot) {
                                        canPvP = p.ownerFaction && pl.faction !== p.ownerFaction;
                                    } else if (attacker && attacker.faction !== pl.faction) {
                                        canPvP = true;
                                    }
                                    if (!isTurretShot && attacker) {
                                        const dAtk = Math.hypot(attacker.x - bases[attacker.faction].x, attacker.y - bases[attacker.faction].y);
                                        const dTgt = Math.hypot(pl.x - bases[pl.faction].x, pl.y - bases[pl.faction].y);
                                        if (dAtk < 1000 || dTgt < 1000) canPvP = false;
                                    } else if (!isTurretShot && !attacker) canPvP = false;

                                    if (canPvP) {
                                        if (pl.empInvulnerable) { hit = true; break; }
                                        const pvpShieldHit = (pl.shield || 0) > 0; // cattura PRIMA del danno
                                        // Applica stessa logica 80/20 del PvE
                                        const pvpShieldPart = Math.floor(p.damage * 0.8);
                                        const pvpHpPart     = p.damage - pvpShieldPart;
                                        let pvpFinalHpDmg   = pvpHpPart;
                                        if (pvpShieldHit) {
                                            const absorbed = Math.min(pl.shield, pvpShieldPart);
                                            const overflow = pvpShieldPart - absorbed;
                                            pl.shield = Math.max(0, pl.shield - pvpShieldPart);
                                            pvpFinalHpDmg += overflow;
                                        } else {
                                            pvpFinalHpDmg += pvpShieldPart;
                                        }
                                        const pvpAnimEvt = JSON.stringify({
                                            type: 'animEvent',
                                            kind: pvpShieldHit ? 'shieldHit' : 'hullHit',
                                            targetId: pId, targetType: 'player',
                                            x: p.x, y: p.y,
                                            color: pvpShieldHit ? '#38bdf8' : (p.color || '#f97316'),
                                            damage: p.damage, isCrit: false  // danno TOTALE del colpo
                                        });
                                        map.players.forEach(pAll => { if (pAll.ws && pAll.ws.readyState === WebSocket.OPEN) pAll.ws.send(pvpAnimEvt); });
                                        const dmgMsg = JSON.stringify({ type: 'damageTaken', targetId: pId, amount: p.damage, isLaser: !p.isMissile, laserColor: p.color, hitX: p.x, hitY: p.y }); // danno TOTALE
                                        map.players.forEach(pAll => { if (pAll.ws && pAll.ws.readyState === WebSocket.OPEN) pAll.ws.send(dmgMsg); });
                                        pl.hp -= pvpFinalHpDmg;
                                        pl.lastDamageTime = now; // reset timer regen scudo
                                        if (pl.hp <= 0) {
                                            const deathMsg = JSON.stringify({ type: 'playerDied', targetId: pId, killerId: p.ownerId });
                                            map.players.forEach(pAll => { if (pAll.ws && pAll.ws.readyState === WebSocket.OPEN) pAll.ws.send(deathMsg); });
                                            const atk = map.players.get(p.ownerId);
                                            if (atk) {
                                                addCredits(atk,5000);
                                                if(atk.ws) atk.ws.send(JSON.stringify({type:'reward',credits:5000}));
                                                atk.score+=1000;
                                                atk.kills+=1;
                                                atk.playerKills = (atk.playerKills || 0) + 1;
                                                sendPlayerStats(atk); persistPlayerMeta(atk);
                                                // ── Board Log kill PvP ──
                                                broadcastBoardLog(`${atk.username} killed ${pl.username}`, '#f87171', { eventType: 'kill', killerFaction: atk.faction, victimFaction: pl.faction });
                                            }
                                            handlePlayerDeath(pl);
                                        }
                                    }
                                    hit = true; break;
                                }
                            }
                        } else {
                            // Proiettili nemici → player
                            for (let [pId, pl] of map.players) {
                                if (!circleIntersect(p, pl)) continue;
                                if (pl.empInvulnerable) { hit = true; break; }
                                const shieldPart = Math.floor(p.damage * 0.8);
                                const hpPart     = p.damage - shieldPart;
                                let hpDamage = hpPart;
                                const npcShieldHit = (pl.shield || 0) > 0; // cattura PRIMA della modifica
                                if ((pl.shield || 0) > 0) {
                                    const absorbed = Math.min(pl.shield, shieldPart);
                                    const overflow = shieldPart - absorbed;
                                    pl.shield = Math.max(0, pl.shield - shieldPart);
                                    hpDamage += overflow;
                                } else {
                                    hpDamage += shieldPart;
                                }
                                pl.hp -= hpDamage;
                                pl.lastDamageTime = now; // reset timer regen scudo
                                // Broadcast animEvent
                                const npcAnimEvt = JSON.stringify({
                                    type: 'animEvent',
                                    kind: npcShieldHit ? 'shieldHit' : 'hullHit',
                                    targetId: pl.username,
                                    targetType: 'player',
                                    x: p.x, y: p.y,
                                    color: npcShieldHit ? '#38bdf8' : (p.color || '#ff4444'),
                                    damage: p.damage, // danno TOTALE del colpo
                                    isCrit: !!p.isCrit
                                });
                                map.players.forEach(pAll => { if (pAll.ws && pAll.ws.readyState === WebSocket.OPEN) pAll.ws.send(npcAnimEvt); });
                                if (pl.ws) pl.ws.send(JSON.stringify({ type: 'damageTaken', amount: p.damage, isLaser: !p.isMissile, laserColor: p.color, hitX: p.x, hitY: p.y, isCrit: p.isCrit })); // danno TOTALE
                                // ── specialAttack slow dal proiettile nemico ──────
                                if (p.specialSlow && p.specialSlow.slowPct > 0) {
                                    applySlowDebuff(map, pl, p.specialSlow.slowPct, p.specialSlow.duration, p.specialSlow.color);
                                }
                                if (pl.hp <= 0) {
                                    pl.hp = 0;
                                    const deathMsg = JSON.stringify({ type: 'playerDied', targetId: pId });
                                    map.players.forEach(pAll => { if (pAll.ws && pAll.ws.readyState === WebSocket.OPEN) pAll.ws.send(deathMsg); });
                                    handlePlayerDeath(pl);
                                }
                                hit = true; break;
                            }
                        }
                    }
                    if (hit || p.age > p.life) map.projectiles.delete(id);
                });

                // ── 2. Spawn nemici ─────────────────
                if (map.enemies.size < 80 && Math.random() < 0.2) {
                    const MAP_RADIUS = 9500;
                    const BASE_EXCLUSION_RADIUS = 1500;
                    let spawnX, spawnY, attempts = 0, tooClose;
                    let distCenter, minDistBase;
                    do {
                        const angle = Math.random() * Math.PI * 2;
                        distCenter = Math.sqrt(Math.random()) * MAP_RADIUS;
                        spawnX = Math.cos(angle) * distCenter;
                        spawnY = Math.sin(angle) * distCenter;
                        tooClose = false;
                        minDistBase = Infinity;
                        for (const f in bases) {
                            const b = bases[f];
                            const d = Math.hypot(spawnX - b.x, spawnY - b.y);
                            if (d < minDistBase) minDistBase = d;
                            if (d < BASE_EXCLUSION_RADIUS) tooClose = true;
                        }
                        attempts++;
                    } while (tooClose && attempts < 10);

                    if (!tooClose) {
                        let pool = [];
                        if (minDistBase < 4000) pool = ['lordakia', 'saimon', 'mordon'];
                        else if (distCenter < 3500) pool = ['kristallon', 'cubikon', 'annihilator', 'drone'];
                        else if (distCenter > 7500) pool = ['barracuda', 'uber_lordakia', 'kristallin', 'sibelon'];
                        else pool = ['sibelon', 'kristallin', 'interceptor', 'phantom'];
                        
                        let totalRarity = 0;
                        for (let t of pool) totalRarity += ENEMY_TYPES[t].rarity;
                        let rand = Math.random() * totalRarity; 
                        let cum = 0;
                        let selectedType = pool[0];
                        for (let t of pool) { 
                            cum += ENEMY_TYPES[t].rarity; 
                            if (rand <= cum) { selectedType = t; break; } 
                        }
                        const eData = ENEMY_TYPES[selectedType];
                        const eMaxShield = Math.floor(eData.hp * 0.5);
                        const e = {
                            id: getNextId(), type: selectedType, x: spawnX, y: spawnY,
                            hp: eData.hp, maxHp: eData.hp, shield: eMaxShield, maxShield: eMaxShield,
                            radius: eData.radius, speed: eData.speed, damage: eData.damage,
                            angle: 0, target: null, lastAttack: 0, color: eData.color || '#ff0000',
                            aggroRange: eData.aggroRange || 1000, attackType: eData.attackType || 'melee',
                            optimalDist: eData.optimalDist || (eData.radius+40), fireRate: eData.fireRate || 1.0,
                            projectileSpeed: eData.projectileSpeed || 800,
                            projectileColor: eData.projectileColor || '#ff0000',
                            projectileThickness: eData.projectileThickness || 3,
                            groupId: null, groupLeader: false
                        };
                        map.enemies.set(e.id, e);
                    }
                }

                // ── 3. Flocking ───────────────────────────────────
                map.enemies.forEach((e, id) => {
                    if (e.groupId || e.type === 'cubikon' || e.speed <= 30) return;
                    if (Math.random() >= 0.05) return;
                    for (let [otherId, otherE] of map.enemies) {
                        if (otherId === id || otherE.type !== e.type) continue;
                        const dSq = (e.x-otherE.x)**2 + (e.y-otherE.y)**2;
                        if (dSq >= 250000) continue;
                        if (otherE.groupId) {
                            let count = 0;
                            map.enemies.forEach(gE => { if (gE.groupId === otherE.groupId) count++; });
                            if (count < 8 && Math.random() < 0.25) { e.groupId = otherE.groupId; break; }
                        } else {
                            e.groupId = getNextId(); e.groupLeader = true; otherE.groupId = e.groupId; break;
                        }
                    }
                });

                // ── 3b. CUBIKON — skill apertura: spawna cubini ───────────────────
                map.enemies.forEach((e) => {
                    if (e.type !== 'cubikon') return;

                    // Inizializza i timestamp la prima volta (usare now, non 0!)
                    if (!e.spawnTime)       e.spawnTime       = now;
                    if (!e.lastSpawnSkill)  e.lastSpawnSkill  = now; // parte da now → cooldown parte subito

                    // Conta cubini vivi legati a questo cubikon
                    let aliveCubicles = 0;
                    map.enemies.forEach(c => { if (c.type === 'cubicle' && c.parentId === e.id) aliveCubicles++; });
                    if (aliveCubicles > 0) return; // aspetta che muoiano tutti

                    const skillDef = ENEMY_TYPES['cubikon'].spawnSkill;

                    // Prima attivazione: aspetta almeno 20s dallo spawn
                    if ((now - e.spawnTime) < 20) return;

                    // Cooldown tra un'ondata e la successiva
                    if ((now - e.lastSpawnSkill) < skillDef.cooldown) return;

                    // ── ATTIVA la skill ──────────────────────────────────
                    e.lastSpawnSkill = now;
                    const count = skillDef.minCount + Math.floor(Math.random() * (skillDef.maxCount - skillDef.minCount + 1));

                    const openEvt = JSON.stringify({ type: 'cubikonOpen', x: e.x, y: e.y, count });
                    map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(openEvt); });

                    for (let i = 0; i < count; i++) {
                        const spawnAngle  = (i / count) * Math.PI * 2 + Math.random() * 0.4;
                        const spawnDist   = e.radius + 30 + Math.random() * 40;
                        const cubicleData = ENEMY_TYPES['cubicle'];
                        const cubicle = {
                            id: getNextId(), type: 'cubicle', parentId: e.id,
                            x: e.x + Math.cos(spawnAngle) * spawnDist,
                            y: e.y + Math.sin(spawnAngle) * spawnDist,
                            hp: cubicleData.hp, maxHp: cubicleData.hp,
                            shield: 0, maxShield: 0,
                            radius: cubicleData.radius, speed: cubicleData.speed,
                            damage: 150 + Math.floor(Math.random() * 101),
                            angle: spawnAngle, target: null, lastAttack: 0,
                            color: cubicleData.color, aggroRange: cubicleData.aggroRange,
                            attackType: 'melee', optimalDist: cubicleData.optimalDist,
                            groupId: null, groupLeader: false
                        };
                        map.enemies.set(cubicle.id, cubicle);
                    }
                    console.log(`[CUBIKON] Apertura! ${count} cubini da cubikon ${e.id}`);
                });
                let aiTickCounter = Math.floor(now * 20);
                map.enemies.forEach((e, id) => {
                    // ── AI CUBICLE: difende il cubikon, attacca chiunque ──
                    if (e.type === 'cubicle') {
                        // Target: eredita da genitore, altrimenti il player più vicino
                        if (!e.target || !map.players.has(e.target) || map.players.get(e.target)?.isDead) {
                            const parent = e.parentId ? map.enemies.get(e.parentId) : null;
                            if (parent && parent.target && map.players.has(parent.target)) {
                                e.target = parent.target;
                            } else {
                                let closest = null; let minDSq = e.aggroRange * e.aggroRange;
                                map.players.forEach(p => {
                                    if (p.isDead) return;
                                    const dSq = (p.x-e.x)**2 + (p.y-e.y)**2;
                                    if (dSq < minDSq) { minDSq = dSq; closest = p.username; }
                                });
                                e.target = closest;
                            }
                        }
                        if (e.target && map.players.has(e.target)) {
                            const p = map.players.get(e.target);
                            const dx = p.x - e.x; const dy = p.y - e.y;
                            const dist = Math.hypot(dx, dy);
                            e.angle = Math.atan2(dy, dx);
                            if (dist > e.optimalDist + e.radius + (p.radius || 20)) {
                                e.x += (dx / dist) * e.speed * DELTA_TIME;
                                e.y += (dy / dist) * e.speed * DELTA_TIME;
                            }
                            // Melee hit ogni 0.8s a contatto
                            if (dist <= e.optimalDist + e.radius + (p.radius || 20) + 10 && now - e.lastAttack > 0.8) {
                                e.lastAttack = now;
                                const dmg = e.damage;
                                const shPart = Math.floor(dmg * 0.8);
                                let hpDmg = dmg - shPart;
                                if ((p.shield || 0) > 0) {
                                    const abs = Math.min(p.shield, shPart);
                                    p.shield = Math.max(0, p.shield - shPart);
                                    hpDmg += shPart - abs;
                                } else { hpDmg += shPart; }
                                p.hp -= hpDmg;
                                p.lastDamageTime = now;
                                if (p.ws) p.ws.send(JSON.stringify({ type: 'damageTaken', amount: dmg }));
                                const cEvt = JSON.stringify({ type: 'animEvent', kind: 'hullHit', targetId: p.username, targetType: 'player', x: e.x, y: e.y, color: '#a5f3fc', damage: dmg, isCrit: false });
                                map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(cEvt); });
                                if (p.hp <= 0) { p.hp = 0; handlePlayerDeath(p); }
                            }
                        } else {
                            // Orbita attorno al genitore se nessun target
                            const parent = e.parentId ? map.enemies.get(e.parentId) : null;
                            if (parent) {
                                const dx = parent.x - e.x; const dy = parent.y - e.y;
                                const dist = Math.hypot(dx, dy);
                                if (dist > parent.radius + 80) {
                                    e.x += (dx / dist) * e.speed * 0.4 * DELTA_TIME;
                                    e.y += (dy / dist) * e.speed * 0.4 * DELTA_TIME;
                                }
                            }
                        }
                        return; // skip AI generica
                    }
                    let shouldThink = ((id + aiTickCounter) % 4 === 0);
                    if (shouldThink) {
                        let currentTarget = map.players.get(e.target);
                        if (currentTarget && currentTarget.hp <= 0) { e.target = null; currentTarget = null; }
                        if (currentTarget && Math.hypot(currentTarget.x-e.x, currentTarget.y-e.y) > e.aggroRange * 1.5) { e.target = null; currentTarget = null; }
                        if (!e.target && e.aggroRange > 0) {
                            let closest = null; let minDistSq = e.aggroRange * e.aggroRange;
                            map.players.forEach(p => { 
                                if (p.isDead) return; 
                                const dSq = (p.x-e.x)**2 + (p.y-e.y)**2; 
                                if (dSq < minDistSq) { minDistSq = dSq; closest = p.username; } 
                            });
                            e.target = closest;
                        }
                    }
                    let moveX = 0; let moveY = 0;
                    if (e.fleeMode && e.fleeTimer > 0) {
                        e.fleeTimer -= DELTA_TIME;
                        if (e.fleeTimer <= 0) { e.fleeMode = false; e.fleeAngle = undefined; e.target = null; }
                        else {
                            const fleeSpeed = e.speed * 1.4;
                            e.x += Math.cos(e.fleeAngle) * fleeSpeed * DELTA_TIME;
                            e.y += Math.sin(e.fleeAngle) * fleeSpeed * DELTA_TIME;
                            e.angle = e.fleeAngle;
                            const fd = Math.hypot(e.x, e.y);
                            if (fd > 9800) { e.x *= 9800/fd; e.y *= 9800/fd; }
                            return;
                        }
                    }
                    if (e.type === 'drone') {
                        let pTarget = null;
                        if (e.target && map.players.has(e.target)) pTarget = map.players.get(e.target);
                        let currentSpeed = 350 + (e.hp / e.maxHp) * 100;
                        if (pTarget) {
                            const dx = e.x - pTarget.x; const dy = e.y - pTarget.y;
                            e.angle = Math.atan2(dy, dx);
                            moveX += Math.cos(e.angle) * currentSpeed; moveY += Math.sin(e.angle) * currentSpeed;
                            if (Math.random() < 0.02) {
                                const mineId = getNextId();
                                map.mines.set(mineId, {
                                    id: mineId, x: e.x, y: e.y, ownerId: e.id,
                                    def: { damage: 500, triggerRadius: 70, color: '#facc15', slowPct: 0.35 + Math.random() * 0.50, slowDuration: 8 + Math.random() * 7 },
                                    age: 0, mineType: 'drone-slow'
                                });
                            }
                        } else {
                            if (!e.patrolTimer) e.patrolTimer = 0;
                            e.patrolTimer -= DELTA_TIME;
                            if (e.patrolTimer <= 0) { e.patrolTimer = 1 + Math.random() * 2; e.patrolAngle = Math.random() * Math.PI * 2; }
                            moveX += Math.cos(e.patrolAngle) * currentSpeed * 0.4; moveY += Math.sin(e.patrolAngle) * currentSpeed * 0.4;
                        }
                    } else if (!e.fleeMode) {
                        if (e.target && map.players.has(e.target)) {
                            const p = map.players.get(e.target);
                            const dx = p.x-e.x; const dy = p.y-e.y;
                            const dist = Math.hypot(dx, dy); e.angle = Math.atan2(dy, dx);
                            const eData = ENEMY_TYPES[e.type];
                            const optDist = eData.optimalDist || (e.radius+p.radius+10);
                            // Per i melee aumenta la distanza di stop: non devono "entrare sotto" la nave
                            const effectiveOptDist = eData.attackType === 'melee'
                                ? Math.max(optDist, e.radius + (p.radius || 20) + 55)
                                : optDist;
                            if (dist > effectiveOptDist && dist > 0.001) { moveX += (dx/dist)*e.speed; moveY += (dy/dist)*e.speed; }
                            else if (eData.attackType !== 'melee' && dist < optDist-60 && dist > 0.001) { moveX -= (dx/dist)*e.speed*0.6; moveY -= (dy/dist)*e.speed*0.6; }
                            if (eData.orbit && dist < optDist+40) { moveX += Math.cos(e.angle+Math.PI/2)*e.speed*0.8; moveY += Math.sin(e.angle+Math.PI/2)*e.speed*0.8; }
                            if (dist <= effectiveOptDist+50 && now - e.lastAttack > (eData.fireRate||1.0)) {
                                if (eData.attackType === 'laser' || eData.attackType === 'missile') {
                                    const isCrit = Math.random() < 0.05;
                                    const baseDamage = Math.floor(e.damage * (0.8 + Math.random() * 0.4));
                                    const finalDamage = isCrit ? baseDamage * 2 : baseDamage;
                                    // Calcola specialSlow da includere nel proiettile
                                    let specialSlow = null;
                                    if (eData.specialAttack && Math.random() < eData.specialAttack.chance) {
                                        const sa = eData.specialAttack;
                                        const sp = Array.isArray(sa.slowPct) ? sa.slowPct[0] + Math.random()*(sa.slowPct[1]-sa.slowPct[0]) : sa.slowPct;
                                        const du = Array.isArray(sa.duration) ? sa.duration[0] + Math.random()*(sa.duration[1]-sa.duration[0]) : sa.duration;
                                        specialSlow = { slowPct: sp, duration: du, color: e.color || '#a855f7' };
                                    }
                                    const proj = {
                                        id: getNextId(), x: e.x, y: e.y, angle: e.angle, speed: eData.projectileSpeed||800, damage: finalDamage,
                                        isPlayerOwned: false, ownerId: e.id,
                                        color: isCrit ? '#ffcc00' : (eData.projectileColor||'#ff0000'), thickness: isCrit ? (eData.projectileThickness||3)*2 : (eData.projectileThickness||3),
                                        life: eData.attackType==='missile'?2.8:2.0, age:0, radius: eData.attackType==='missile'?6:4, targetId: p.username, isCrit: isCrit,
                                        specialSlow
                                    };
                                    map.projectiles.set(proj.id, proj);
                                } else {
                                    const isCrit = Math.random() < 0.05;
                                    const baseDamage = Math.floor(e.damage * (0.8 + Math.random() * 0.4));
                                    const finalDamage = isCrit ? baseDamage * 2 : baseDamage;
                                    p.hp -= finalDamage;
                                    if (p.ws) p.ws.send(JSON.stringify({ type: 'damageTaken', amount: finalDamage, isCrit: isCrit }));
                                    if (p.hp <= 0) { p.hp = 0; handlePlayerDeath(p); }
                                }
                                // ── Attacco speciale: slow (melee e laser/missile) ──
                                const eData2 = ENEMY_TYPES[e.type];
                                if (eData2.specialAttack && Math.random() < eData2.specialAttack.chance) {
                                    const sa = eData2.specialAttack;
                                    const slowPctVal = Array.isArray(sa.slowPct)
                                        ? sa.slowPct[0] + Math.random() * (sa.slowPct[1] - sa.slowPct[0])
                                        : sa.slowPct;
                                    const durVal = Array.isArray(sa.duration)
                                        ? sa.duration[0] + Math.random() * (sa.duration[1] - sa.duration[0])
                                        : sa.duration;
                                    applySlowDebuff(map, p, slowPctVal, durVal, e.color || '#a855f7');
                                }
                                e.lastAttack = now;
                            }
                        } else {
                            if (!e.patrolTimer) e.patrolTimer = 0;
                            e.patrolTimer -= DELTA_TIME;
                            if (e.patrolTimer <= 0) { e.patrolTimer = 2+Math.random()*3; e.patrolAngle = Math.random()*Math.PI*2; }
                            moveX += Math.cos(e.patrolAngle)*e.speed*0.3; moveY += Math.sin(e.patrolAngle)*e.speed*0.3;
                        }
                    }
                    map.enemies.forEach((oe, oid) => {
                        if (oid === id) return;
                        const dx = e.x-oe.x; const dy = e.y-oe.y;
                        const dSq = dx*dx + dy*dy; const minSep = e.radius+oe.radius+15;
                        if (dSq < minSep*minSep && dSq > 0.001) { 
                            const d = Math.sqrt(dSq);
                            const f=(minSep-d)/minSep; moveX+=(dx/d)*f*e.speed*1.5; moveY+=(dy/d)*f*e.speed*1.5; 
                        }
                    });
                    if (shouldThink) {
                        for (let f in bases) {
                            const b = bases[f];
                            const dSq = (e.x-b.x)**2 + (e.y-b.y)**2;
                            if (dSq < 1440000) {
                                const dBase = Math.sqrt(dSq); const push = (1200-dBase)/1200;
                                moveX += ((e.x-b.x)/dBase)*e.speed*2*push; moveY += ((e.y-b.y)/dBase)*e.speed*2*push; e.target = null;
                            }
                        }
                        e.vx = moveX; e.vy = moveY;
                    } else { moveX = e.vx || 0; moveY = e.vy || 0; }
                    if (moveX !== 0 || moveY !== 0) {
                        const cs = Math.hypot(moveX, moveY);
                        if (cs > e.speed*1.5) { moveX=(moveX/cs)*e.speed*1.5; moveY=(moveY/cs)*e.speed*1.5; }
                        e.x += moveX*DELTA_TIME; e.y += moveY*DELTA_TIME;
                        if (!e.target && cs > 10) e.angle = Math.atan2(moveY, moveX);
                    }
                });

                // ── 5. Torrette base ──────────────────────────────────────
                map.turrets.forEach(t => {
                    let closest = null; let minDistSq = t.range * t.range;
                    map.enemies.forEach(e => { const dSq=(e.x-t.x)**2+(e.y-t.y)**2; if(dSq<minDistSq){minDistSq=dSq;closest=e;} });
                    if (!closest) map.players.forEach(p => { if(p.faction!==t.faction){const dSq=(p.x-t.x)**2+(p.y-t.y)**2;if(dSq<minDistSq){minDistSq=dSq;closest=p;}} });
                    if (!closest) return;
                    t.angle = Math.atan2(closest.y-t.y, closest.x-t.x);
                    if (now - t.lastShot > t.fireRate) {
                        const proj = {
                            id: getNextId(), x: t.x, y: t.y, angle: t.angle, speed: 1500, damage: t.damage,
                            isPlayerOwned: true, ownerId: 'BASE_TURRET', ownerFaction: t.faction,
                            color: '#FF0000', thickness: 6, isTurretShot: true,
                            life: 2, age: 0, radius: 6, targetId: closest.username||closest.id
                        };
                        map.projectiles.set(proj.id, proj); t.lastShot = now;
                    }
                });

                // ── 6. Risorse / Loot ─────────────────────────────────────
                map.resources.forEach((r, id) => {
                    r.x += r.vx*DELTA_TIME; r.y += r.vy*DELTA_TIME;
                    r.vx *= 0.95; r.vy *= 0.95; r.age += DELTA_TIME;
                    for (let [, p] of map.players) {
                        if (!circleIntersect(r, {x:p.x,y:p.y,radius:p.radius+30})) continue;
                        const maxCargo = SHIP_CARGO[p.shipType] || p.maxCargo || 100;
                        const freeSpace = maxCargo - (p.cargo || 0);
                        if (freeSpace <= 0) continue;
                        const qty = r.quantity !== undefined ? r.quantity : r.value;
                        const taken = Math.min(freeSpace, qty);
                        const remaining = qty - taken;
                        if (!p.materials) p.materials = {};
                        p.materials[r.resType] = (p.materials[r.resType]||0) + taken;
                        p.cargo = Math.min(maxCargo, (p.cargo||0) + taken);
                        if (p.ws) p.ws.send(JSON.stringify({ type:'collectLoot', resType: r.resType, itemName: r.itemName || r.resType, rarity: r.rarity || 'common', isRare: !!r.isRare, color: r.color || '#ffffff', itemValue: r.value || 1, taken, remaining }));
                        sendPlayerStats(p); persistPlayerMeta(p);
                        if (remaining > 0) r.quantity = remaining; else map.resources.delete(id);
                        break;
                    }
                    if (r.age > 20) map.resources.delete(id);
                });

                // ── 7. Mine ───────────────────────────────────────────────
                map.mines.forEach((mine, mid) => {
                    mine.age += DELTA_TIME;
                    const explode = (dmg, x, y) => {
                        const expl = JSON.stringify({ type:'mineExplode', x, y, color: mine.def.color });
                        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState===1) pl.ws.send(expl); });
                        map.mines.delete(mid);
                    };
                    if (mine.age > 15) {
                        explode(mine.def.damage, mine.x, mine.y); return;
                    }
                    if (mine.triggered) return;
                    for (let [eid, e] of map.enemies) {
                        if (Math.hypot(e.x-mine.x, e.y-mine.y) > mine.triggerRadius) continue;
                        mine.triggered = true; e.hp -= mine.def.damage;
                        explode(mine.def.damage, mine.x, mine.y); return;
                    }
                    for (let [, p] of map.players) {
                        if (p.username === mine.ownerId) continue;
                        if (mine.ownerFaction && p.faction === mine.ownerFaction) continue;
                        if (Math.hypot(p.x-mine.x, p.y-mine.y) > mine.triggerRadius) continue;
                        mine.triggered = true; p.hp -= mine.def.damage;
                        if (p.ws) p.ws.send(JSON.stringify({ type:'damageTaken', amount: mine.def.damage }));
                        // ── Slow dalla mina: broadcast globale ───────────
                        if (mine.def.slowPct > 0 && mine.def.slowDuration > 0) {
                            applySlowDebuff(map, p, mine.def.slowPct, mine.def.slowDuration, mine.def.color || '#a855f7');
                        }
                        explode(mine.def.damage, mine.x, mine.y); return;
                    }
                });

                // ── 8. Cargo Box — spawn, lifetime, raccolta ─────────────
                if (!map.cargoBoxes) map.cargoBoxes = new Map();
                if (map.cargoBoxTimer === undefined) map.cargoBoxTimer = 0;

                // Tick timer spawn
                map.cargoBoxTimer -= DELTA_TIME;

                // Spawna nuove box se siamo sotto il massimo
                if (map.cargoBoxes.size < CARGO_BOX_CONFIG.MAX_PER_MAP && map.cargoBoxTimer <= 0) {
                    const newBox = spawnCargoBox(map);
                    if (newBox) {
                        // Notifica tutti i player della nuova box
                        const spawnEvt = JSON.stringify({ type: 'cargoBoxSpawned', box: { id: newBox.id, x: newBox.x, y: newBox.y, radius: newBox.radius } });
                        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(spawnEvt); });
                        console.log(`[CARGO BOX] Spawned id=${newBox.id} cat=${newBox.loot.category} at (${Math.round(newBox.x)},${Math.round(newBox.y)})`);
                    }
                    // Prossimo spawn tra RESPAWN_TIME / MAX secondi (distribuito)
                    map.cargoBoxTimer = CARGO_BOX_CONFIG.RESPAWN_TIME / CARGO_BOX_CONFIG.MAX_PER_MAP + Math.random() * 30;
                }

                // Tick box esistenti: lifetime + raccolta per prossimità
                map.cargoBoxes.forEach((box, bid) => {
                    box.age += DELTA_TIME;

                    // Scaduta per lifetime
                    if (box.age >= CARGO_BOX_CONFIG.BOX_LIFETIME) {
                        map.cargoBoxes.delete(bid);
                        const expEvt = JSON.stringify({ type: 'cargoBoxExpired', id: bid });
                        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(expEvt); });
                        return;
                    }

                    // Raccolta per prossimità
                    for (const [, p] of map.players) {
                        if (p.isDead) continue;
                        if (Math.hypot(p.x - box.x, p.y - box.y) > CARGO_BOX_CONFIG.COLLECT_RADIUS) continue;

                        // Applica il loot al player
                        const loot = box.loot;
                        let notifyData = { type: 'cargoBoxCollected', id: bid, category: loot.category };

                        if (loot.category === 'credits') {
                            addCredits(p, loot.credits);
                            notifyData.credits = loot.credits;
                            if (p.ws && p.ws.readyState === WebSocket.OPEN)
                                p.ws.send(JSON.stringify({ type: 'reward', credits: loot.credits, source: 'cargoBox' }));
                            sendPlayerStats(p); persistPlayerMeta(p);
                        } else if (loot.category === 'ammo') {
                            if (!p.ammo) p.ammo = {};
                            p.ammo[loot.ammoType] = (p.ammo[loot.ammoType] || 0) + loot.quantity;
                            notifyData.ammoType = loot.ammoType;
                            notifyData.quantity = loot.quantity;
                            persistPlayerMeta(p);
                        } else if (loot.category === 'missiles') {
                            if (!p.missileAmmo) p.missileAmmo = {};
                            p.missileAmmo[loot.missileType] = (p.missileAmmo[loot.missileType] || 0) + loot.quantity;
                            notifyData.missileType = loot.missileType;
                            notifyData.quantity = loot.quantity;
                            persistPlayerMeta(p);
                        } else if (loot.category === 'special') {
                            if (loot.specialType === 'emp') {
                                p.empAmmo = (p.empAmmo || 0) + loot.quantity;
                            } else {
                                if (!p.mineAmmo) p.mineAmmo = {};
                                p.mineAmmo[loot.specialType] = (p.mineAmmo[loot.specialType] || 0) + loot.quantity;
                            }
                            notifyData.specialType = loot.specialType;
                            notifyData.quantity = loot.quantity;
                            persistPlayerMeta(p);
                        }

                        // Notifica il raccoglitore
                        if (p.ws && p.ws.readyState === WebSocket.OPEN)
                            p.ws.send(JSON.stringify(notifyData));

                        // Broadcast a tutti: box rimossa dalla mappa
                        const removeEvt = JSON.stringify({ type: 'cargoBoxRemoved', id: bid, collectorId: p.username });
                        map.players.forEach(pl => { if (pl.ws && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(removeEvt); });

                        map.cargoBoxes.delete(bid);
                        console.log(`[CARGO BOX] Collected by ${p.username} — cat=${loot.category}`);
                        break;
                    }
                });

                // ── 9. Broadcast stato ────────────────────────────────────
                updateBots(map, DELTA_TIME, now);
                const VIEW_DIST_SQ = 2500 * 2500;
                map.players.forEach(p => { 
                    if(!p.ws || p.ws.readyState !== WebSocket.OPEN) return;
                    const state = { players: [], enemies: [], projectiles: [], resources: [], turrets: [], mines: [], cargoBoxes: [] };
                    const pParty = p.partyId ? parties.get(p.partyId) : null;
                    map.players.forEach(op => {
                        const inParty = pParty && pParty.members.has(op.username);
                        if (op.username === p.username || inParty || (op.x-p.x)**2 + (op.y-p.y)**2 < VIEW_DIST_SQ) {
                            const pData = {
                                id: op.username, faction: op.faction, x: op.x, y: op.y, angle: op.angle,
                                hp: op.hp, maxHp: op.maxHp,
                                shield: Number(op.shield || 0),
                                maxShield: Number(op.maxShield || 0),
                                shieldRatio: (op.maxShield > 0) ? (op.shield / op.maxShield) : 0,
                                // ── Dati scudo calcolati server-side ─────────────────
                                shieldRings:     op.shieldRings     || 0,
                                fillRatio:       op.fillRatio       || 0,
                                shieldSlots:     op.shieldSlots     || 1,
                                usedShieldSlots: op.usedShieldSlots || 0,
                                // ────────────────────────────────────────────────────
                                shipType: op.shipType, drones: op.drones, score: op.score||0,
                                kills: op.kills||0, deaths: op.deaths||0, credits: op.credits||0,
                                isRegenerating:  !!op.isRegenerating,
                                isShieldRegen:   !!op.isShieldRegen,
                                sprintExhausted: !!op.sprintExhausted,
                                empInvulnerable: !!op.empInvulnerable,
                                slowDebuffColor: op.slowDebuffColor || null,
                                isSprinting:     !!op.isSprinting,
                                isCargoFull:     !!op.isCargoFull,
                                equipped:        op.equipped || {},
                                pilotLevel:      op.pilotLevel || 1,
                                // party data — needed for party tag rendering on bots
                                partyId:         op.partyId   || null,
                                partyName:       op.partyId ? (parties.get(op.partyId)?.name || null) : null
                            };
                            
                                    if (op.pet && op.pet.active) {
                                        pData.pet = {
                                            x: op.pet.x,
                                            y: op.pet.y,
                                            angle: op.pet.angle,
                                            active: true
                                        };
                                    }
                            
                            state.players.push(pData);
                        }
                    });
                    map.enemies.forEach(e => {
                        if ((e.x-p.x)**2 + (e.y-p.y)**2 < VIEW_DIST_SQ) {
                            state.enemies.push({ id:e.id, type:e.type, x:e.x, y:e.y, angle:e.angle, hp:e.hp, maxHp:e.maxHp, shield:e.shield||0, maxShield:e.maxShield||0, color:e.color });
                        }
                    });
                    map.projectiles.forEach(proj => {
                        if ((proj.x-p.x)**2 + (proj.y-p.y)**2 < VIEW_DIST_SQ) {
                            state.projectiles.push({
                                id:proj.id, x:proj.x, y:proj.y, angle:proj.angle,
                                color:proj.color, thickness:proj.thickness||2,
                                isFullSlots:proj.isFullSlots||false,
                                isMissile:proj.isMissile||false,
                                isTurretShot:proj.isTurretShot||false,
                                missileType:proj.missileType||null,
                                ownerId:proj.ownerId,
                                ammoType: proj.ammoType || 'x1'
                            });
                        }
                    });
                    map.resources.forEach(r => {
                        if ((r.x-p.x)**2 + (r.y-p.y)**2 < VIEW_DIST_SQ) {
                            state.resources.push({ id:r.id, type:r.resType, itemName:r.itemName||r.resType, rarity:r.rarity||'common', isRare:!!r.isRare, color:r.color||'#ffffff', value:r.value||0, quantity:r.quantity||0, x:r.x, y:r.y, radius:r.radius||8 });
                        }
                    });
                    map.turrets.forEach(t => {
                        if ((t.x-p.x)**2 + (t.y-p.y)**2 < VIEW_DIST_SQ) {
                            state.turrets.push({ id:t.id, x:t.x, y:t.y, angle:t.angle, faction:t.faction });
                        }
                    });
                    map.mines.forEach(m => {
                        if ((m.x-p.x)**2 + (m.y-p.y)**2 < VIEW_DIST_SQ) {
                            state.mines.push({ id:m.id, x:m.x, y:m.y, mineType:m.mineType, color:m.def.color, age:m.age });
                        }
                    });
                    // ── Cargo Box ─────────────────────────────────────────
                    if (map.cargoBoxes) {
                        map.cargoBoxes.forEach(box => {
                            if ((box.x-p.x)**2 + (box.y-p.y)**2 < VIEW_DIST_SQ) {
                                state.cargoBoxes.push({ id:box.id, x:box.x, y:box.y, radius:box.radius, age:box.age });
                            }
                        });
                    }
                    p.ws.send(JSON.stringify({type:'worldUpdate',state}));
                });
            }
        } catch (err) { console.error('[CRITICAL] CRASH NEL GAME LOOP SERVER:', err); }
    }, 1000 / TICK_RATE);
}

module.exports = { startGameLoop };
