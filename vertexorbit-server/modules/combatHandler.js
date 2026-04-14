// ============================================================
//  combatHandler.js — shoot, mine, EMP, smartBomb
// ============================================================
const WebSocket = require('ws');
const { MINE_TYPES, ENEMY_TYPES, LOOT_ITEMS, ENEMY_LOOT } = require('./config');
const { maps, getNextId } = require('./maps');
const { addCredits, sendPlayerStats, persistPlayerMeta, broadcastLeaderboard, addPilotExp } = require('./playerHandler');
const { handlePartyReward } = require('./partyHandler');

function handlePlayerShoot(player, data) {
    const isMissile = !!(data.missileType);
    const proj = {
        id: getNextId(),
        x: data.x !== undefined ? data.x : player.x,
        y: data.y !== undefined ? data.y : player.y,
        angle:     data.angle     || 0,
        speed:     isMissile ? 350 : 1200,   // missili molto più lenti dei laser
        damage:    data.damage    || 100,
        isPlayerOwned: true,
        ownerId:   player.username,
        color:     data.laserColor || '#ffffff',
        thickness:   data.thickness   || 2,
        isFullSlots: data.isFullSlots  || false,
        isMissile:   isMissile,
        missileType: data.missileType  || null,
        life: isMissile ? 5 : 2, age: 0, radius: isMissile ? 8 : 4,
        targetId:  data.targetId,
        ammoType:  data.ammoType  || 'x1',
        sabPct:    data.sabPct    || 0
    };
    maps[player.map].projectiles.set(proj.id, proj);
}

function handlePlaceMine(player, data) {
    const mDef = MINE_TYPES[data.mineType] || MINE_TYPES['mine-normal'];
    if (mDef.instant) {
        handleSmartBomb(player, { x: data.x, y: data.y, aoeRadius: mDef.aoeRadius, damage: mDef.damage });
        return;
    }
    const mine = {
        id: getNextId(), x: data.x, y: data.y,
        mineType: data.mineType || 'mine-normal',
        ownerId: player.username,
        ownerFaction: player.faction,
        def: mDef, age: 0, triggered: false,
        radius: 12, triggerRadius: mDef.triggerRadius || 60
    };
    if (!maps[player.map].mines) maps[player.map].mines = new Map();
    maps[player.map].mines.set(mine.id, mine);
}

function handleEMP(player, data) {
    const range = data.range || 400;
    const map   = maps[player.map];
    map.players.forEach(p => {
        if (p.username === player.username) return;
        const d = Math.hypot(p.x - player.x, p.y - player.y);
        if (d <= range && p.ws && p.ws.readyState === 1)
            p.ws.send(JSON.stringify({ type: 'empHit', fromPlayer: player.username }));
    });
    map.projectiles.forEach((proj, id) => {
        if (proj.targetId === player.username) {
            const d = Math.hypot(proj.x - player.x, proj.y - player.y);
            if (d <= range) map.projectiles.delete(id);
        }
    });
    const empMsg = JSON.stringify({ type: 'empEffect', x: player.x, y: player.y, range, fromPlayer: player.username });
    map.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(empMsg); });
}

function handleSmartBomb(player, data) {
    const aoe    = data.aoeRadius || 350;
    const damage = data.damage    || 3500;
    const map    = maps[player.map];
    map.enemies.forEach((e, eid) => {
        const d = Math.hypot(e.x - data.x, e.y - data.y);
        if (d > aoe) return;
        e.hp -= damage;
        const dmgMsg = JSON.stringify({ type: 'damageTaken', targetId: e.id, amount: damage });
        map.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(dmgMsg); });
        if (e.hp <= 0) {
            const reward = (ENEMY_TYPES[e.type] || {}).reward || 0;
            const partyShared = player.partyId ? handlePartyReward(player.partyId, reward, map, (ENEMY_TYPES[e.type] || {}).exp || 0) : false;
            if (!partyShared) {
                addCredits(player, reward);
                if (player.ws) player.ws.send(JSON.stringify({ type: 'reward', credits: reward }));
                player.score = (player.score || 0) + Math.floor(reward / 10);
                player.kills = (player.kills || 0) + 1;
                player.alienKills = (player.alienKills || 0) + 1;
                // ── EXP pilota (solo kill alieni) ──
                const eTd = ENEMY_TYPES[e.type];
                addPilotExp(player, eTd ? (eTd.exp || 0) : 0);
                sendPlayerStats(player); persistPlayerMeta(player); broadcastLeaderboard();
            }
            // Genera loot dalla loot table
            const lootTable = ENEMY_LOOT[e.type] || [];
            lootTable.forEach(entry => {
                if (Math.random() > entry.chance) return;
                const qty = Math.floor(entry.minQty + Math.random() * (entry.maxQty - entry.minQty + 1));
                if (qty <= 0) return;
                const itemDef = LOOT_ITEMS[entry.itemId];
                if (!itemDef) return;
                const angle = Math.random() * Math.PI * 2;
                const res = {
                    id: getNextId(),
                    x: e.x + Math.cos(angle) * (20 + Math.random() * 60),
                    y: e.y + Math.sin(angle) * (20 + Math.random() * 60),
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
            map.enemies.delete(eid);
        }
    });
    const sbMsg = JSON.stringify({ type: 'smartBombEffect', x: data.x, y: data.y, aoeRadius: aoe });
    map.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(sbMsg); });
}

module.exports = { handlePlayerShoot, handlePlaceMine, handleEMP, handleSmartBomb };
