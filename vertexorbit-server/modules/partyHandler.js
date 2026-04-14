// ============================================================
//  partyHandler.js — Party system logic
// ============================================================
const { maps, getNextId } = require('./maps');
const { sendPlayerStats, persistPlayerMeta, broadcastLeaderboard, addCredits, addPilotExp } = require('./playerHandler');

const parties = new Map(); // partyId -> { id, leader, members: Set }
const partyInvites = new Map(); // username -> array of { from, partyId, expire }

function getPartyByMember(username) {
    for (let p of parties.values()) {
        if (p.members.has(username)) return p;
    }
    return null;
}

function broadcastPartyUpdate(party) {
    const memberData = [];
    party.members.forEach(uname => {
        let found = false;
        for (let mapName in maps) {
            const p = maps[mapName].players.get(uname);
            if (p) {
                memberData.push({ username: p.username, hp: p.hp, maxHp: p.maxHp, shield: p.shield, maxShield: p.maxShield, isDead: p.isDead, map: mapName, x: p.x, y: p.y });
                found = true;
                break;
            }
        }
        if (!found) {
            memberData.push({ username: uname, hp: 0, maxHp: 0, shield: 0, maxShield: 0, isDead: true, offline: true });
        }
    });
    const msg = JSON.stringify({ type: 'partyUpdate', party: { id: party.id, name: party.name, leader: party.leader, members: memberData } });
    party.members.forEach(uname => {
        for (let mapName in maps) {
            const p = maps[mapName].players.get(uname);
            if (p && p.ws && p.ws.readyState === 1) p.ws.send(msg);
        }
    });
}

function inviteToParty(fromPlayer, toUsername) {
    let toPlayer = null;
    for (let mapName in maps) {
        if (maps[mapName].players.has(toUsername)) {
            toPlayer = maps[mapName].players.get(toUsername);
            break;
        }
    }
    if (!toPlayer || toPlayer.faction !== fromPlayer.faction) {
        if (fromPlayer.ws) fromPlayer.ws.send(JSON.stringify({ type: 'partyMessage', message: 'Player not found or different faction.', isError: true }));
        return;
    }
    if (getPartyByMember(toUsername)) {
        if (fromPlayer.ws) fromPlayer.ws.send(JSON.stringify({ type: 'partyMessage', message: 'That player is already in a party.', isError: true }));
        return;
    }
    
    let party = getPartyByMember(fromPlayer.username);
    if (party && party.leader !== fromPlayer.username) {
        if (fromPlayer.ws) fromPlayer.ws.send(JSON.stringify({ type: 'partyMessage', message: 'Only the leader can invite players.', isError: true }));
        return;
    }
    
    if (!party) {
        party = { id: getNextId(), name: `${fromPlayer.username}'s Party`, leader: fromPlayer.username, members: new Set([fromPlayer.username]) };
        parties.set(party.id, party);
        fromPlayer.partyId = party.id;
        broadcastPartyUpdate(party);
    }
    
    if (!partyInvites.has(toUsername)) partyInvites.set(toUsername, []);
    partyInvites.get(toUsername).push({ from: fromPlayer.username, partyId: party.id, expire: Date.now() + 60000 });
    
    if (toPlayer.ws && toPlayer.ws.readyState === 1) {
        toPlayer.ws.send(JSON.stringify({ type: 'partyInvite', from: fromPlayer.username, partyId: party.id }));
    }
    if (fromPlayer.ws) fromPlayer.ws.send(JSON.stringify({ type: 'partyMessage', message: `Invite sent to ${toUsername}.` }));
}

function acceptPartyInvite(player, partyId) {
    const invitesList = partyInvites.get(player.username) || [];
    const invite = invitesList.find(i => i.partyId === partyId);
    if (!invite || invite.expire < Date.now()) {
        if (player.ws) player.ws.send(JSON.stringify({ type: 'partyMessage', message: 'Invite expired or invalid.', isError: true }));
        return;
    }
    partyInvites.set(player.username, invitesList.filter(i => i.partyId !== partyId));
    
    if (getPartyByMember(player.username)) {
        if (player.ws) player.ws.send(JSON.stringify({ type: 'partyMessage', message: 'You are already in a party.', isError: true }));
        return;
    }
    
    const party = parties.get(partyId);
    if (!party) {
        if (player.ws) player.ws.send(JSON.stringify({ type: 'partyMessage', message: 'Party no longer exists.', isError: true }));
        return;
    }
    
    party.members.add(player.username);
    player.partyId = party.id;
    broadcastPartyUpdate(party);
}

function rejectPartyInvite(player, partyId) {
    const invitesList = partyInvites.get(player.username) || [];
    partyInvites.set(player.username, invitesList.filter(i => i.partyId !== partyId));
}

function leaveParty(player) {
    const party = getPartyByMember(player.username);
    if (!party) return;
    
    party.members.delete(player.username);
    player.partyId = null;
    if (player.ws && player.ws.readyState === 1) {
        player.ws.send(JSON.stringify({ type: 'partyUpdate', party: null }));
    }
    
    if (party.members.size === 0) {
        parties.delete(party.id);
    } else {
        if (party.leader === player.username) {
            party.leader = Array.from(party.members)[0];
        }
        broadcastPartyUpdate(party);
    }
}

function kickFromParty(player, targetUsername) {
    const party = getPartyByMember(player.username);
    if (!party || party.leader !== player.username) return;
    
    if (party.members.has(targetUsername)) {
        party.members.delete(targetUsername);
        let targetPlayer = null;
        for (let mapName in maps) {
            if (maps[mapName].players.has(targetUsername)) {
                targetPlayer = maps[mapName].players.get(targetUsername);
                break;
            }
        }
        if (targetPlayer) {
            targetPlayer.partyId = null;
            if (targetPlayer.ws && targetPlayer.ws.readyState === 1) {
                targetPlayer.ws.send(JSON.stringify({ type: 'partyUpdate', party: null }));
                targetPlayer.ws.send(JSON.stringify({ type: 'partyMessage', message: 'You have been kicked from the party.', isError: true }));
            }
        }
        if (party.members.size === 0) {
            parties.delete(party.id);
        } else {
            broadcastPartyUpdate(party);
        }
    }
}

function promotePartyLeader(player, targetUsername) {
    const party = getPartyByMember(player.username);
    if (!party || party.leader !== player.username) return;
    
    if (party.members.has(targetUsername)) {
        party.leader = targetUsername;
        broadcastPartyUpdate(party);
    }
}

function changePartyName(player, newName) {
    const party = getPartyByMember(player.username);
    if (!party || party.leader !== player.username) return;
    if (typeof newName === 'string') {
        party.name = newName.substring(0, 20);
        broadcastPartyUpdate(party);
    }
}

function handlePartyReward(partyId, reward, sourceMap, enemyExp) {
    const party = parties.get(partyId);
    if (!party) return false;
    
    const onlineMembers = [];
    party.members.forEach(uname => {
        if (sourceMap && sourceMap.players.has(uname)) {
            const p = sourceMap.players.get(uname);
            if (!p.isDead) onlineMembers.push(p);
        }
    });
    
    if (onlineMembers.length > 0) {
        const splitReward = Math.floor(reward / onlineMembers.length);
        const splitExp    = enemyExp ? Math.floor(enemyExp / onlineMembers.length) : 0;
        onlineMembers.forEach(member => {
            addCredits(member, splitReward);
            if (member.ws && member.ws.readyState === 1) member.ws.send(JSON.stringify({ type: 'reward', credits: splitReward }));
            member.score = (member.score || 0) + Math.floor(splitReward / 10);
            member.kills = (member.kills || 0) + 1;
            member.alienKills = (member.alienKills || 0) + 1;
            // Distribute EXP to each party member
            if (splitExp > 0) addPilotExp(member, splitExp);
            sendPlayerStats(member); persistPlayerMeta(member);
        });
        broadcastLeaderboard();
        return true;
    }
    return false;
}

module.exports = {
    parties, inviteToParty, acceptPartyInvite, rejectPartyInvite, leaveParty, kickFromParty, promotePartyLeader, changePartyName, handlePartyReward, broadcastPartyUpdate
};