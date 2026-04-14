// ============================================================
//  server.js — Entry point (WebSocket + routing messaggi)
// ============================================================
const WebSocket = require('ws');
const { initDB } = require('./db');
const { registerUser, loginUser } = require('./db');
const { maps, initMaps } = require('./modules/maps');
const {
    clients,
    handleLogin, handleSyncFullState,
    handlePlayerDeath, handleRespawn, handleDisconnect,
    sendLeaderboard, handleUpdatePilotSkills
} = require('./modules/playerHandler');
const { handlePlayerShoot, handlePlaceMine, handleEMP, handleSmartBomb } = require('./modules/combatHandler');
const { startGameLoop } = require('./modules/gameLoop');
const { initBots, handlePlayerInviteBot } = require('./modules/botAi');
const { inviteToParty, acceptPartyInvite, rejectPartyInvite, leaveParty, kickFromParty, promotePartyLeader, changePartyName } = require('./modules/partyHandler');

initDB();
initMaps();
initBots(maps);

const wss = new WebSocket.Server({ port: 8080 });
console.log('=============================================');
console.log('[SERVER] WebSocket STARTED on port 8080');
console.log('=============================================');

wss.on('connection', (ws) => {
    let currentUser = null;

    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }
        try {
            switch (data.type) {

                // ── REGISTRAZIONE ─────────────────────────────────────────
                case 'register': {
                    const result = registerUser(data.username, data.password, data.faction);
                    if (result.ok) {
                        ws.send(JSON.stringify({ type: 'registerOk', username: data.username }));
                    } else {
                        ws.send(JSON.stringify({ type: 'registerError', error: result.error }));
                    }
                    break;
                }

                // ── LOGIN CON PASSWORD ─────────────────────────────────────
                case 'auth': {
                    const result = loginUser(data.username, data.password);
                    if (!result.ok) {
                        ws.send(JSON.stringify({ type: 'authError', error: result.error }));
                        break;
                    }
                    // Auth ok → entra in gioco
                    currentUser = handleLogin(ws, { username: data.username, faction: result.userData.faction });
                    break;
                }

                case 'move':
                    if (currentUser) {
                        currentUser.x     = data.x;
                        currentUser.y     = data.y;
                        currentUser.angle = data.angle;
                        currentUser.isRegenerating  = data.isRegenerating;
                        currentUser.isShieldRegen   = data.isShieldRegen;
                        currentUser.sprintExhausted = data.sprintExhausted;
                        currentUser.empInvulnerable = data.empInvulnerable;
                        currentUser.slowDebuffColor = data.slowDebuffColor;
                        currentUser.isSprinting     = data.isSprinting  || false;
                        currentUser.isCargoFull     = data.isCargoFull  || false;
                    }
                    break;

                // ── SINCRONIZZAZIONE PET lato server ──────────────────────
                case 'petSync':
                    if (currentUser) {
                        if (!currentUser.pet) currentUser.pet = { x: data.x, y: data.y, angle: data.angle || 0, active: true };
                        else {
                            currentUser.pet.x     = data.x;
                            currentUser.pet.y     = data.y;
                            currentUser.pet.angle = data.angle || 0;
                            currentUser.pet.active = true;
                        }
                    }
                    break;

                case 'petDeactivate':
                    if (currentUser && currentUser.pet) currentUser.pet.active = false;
                    break;
                case 'changeMap': break;
                case 'shoot':
                    if (currentUser && !currentUser.isDead) handlePlayerShoot(currentUser, data);
                    break;
                case 'collect':
                    if (currentUser && !currentUser.isDead) {
                        const map = maps[currentUser.map];
                        if (map && map.resources.has(data.id)) {
                            const r = map.resources.get(data.id);
                            const SHIP_CARGO = { phoenix: 200, liberator: 500, nostromo: 1000, bigboy: 1600, leonov: 1200, vengeance: 2000, goliath: 3000, spearhead: 1200, citadel: 6000 };
                            const maxCargo = SHIP_CARGO[currentUser.shipType] || currentUser.maxCargo || 100;
                            const freeSpace = maxCargo - (currentUser.cargo || 0);
                            if (freeSpace > 0) {
                                const qty = r.quantity !== undefined ? r.quantity : r.value;
                                const taken = Math.min(freeSpace, qty);
                                const remaining = qty - taken;
                                if (!currentUser.materials) currentUser.materials = {};
                                currentUser.materials[r.resType] = (currentUser.materials[r.resType]||0) + taken;
                                if (!currentUser.lootCargo) currentUser.lootCargo = {};
                                currentUser.lootCargo[r.resType] = (currentUser.lootCargo[r.resType]||0) + taken;
                                currentUser.cargo = Math.min(maxCargo, (currentUser.cargo||0) + taken);
                                currentUser.ws.send(JSON.stringify({
                                    type:'collectLoot', resType: r.resType, itemName: r.itemName || r.resType, rarity: r.rarity || 'common', isRare: !!r.isRare, color: r.color || '#ffffff', itemValue: r.value || 1, taken, remaining
                                }));
                                const { sendPlayerStats, persistPlayerMeta } = require('./modules/playerHandler');
                                sendPlayerStats(currentUser); persistPlayerMeta(currentUser);
                                if (remaining > 0) r.quantity = remaining; else map.resources.delete(data.id);
                            }
                        }
                    }
                    break;
                case 'placeMine':
                    if (currentUser && !currentUser.isDead) handlePlaceMine(currentUser, data);
                    break;
                case 'emp':
                    if (currentUser && !currentUser.isDead) {
                        // Attiva invulnerabilità EMP: 2-5s (random)
                        const empDur = 2 + Math.random() * 3;
                        currentUser.empInvulnerable = true;
                        currentUser.empInvulnTimer  = empDur;
                        // Rimuovi il player come target da tutti i nemici della mappa
                        const empMap = maps[currentUser.map];
                        if (empMap) {
                            empMap.enemies.forEach(e => {
                                if (e.target === currentUser.username) { e.target = null; }
                            });
                        }
                        // Notifica client della durata
                        ws.send(JSON.stringify({ type: 'empInvulnStart', duration: empDur }));
                        handleEMP(currentUser, data);
                    }
                    break;
                case 'smartBomb':
                    if (currentUser && !currentUser.isDead) handleSmartBomb(currentUser, data);
                    break;
                case 'updateStats':
                    if (currentUser) {
                        currentUser.hp       = data.hp;
                        currentUser.maxHp    = data.maxHp;
                        currentUser.shipType = data.shipType;
                        currentUser.drones   = data.drones;
                    }
                    break;
                case 'syncFullState':
                    if (currentUser) handleSyncFullState(currentUser, data);
                    break;
                case 'getLeaderboard':
                    if (currentUser) sendLeaderboard(ws);
                    break;
                case 'updatePilotSkills':
                    if (currentUser) handleUpdatePilotSkills(currentUser, data);
                    break;
                case 'notifyDead':
                    if (currentUser && !currentUser.isDead) handlePlayerDeath(currentUser);
                    break;
                case 'respawn':
                    if (currentUser) handleRespawn(currentUser);
                    break;
                case 'partyInvite':
                    if (currentUser && !currentUser.isDead) {
                        // Se il target è un bot, usa la logica speciale
                        const { allBots } = require('./modules/botAi');
                        const isBot = allBots.some(b => b.username === data.targetUsername && b.online);
                        if (isBot) {
                            handlePlayerInviteBot(currentUser, data.targetUsername);
                        } else {
                            inviteToParty(currentUser, data.targetUsername);
                        }
                    }
                    break;
                case 'partyAccept':
                    if (currentUser) acceptPartyInvite(currentUser, data.partyId);
                    break;
                case 'partyReject':
                    if (currentUser) rejectPartyInvite(currentUser, data.partyId);
                    break;
                case 'partyLeave':
                    if (currentUser) leaveParty(currentUser);
                    break;
                case 'partyKick':
                    if (currentUser) kickFromParty(currentUser, data.targetUsername);
                    break;
                case 'partyPromote':
                    if (currentUser) promotePartyLeader(currentUser, data.targetUsername);
                    break;
                case 'partyChangeName':
                    if (currentUser) changePartyName(currentUser, data.newName);
                    break;
            }
        } catch (err) {
            console.error('[ERROR] WS message handling:', err);
        }
    });

    ws.on('close', () => {
        if (currentUser) {
            leaveParty(currentUser);
            handleDisconnect(currentUser);
        }
        clients.delete(ws);
    });
});

startGameLoop();
