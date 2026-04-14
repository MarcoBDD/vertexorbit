class WebSocketClient {
    constructor(url, player) {
        this.url = url;
        this.player = player;
        this.ws = null;
        this.connected = false;
        this.serverState = null;
    }

    connect(username, password) {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
            console.log('Connesso al server WebSocket');
            this.connected = true;
            this.ws.send(JSON.stringify({ type: 'auth', username, password }));
        };
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (err) {
                console.error('Messaggio WS non valido:', err);
            }
        };
        this.ws.onclose = () => {
            console.log('Disconnesso dal server WebSocket');
            this.connected = false;
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'authError':
                if (typeof window.onAuthError === 'function') window.onAuthError(data.error);
                break;
            case 'registerOk':
                if (typeof window.onRegisterOk === 'function') window.onRegisterOk(data.username);
                break;
            case 'registerError':
                if (typeof window.onRegisterError === 'function') window.onRegisterError(data.error);
                break;
            case 'loginSuccess':
                this.player.username  = data.data.username || data.data.id || '';
                this.player.hp        = data.data.hp;
                this.player.maxHp     = data.data.maxHp;
                this.player.shipType  = data.data.shipType  || 'phoenix';
                this.player.x         = data.data.x;
                this.player.y         = data.data.y;
                this.player.faction = data.data.faction || 'MMO';
                this.player.credits = data.data.credits || 100000;
                this.player.uridium = data.data.uridium || 50000;
                this.player.cargo = data.data.cargo || 0;
                this.player.maxCargo = data.data.maxCargo || 100;
                this.player.score = data.data.score || 0;
                this.player.kills = data.data.kills || 0;
                this.player.deaths = data.data.deaths || 0;
                this.player.lootCargo = data.data.lootCargo || {};
                if (data.data.materials) this.player.materials = data.data.materials;
                if (data.data.inventory) this.player.inventory = data.data.inventory;
                if (data.data.configs)   {
                    const raw = data.data.configs;
                    const normalized = {};
                    [1, 2, '1', '2'].forEach(k => {
                        normalized[k] = raw[k] || raw[String(k)] || raw[Number(k)] || {
                            lasers:[], shields:[], generators:[], cpus:[],
                            missiles:['plt-2026'], drones:[], droneItems:[], pets:[], petItems:[]
                        };
                    });
                    this.player.configs = normalized;
                }
                this.player.activeConfig = Number(data.data.activeConfig) || 1;
                if (data.data.ammo)        this.player.ammo        = data.data.ammo;
                if (data.data.missileAmmo) this.player.missileAmmo = data.data.missileAmmo;
                if (data.data.mineAmmo)    this.player.mineAmmo    = data.data.mineAmmo;
                if (data.data.empAmmo)     this.player.empAmmo     = data.data.empAmmo;
                // ── Pilot Skills al login ──────────────────────────────────
                this.player.pilotLevel  = data.data.pilotLevel  || 1;
                this.player.pilotExp    = data.data.pilotExp    || 0;
                this.player.skillPoints = data.data.skillPoints || 0;
                this.player.pilotSkills = data.data.pilotSkills || { hp:0,speed:0,sprint:0,shield:0,damage:0,laser:0,missile:0,coins:0,loot:0,exp:0 };
                this.player.expNeeded   = data.data.expNeeded   || 1000;
                this.player.recalculateStats();
                mapManager.changeMap(data.data.map, { preservePlayerPosition: true });
                if (typeof changeGameState !== 'undefined') changeGameState('playing');
                this.requestLeaderboard();
                if (typeof uiManager !== 'undefined') uiManager.updatePilotSkillsUI(this.player);
                break;
            case 'partyInvite':
                if (typeof uiManager !== 'undefined') uiManager.showPartyInvite(data.from, data.partyId);
                if (typeof window.playSfx === 'function') window.playSfx('audio/notifica_invito_party.mp3', 0.9);
                break;

            // ── EXP / Livelli Pilota ──────────────────────────────────────
            case 'expGain':
                this.player.pilotExp    = data.pilotExp;
                this.player.pilotLevel  = data.pilotLevel;
                this.player.skillPoints = data.skillPoints;
                this.player.expNeeded   = data.expNeeded;
                // Show EXP gained above the ship (always)
                if (typeof entityManager !== 'undefined' && data.gained > 0) {
                    entityManager.addEntity(new DamageText(
                        this.player.x, this.player.y - 35,
                        '+' + data.gained.toLocaleString() + ' EXP',
                        'loot', '#a78bfa'
                    ));
                }
                if (data.levelUp) {
                    // Big level-up notification via overlay
                    if (typeof showLevelUpOverlay === 'function') showLevelUpOverlay(data.pilotLevel);
                    if (typeof window.playSfx === 'function') window.playSfx('audio/nuovo_livello.mp3', 1.0);
                    this.player.recalculateStats();
                }
                if (typeof uiManager !== 'undefined') uiManager.updatePilotSkillsUI(this.player);
                break;
            case 'pilotSkillsUpdated':
                this.player.pilotSkills = data.pilotSkills;
                this.player.skillPoints = data.skillPoints;
                this.player.recalculateStats();
                if (typeof uiManager !== 'undefined') uiManager.updatePilotSkillsUI(this.player);
                break;
            case 'pilotSkillsError':
                if (typeof entityManager !== 'undefined')
                    entityManager.addEntity(new DamageText(this.player.x, this.player.y - 40, data.error, 'loot', '#ef4444'));
                break;
            case 'partyMessage':
                if (typeof entityManager !== 'undefined') entityManager.addEntity(new DamageText(this.player.x, this.player.y - 40, data.message, 'loot', data.isError ? '#ef4444' : '#5EEAD4'));
                break;
            case 'partyUpdate':
                this.player.party = data.party;
                if (typeof uiManager !== 'undefined') uiManager.updatePartyUI(data.party);
                break;
            case 'worldUpdate':
                this.serverState = data.state;
                this.updateWorld();
                break;
            case 'damageTaken':
                // Nota: le particelle VFX vengono ora gestite da 'animEvent' (broadcast server)
                // Qui gestiamo SOLO l'aggiornamento HP/shield dell'entità colpita
                let targetHasShield = false;
                let tX = data.hitX, tY = data.hitY;
                if (data.targetId) {
                    if (String(data.targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                        targetHasShield = this.player.shield > 0;
                        if (!tX) tX = this.player.x; if (!tY) tY = this.player.y;
                    } else {
                        const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(data.targetId).toLowerCase());
                        if (op) { targetHasShield = op.shield > 0; if (!tX) tX = op.x; if (!tY) tY = op.y; }
                        else {
                            const enemy = entityManager.entities.find(e => e instanceof Enemy && String(e.id) === String(data.targetId));
                            if (enemy) { targetHasShield = enemy.shield > 0; if (!tX) tX = enemy.x; if (!tY) tY = enemy.y; }
                        }
                    }
                } else {
                    targetHasShield = this.player.shield > 0;
                    if (!tX) tX = this.player.x; if (!tY) tY = this.player.y;
                }
                if (data.targetId) {
                    if (String(data.targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                        this.player.takeDamage(data.amount, tX, tY);
                        entityManager.addEntity(new DamageText(this.player.x, this.player.y, data.amount, 'normal'));
                    } else {
                        const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(data.targetId).toLowerCase());
                        if (op) { op.hp -= data.amount; if(op.hp < 0) op.hp = 0; entityManager.addEntity(new DamageText(op.x, op.y, data.amount, 'normal')); }
                        else {
                            const enemy = entityManager.entities.find(e => e instanceof Enemy && String(e.id) === String(data.targetId));
                            if (enemy) { enemy.hp -= data.amount; if(enemy.hp < 0) enemy.hp = 0; entityManager.addEntity(new DamageText(enemy.x, enemy.y, data.amount, 'normal')); }
                        }
                    }
                } else { this.player.takeDamage(data.amount, tX, tY); entityManager.addEntity(new DamageText(this.player.x, this.player.y, data.amount, 'normal')); }
                break;
            case 'playerDied':
                let deathX = 0, deathY = 0; let deadEntity = null;
                if (data.targetId && String(data.targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                    deathX = this.player.x; deathY = this.player.y; deadEntity = this.player; this.player.die();
                } else {
                    const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(data.targetId).toLowerCase());
                    if (op) { deathX = op.x; deathY = op.y; op.isDead = true; deadEntity = op; }
                }
                if (deathX !== 0 || deathY !== 0) {
                    if (typeof window.playSfx === 'function') window.playSfx('audio/esplosione_astronave.mp3', 0.8);
                    const rad = deadEntity ? (deadEntity.radius || 20) : 20;
                    let shipColor = '#94a3b8'; let accentColor = '#475569';
                    if (deadEntity && deadEntity.shipType && ITEMS.ships && ITEMS.ships[deadEntity.shipType]) {
                        shipColor = ITEMS.ships[deadEntity.shipType].color; accentColor = '#ffffff';
                    }
                    // Frammenti di scafo (Debris) che persistono
                    for(let i=0; i<15; i++) {
                        const color = Math.random() > 0.5 ? shipColor : accentColor;
                        const p = new Particle(deathX + (Math.random()-0.5)*rad, deathY + (Math.random()-0.5)*rad, color, true);
                        p.vx = (Math.random() - 0.5) * 400; p.vy = (Math.random() - 0.5) * 400;
                        p.life = 3.0 + Math.random() * 3.0; p.size = 5 + Math.random() * 8; entityManager.addEntity(p);
                    }
                    for(let i=0; i<45; i++) {
                        const color = Math.random() > 0.6 ? '#ef4444' : (Math.random() > 0.3 ? '#f97316' : '#facc15');
                        const p = new Particle(deathX + (Math.random()-0.5)*rad, deathY + (Math.random()-0.5)*rad, color);
                        p.vx = (Math.random() - 0.5) * 600; p.vy = (Math.random() - 0.5) * 600;
                        p.life = 0.8 + Math.random() * 1.0; p.size = 3 + Math.floor(Math.random() * 6); entityManager.addEntity(p);
                    }
                }
                break;
            case 'collectLoot': {
                if (typeof window.playSfx === 'function') window.playSfx('audio/raccolta_loot.mp3', 0.6);
                const taken = data.taken || 0; const rarityCol = { common:'#94a3b8', uncommon:'#4ade80', rare:'#38bdf8', epic:'#d946ef', legendary:'#facc15' };
                this.player.cargo = Math.min(this.player.maxCargo || 100, (this.player.cargo || 0) + taken);
                if (!this.player.materials) this.player.materials = {};
                this.player.materials[data.resType] = (this.player.materials[data.resType] || 0) + taken;
                const label = `+${taken} ${data.itemName || data.resType}` + ((data.remaining || 0) > 0 ? ` (resta ${data.remaining})` : '');
                if (typeof entityManager !== 'undefined') entityManager.addEntity(new DamageText(this.player.x, this.player.y - 30, label, 'loot', rarityCol[data.rarity] || '#fff'));
                break;
            }
            case 'youDied':
                this.player.cargo = 0; for (let mat in this.player.materials) { this.player.materials[mat] = 0; }
                if (typeof changeGameState !== 'undefined') changeGameState('menu');
                break;
            case 'respawnOk': {
                const p = this.player; p.x = data.x; p.y = data.y; p.targetX = data.x; p.targetY = data.y; p.vx = 0; p.vy = 0; p.angle = 0;
                p.maxHp = data.maxHp || p.maxHp || 4000; p.hp = p.maxHp; p.shield = p.maxShield || 0; p.sprint = p.maxSprint || 0; p.sprintExhausted = false; p.slowDebuff = null; p.lastDamageTime = 0; p.isDead = false;
                if (typeof camera !== 'undefined' && typeof canvas !== 'undefined') { camera.x = data.x - canvas.width / 2; camera.y = data.y - canvas.height / 2; }
                if (typeof changeGameState !== 'undefined') changeGameState('playing');
                this.sendMove(data.x, data.y, 0); break;
            }
            case 'playerStats':
                if (data.data) {
                    if (data.data.hp !== undefined) this.player.hp = data.data.hp; if (data.data.maxHp !== undefined) this.player.maxHp = data.data.maxHp;
                    if (data.data.credits !== undefined) this.player.credits = data.data.credits; if (data.data.score !== undefined) this.player.score = data.data.score;
                    if (data.data.kills !== undefined) this.player.kills = data.data.kills; if (data.data.deaths !== undefined) this.player.deaths = data.data.deaths;
                    if (data.data.cargo !== undefined) this.player.cargo = data.data.cargo;
                }
                break;
            case 'slowDebuff':
                this.player.applySlowDebuff(data.slowPct, data.duration, data.enemyColor || '#a855f7');
                this.sendMove(this.player.x, this.player.y, this.player.angle, this.player.isRegenerating, this.player.isShieldRegen, this.player.sprintExhausted, this.player.empInvulnerable, this.player.slowDebuff.color, this.player.isSprinting, this.player.isCargoFull);
                break;
            case 'debuffEnd':
                // Server ha concluso il debuff del player locale
                if (this.player.slowDebuff) { this.player.slowDebuff = null; }
                this.sendMove(this.player.x, this.player.y, this.player.angle, this.player.isRegenerating, this.player.isShieldRegen, this.player.sprintExhausted, this.player.empInvulnerable, null, this.player.isSprinting, this.player.isCargoFull);
                break;
            case 'sabHeal':
                if (this.player.shield < this.player.maxShield) this.player.shield = Math.min(this.player.maxShield, this.player.shield + (data.amount || 0));
                entityManager.addEntity(new DamageText(this.player.x, this.player.y - 20, '+' + data.amount + ' SCU', 'shield'));
                break;
            case 'empHit':
                if (typeof inputManager !== 'undefined') { inputManager.targetEntity = null; inputManager.isShooting = false; }
                break;
            case 'empInvulnStart':
                if (typeof player !== 'undefined') {
                    player.empInvulnerable = true; player.empInvulnTimer = data.duration || 3;
                    if (typeof inputManager !== 'undefined') { inputManager.targetEntity = null; inputManager.isShooting = false; }
                    this.sendMove(player.x, player.y, player.angle, player.isRegenerating, player.isShieldRegen, player.sprintExhausted, player.empInvulnerable, player.slowDebuff ? player.slowDebuff.color : null);
                    if (typeof window.playLoopSfx === 'function') window.playLoopSfx('emp_loop_local', 'audio/emp_loop_durata_totale.mp3', 0.6);
                    
                    // Safety net per assicurarsi che il loop si spenga
                    setTimeout(() => {
                        if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('emp_loop_local', 300);
                    }, (data.duration || 3) * 1000 + 100);
                }
                break;
            case 'empInvulnEnd':
                if (typeof player !== 'undefined') { 
                    player.empInvulnerable = false; player.empInvulnTimer = 0; 
                    this.sendMove(player.x, player.y, player.angle, player.isRegenerating, player.isShieldRegen, player.sprintExhausted, false, player.slowDebuff ? player.slowDebuff.color : null); 
                    if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('emp_loop_local', 300);
                }
                break;
            case 'empEffect':
                if (typeof window.playSfx === 'function') {
                    const distSq = (data.x - this.player.x)**2 + (data.y - this.player.y)**2;
                    if (distSq < 2500 * 2500) {
                        let vol = 1.0 - Math.sqrt(distSq) / 2500;
                        window.playSfx('audio/emp_attivazione.mp3', Math.max(0.1, vol * 0.9));
                    }
                }
                if (typeof entityManager !== 'undefined') {
                    for (let i = 0; i < 16; i++) {
                        const ang = (i / 16) * Math.PI * 2; const p = new Particle(data.x + Math.cos(ang) * 20, data.y + Math.sin(ang) * 20, '#22d3ee');
                        p.vx = Math.cos(ang) * 300; p.vy = Math.sin(ang) * 300; p.life = 0.6; entityManager.addEntity(p);
                    }
                }
                break;
            case 'smartBombEffect':
                if (typeof window.playSfx === 'function') {
                    const distSq = (data.x - this.player.x)**2 + (data.y - this.player.y)**2;
                    if (distSq < 2000 * 2000) {
                        let vol = 1.0 - Math.sqrt(distSq) / 2000;
                        window.playSfx('audio/esplosione_mina.mp3', Math.max(0.1, vol * 0.9));
                    }
                }
                if (typeof entityManager !== 'undefined') {
                    for (let i = 0; i < 40; i++) {
                        const ang = Math.random() * Math.PI * 2; const spd = 100 + Math.random() * 500;
                        const p = new Particle(data.x + Math.cos(ang)*10, data.y + Math.sin(ang)*10, i%3===0?'#f59e0b':i%3===1?'#ef4444':'#fde68a');
                        p.vx = Math.cos(ang)*spd; p.vy = Math.sin(ang)*spd; p.life = 0.5 + Math.random()*0.5; entityManager.addEntity(p);
                    }
                }
                break;
            case 'animEvent': {
                // ── ANIMAZIONI SINCRONIZZATE SERVER → TUTTI I CLIENT ──────
                // Questo handler gestisce TUTTI gli effetti visivi per qualsiasi entità
                // indipendentemente da chi osserva, eliminando il desync.
                if (typeof entityManager === 'undefined') break;
                const { kind, targetId, targetType, x: evX, y: evY, color: evColor, damage: evDmg, isCrit: evCrit } = data;

                // Trova la posizione dell'entità colpita (per centrare i VFX)
                let hitX = evX, hitY = evY;
                if (targetType === 'player') {
                    if (targetId && String(targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                        hitX = this.player.x; hitY = this.player.y;
                    } else {
                        const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(targetId).toLowerCase());
                        if (op) { hitX = op.x; hitY = op.y; }
                    }
                } else if (targetType === 'enemy') {
                    const en = entityManager.entities.find(e => e instanceof Enemy && String(e.id) === String(targetId));
                    if (en) { hitX = en.x; hitY = en.y; }
                }

                if (kind === 'shieldHit') {
                    if (typeof window.playSfx === 'function') {
                        const distSq = (hitX - this.player.x)**2 + (hitY - this.player.y)**2;
                        if (distSq < 1500 * 1500) {
                            let vol = 1.0 - Math.sqrt(distSq) / 1500;
                            if (vol < 0.1) vol = 0.1;
                            window.playSfx('audio/scudi_impatto_danno.mp3', vol * 0.6);
                        }
                    }
                    
                    // Suono rottura scudo se i danni svuotano lo scudo
                    if (targetType === 'player' && targetId && String(targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                        if (this.player.shield <= 0 && evDmg > 0 && typeof window.playSfx === 'function') {
                            window.playSfx('audio/shield_break.mp3', 0.8);
                        }
                    }
                    
                    // Flash + particelle piccole (rimangono per tutti)
                    const flash = new Particle(hitX, hitY, '#38bdf8');
                    flash.vx = 0; flash.vy = 0; flash.life = 0.15; flash.size = 38;
                    entityManager.addEntity(flash);
                    for (let i = 0; i < 5; i++) {
                        const ang = Math.random() * Math.PI * 2;
                        const sp = new Particle(hitX + Math.cos(ang)*18, hitY + Math.sin(ang)*18, i < 3 ? '#7dd3fc' : '#e0f2fe');
                        sp.vx = Math.cos(ang) * (80 + Math.random()*120);
                        sp.vy = Math.sin(ang) * (80 + Math.random()*120);
                        sp.life = 0.18 + Math.random() * 0.15; sp.size = 2 + Math.floor(Math.random()*3);
                        entityManager.addEntity(sp);
                    }

                    // ── Animazione deformazione anello sullo scudo dell'entità colpita ──
                    // Calcola l'angolo del proiettile rispetto al centro dell'entità colpita
                    const hitAngle = Math.atan2(hitY - evY, hitX - evX); // da punto impatto verso centro
                    const impactAngle = Math.atan2(evY - hitY, evX - hitX); // direzione da cui arriva il colpo

                    if (targetType === 'player') {
                        if (targetId && String(targetId).toLowerCase() === String(this.player.username).toLowerCase()) {
                            // Player locale: usa il sistema shieldHits già esistente in Player.js
                            if (!this.player.shieldHits) this.player.shieldHits = [];
                            this.player.shieldHits.push({ angle: impactAngle, age: 0, life: 0.5, intensity: 1.0 });
                        } else {
                            const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(targetId).toLowerCase());
                            if (op) {
                                if (!op.shieldHits) op.shieldHits = [];
                                op.shieldHits.push({ angle: impactAngle, age: 0, life: 0.5, intensity: 1.0 });
                            }
                        }
                    } else if (targetType === 'enemy') {
                        const en = entityManager.entities.find(e => e instanceof Enemy && String(e.id) === String(targetId));
                        if (en) {
                            if (!en.shieldHits) en.shieldHits = [];
                            en.shieldHits.push({ angle: impactAngle, age: 0, life: 0.5, intensity: 1.0 });
                        }
                    }
                } else if (kind === 'debuffApplied') {
                    // ── Debuff slow applicato — aggiorna animazione su OtherPlayer ──
                    if (targetType === 'player' && targetId && String(targetId).toLowerCase() !== String(this.player.username).toLowerCase()) {
                        const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(targetId).toLowerCase());
                        if (op) {
                            op.slowDebuffColor = data.color || '#a855f7';
                            op._slowDebuffDuration = data.duration || 5;
                            op._slowDebuffTimer = data.duration || 5;
                        }
                    }
                } else if (kind === 'debuffEnd') {
                    // ── Debuff slow terminato — ferma animazione su OtherPlayer ──
                    if (targetType === 'player' && targetId && String(targetId).toLowerCase() !== String(this.player.username).toLowerCase()) {
                        const op = entityManager.entities.find(e => e instanceof OtherPlayer && String(e.id).toLowerCase() === String(targetId).toLowerCase());
                        if (op) {
                            op.slowDebuffColor = null;
                            op._slowDebuffTimer = 0;
                            op.waveParticles = [];
                        }
                    }
                } else if (kind === 'hullHit') {
                    // Impatto scafo: arancio/rosso + scintille
                    const hColor = evCrit ? '#facc15' : (evColor || '#f97316');
                    
                    if (typeof window.playSfx === 'function') {
                        const distSq = (hitX - this.player.x)**2 + (hitY - this.player.y)**2;
                        if (distSq < 1500 * 1500) {
                            let vol = 1.0 - Math.sqrt(distSq) / 1500;
                            if (vol < 0.1) vol = 0.1;
                            window.playSfx('audio/hit_nave_senza_scudo.mp3', vol * 0.7);
                            if (evCrit) window.playSfx('audio/danno_critico.mp3', vol * 0.8);
                        }
                    }
                    
                    const flash = new Particle(hitX, hitY, hColor);
                    flash.vx = 0; flash.vy = 0; flash.life = 0.12; flash.size = evCrit ? 32 : 22;
                    entityManager.addEntity(flash);
                    let dmgScale = Math.max(0.3, Math.min(4, evDmg / 300));
                    const count = Math.max(2, Math.floor((evCrit ? 6 : 3) * dmgScale));
                    for (let i = 0; i < count; i++) {
                        const ang = Math.random() * Math.PI * 2;
                        const sp = new Particle(hitX, hitY, i % 2 === 0 ? hColor : '#ffffff');
                        sp.vx = Math.cos(ang) * (50 + Math.random()*80) * Math.max(1, dmgScale); // Hit compatta e non dispersiva
                        sp.vy = Math.sin(ang) * (50 + Math.random()*80) * Math.max(1, dmgScale);
                        sp.life = 0.1 + Math.random() * 0.15 * dmgScale; 
                        sp.size = 1 + Math.floor(Math.random()*(evCrit?3:2)) * dmgScale;
                        entityManager.addEntity(sp);
                    }
                    if (evCrit && typeof DamageText !== 'undefined') {
                        entityManager.addEntity(new DamageText(hitX, hitY - 20, evDmg, 'crit'));
                    }
                }
                break;
            }
            case 'mineExplode':
                if (typeof window.playSfx === 'function') {
                    const distSq = (data.x - this.player.x)**2 + (data.y - this.player.y)**2;
                    if (distSq < 1500 * 1500) {
                        let vol = 1.0 - Math.sqrt(distSq) / 1500;
                        window.playSfx('audio/esplosione_mina.mp3', Math.max(0.1, vol * 0.8));
                    }
                }
                if (typeof entityManager !== 'undefined') {
                    for (let i = 0; i < 20; i++) {
                        const p = new Particle(data.x, data.y, data.color || '#dc2626'); p.vx = (Math.random()-0.5)*400; p.vy = (Math.random()-0.5)*400; p.life = 0.4 + Math.random()*0.3; entityManager.addEntity(p);
                    }
                }
                break;
            case 'cubikonOpen':
                if (typeof window.playSfx === 'function') {
                    const distSq = (data.x - this.player.x)**2 + (data.y - this.player.y)**2;
                    if (distSq < 3500 * 3500) {
                        let vol = 1.0 - Math.sqrt(distSq) / 3500;
                        if (vol < 0.1) vol = 0.1;
                        window.playSfx('audio/boss_cubikon_spown_cubino.mp3', vol);
                    }
                }
                break;
            case 'boardLog':
                if (typeof window.addBoardLogEntry === 'function') {
                    window.addBoardLogEntry(data.message, data.color, data);
                }
                break;
            case 'leaderboard':
                const tbody = document.getElementById('leaderboard-body');
                if (tbody) {
                    // Logo fazione: identico alla sezione REGISTRATI (⬡ Unicode + colore fazione)
                    const factionSVG = (faction) => {
                        const col = faction === 'MMO' ? '#ef4444' : faction === 'EIC' ? '#3b82f6' : '#22c55e';
                        return `<span style="font-size:20px;line-height:1;color:${col};display:inline-block;vertical-align:middle;">⬡</span>`;
                    };
                    tbody.innerHTML = '';
                    data.data.forEach((u, i) => {
                        const pos    = u.rank || (i + 1);
                        const rowBg  = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                        const posStr = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : String(pos);
                        const posColor = pos <= 3 ? '#f59e0b' : '#94a3b8';

                        tbody.innerHTML += `
                        <tr style="background:${rowBg};border-bottom:1px solid #0f172a;color:#e2e8f0;"
                            onmouseover="this.style.background='rgba(94,234,212,0.05)'"
                            onmouseout="this.style.background='${rowBg}'">
                          <td style="padding:10px 14px;text-align:center;color:${posColor};font-weight:bold;font-size:14px;">${posStr}</td>
                          <td style="padding:10px 14px;text-align:center;">${factionSVG(u.faction)}</td>
                          <td style="padding:10px 14px;text-align:left;color:#e2e8f0;font-size:13px;letter-spacing:1px;">${u.username}</td>
                          <td style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:13px;">Lv.${u.pilotLevel || 1}</td>
                          <td style="padding:10px 14px;text-align:right;color:#5EEAD4;font-size:13px;font-weight:bold;">${(u.score||0).toLocaleString()}</td>
                          <td style="padding:10px 14px;text-align:right;color:#f87171;font-size:13px;">${u.playerKills||0}</td>
                          <td style="padding:10px 14px;text-align:right;color:#fb923c;font-size:13px;">${u.alienKills||0}</td>
                        </tr>`;
                    });
                    if (data.data.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="7" style="padding:30px;text-align:center;color:#334155;font-family:'Courier New',monospace;letter-spacing:2px;">NO DATA YET</td></tr>`;
                    }
                    // ── Posizione globale del player corrente ──
                    const myRankEl = document.getElementById('leaderboard-my-rank-value');
                    if (myRankEl) {
                        if (data.myRank) {
                            const suffix = data.myRank === 1 ? 'st' : data.myRank === 2 ? 'nd' : data.myRank === 3 ? 'rd' : 'th';
                            myRankEl.textContent = `#${data.myRank}${suffix}`;
                            myRankEl.style.color = data.myRank <= 3 ? '#f59e0b' : '#5EEAD4';
                        } else {
                            myRankEl.textContent = '—';
                            myRankEl.style.color = '#475569';
                        }
                    }
                }
                break;

            // ── CARGO BOX ─────────────────────────────────────────────────
            case 'cargoBoxCollected': {
                // Rimuovi l'entità CargoBox dall'entityManager
                if (typeof entityManager !== 'undefined') {
                    const idx = entityManager.entities.findIndex(e => e instanceof CargoBox && e.id === data.id);
                    if (idx !== -1) entityManager.entities.splice(idx, 1);
                }
                // Mostra notifica loot sopra la nave del giocatore locale
                if (typeof entityManager !== 'undefined' && typeof DamageText !== 'undefined') {
                    let label = '';
                    let color = '#facc15';
                    if (data.category === 'credits') {
                        label = `+${(data.credits||0).toLocaleString()} CR`;
                        color = '#facc15';
                    } else if (data.category === 'ammo') {
                        label = `+${data.quantity} ${(data.ammoType||'').toUpperCase()}`;
                        color = '#38bdf8';
                    } else if (data.category === 'missiles') {
                        label = `+${data.quantity} ${(data.missileType||'').toUpperCase()}`;
                        color = '#fb923c';
                    } else if (data.category === 'special') {
                        label = `+${data.quantity} ${(data.specialType||'').toUpperCase()}`;
                        color = '#a78bfa';
                    }
                    if (label) entityManager.addEntity(new DamageText(
                        this.player.x, this.player.y - 50, `📦 ${label}`, 'loot', color
                    ));
                }
                if (typeof window.playSfx === 'function') window.playSfx('audio/raccolta_loot.mp3', 0.8);
                // Aggiorna i crediti se il player è il raccoglitore (già gestito da 'reward')
                break;
            }
            case 'cargoBoxRemoved': {
                // Un altro giocatore ha raccolto la box — rimuovila dalla scena
                if (typeof entityManager !== 'undefined') {
                    const idx = entityManager.entities.findIndex(e => e instanceof CargoBox && e.id === data.id);
                    if (idx !== -1) entityManager.entities.splice(idx, 1);
                }
                break;
            }
            case 'cargoBoxExpired': {
                // Box scaduta per timeout lato server
                if (typeof entityManager !== 'undefined') {
                    const idx = entityManager.entities.findIndex(e => e instanceof CargoBox && e.id === data.id);
                    if (idx !== -1) entityManager.entities.splice(idx, 1);
                }
                break;
            }
            case 'cargoBoxSpawned': {
                // Nuova box apparsa — l'updateWorld la creerà al prossimo tick.
                // Qui aggiungiamo solo un VFX flash di spawn se la box è vicina
                if (typeof entityManager !== 'undefined' && data.x !== undefined) {
                    const distSq = (data.x - this.player.x)**2 + (data.y - this.player.y)**2;
                    if (distSq < 2000 * 2000) {
                        for (let i = 0; i < 8; i++) {
                            const ang = (i / 8) * Math.PI * 2;
                            const p = new Particle(data.x + Math.cos(ang)*10, data.y + Math.sin(ang)*10, '#facc15');
                            p.vx = Math.cos(ang) * 120; p.vy = Math.sin(ang) * 120;
                            p.life = 0.5; p.size = 4;
                            entityManager.addEntity(p);
                        }
                    }
                }
                break;
            }
            // ─────────────────────────────────────────────────────────────
        }
    }

    updateWorld() {
        if (!this.serverState) return;
        const serverEntityIds = new Set();
        this.serverState.players.forEach(p => {
            // Sincronizza HUD Party a 20fps nativi
            if (this.player.party && this.player.party.members && this.player.party.members.some(m => m.username === p.id)) {
                const hpBar = document.getElementById(`party-hp-fill-${p.id}`);
                const shBar = document.getElementById(`party-sh-fill-${p.id}`);
                const shTrack = document.getElementById(`party-sh-track-${p.id}`);
                const hpText = document.getElementById(`party-hp-text-${p.id}`);
                const shText = document.getElementById(`party-sh-text-${p.id}`);
                const shTextCont = document.getElementById(`party-sh-text-container-${p.id}`);
                if (hpBar) {
                    const hpPct = p.maxHp > 0 ? Math.max(0, Math.min(1, p.hp / p.maxHp)) : 0;
                    const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#facc15' : '#ef4444';
                    hpBar.style.width = `${hpPct * 100}%`;
                    hpBar.style.background = hpColor;
                    if (hpText) hpText.textContent = `${Math.floor(p.hp||0)} / ${p.maxHp||0}`;
                }
                if (shBar && shTrack) {
                    const shPct = p.maxShield > 0 ? Math.max(0, Math.min(1, p.shield / p.maxShield)) : 0;
                    const shColor = shPct > 0.5 ? '#38bdf8' : '#0369a1';
                    shBar.style.width = `${shPct * 100}%`;
                    shBar.style.background = shColor;
                    const hasShield = p.maxShield > 0;
                    shTrack.style.display = hasShield ? 'block' : 'none';
                    if (shTextCont) shTextCont.style.display = hasShield ? 'flex' : 'none';
                    if (shText) shText.textContent = `${Math.floor(p.shield||0)} / ${p.maxShield||0}`;
                }
            }

            if (p.id && this.player.username && p.id.toLowerCase() === this.player.username.toLowerCase()) {
                serverEntityIds.add(p.id);
                const cloneIdx = entityManager.entities.findIndex(e => e instanceof OtherPlayer && e.id.toLowerCase() === p.id.toLowerCase());
                if (cloneIdx !== -1) entityManager.entities.splice(cloneIdx, 1);
                if (!this.player.isDead) { this.player.targetX = p.x; this.player.targetY = p.y; }
                this.player.score = p.score ?? this.player.score; this.player.kills = p.kills ?? this.player.kills; this.player.deaths = p.deaths ?? this.player.deaths; this.player.credits = p.credits ?? this.player.credits;
            } else {
                let op = entityManager.entities.find(e => e instanceof OtherPlayer && e.id === p.id);
                if (!op) { op = new OtherPlayer(p.x, p.y, p.id, p.shipType); op.faction = p.faction; entityManager.addEntity(op); }
                op.targetX = p.x; op.targetY = p.y; op.targetAngle = p.angle; op.hp = p.hp; op.maxHp = p.maxHp;
                op.shield = Number(p.shield || 0);
                op.maxShield = Number(p.maxShield || 0);
                op.shieldRatio = Number(p.shieldRatio || 0);
                // ── Campi scudo server-authoritative ──────────────────────
                op.shieldRings     = p.shieldRings     !== undefined ? p.shieldRings     : op.shieldRings     || 0;
                op.fillRatio       = p.fillRatio       !== undefined ? p.fillRatio       : op.fillRatio       || 0;
                op.shieldSlots     = p.shieldSlots     !== undefined ? p.shieldSlots     : op.shieldSlots     || 1;
                op.usedShieldSlots = p.usedShieldSlots !== undefined ? p.usedShieldSlots : op.usedShieldSlots || 0;
                // ──────────────────────────────────────────────────────────
                op.faction = p.faction;
                op.isRegenerating = !!p.isRegenerating; op.isShieldRegen = !!p.isShieldRegen; op.sprintExhausted = !!p.sprintExhausted;
                op.empInvulnerable = !!p.empInvulnerable; op.slowDebuffColor = p.slowDebuffColor || null; op.isSprinting = !!p.isSprinting; op.isCargoFull = !!p.isCargoFull;
                op.equipped = p.equipped ? Object.assign({}, p.equipped, { drones: p.drones || p.equipped.drones || [] }) : { drones: p.drones || [] };
                op.pilotLevel = p.pilotLevel || null;
                // party data for tag rendering (works for bots too)
                op.serverPartyId   = p.partyId   || null;
                op.serverPartyName = p.partyName || null;
                
                if (p.pet && p.pet.active) {
                    if (!op.pet) op.pet = { x: p.pet.x, y: p.pet.y, angle: p.pet.angle, active: true };
                    else { op.pet.x = p.pet.x; op.pet.y = p.pet.y; op.pet.angle = p.pet.angle; op.pet.active = true; }
                } else { op.pet = null; }
                
                serverEntityIds.add(p.id);
            }
        });
        this.serverState.enemies.forEach(e => {
            let enemy = entityManager.entities.find(ent => ent instanceof Enemy && ent.id === e.id);
            if (!enemy) {
                // Passa i dati del server come fallback per tipi non in ENEMY_TYPES client (es. cubicle)
                const overrideData = { hp: e.maxHp || e.hp || 100, radius: e.radius || 8, color: e.color || '#ffffff', name: e.type };
                enemy = new Enemy(e.x, e.y, e.type, overrideData);
                enemy.id = e.id; enemy.color = e.color; entityManager.addEntity(enemy);
            }
            enemy.targetX = e.x; enemy.targetY = e.y; enemy.targetAngle = e.angle; enemy.hp = e.hp; enemy.maxHp = e.maxHp;
            enemy.shield = e.shield ?? enemy.shield; enemy.maxShield = e.maxShield ?? enemy.maxShield; serverEntityIds.add('enemy_' + e.id);
        });
        this.serverState.turrets.forEach(t => {
            let turret = entityManager.entities.find(ent => ent instanceof Turret && ent.id === t.id);
            if (!turret) { turret = new Turret(t.x, t.y); turret.id = t.id; entityManager.addEntity(turret); }
            turret.targetAngle = t.angle || 0; serverEntityIds.add('turret_' + t.id);
        });
        this.serverState.resources.forEach(r => {
            let res = entityManager.entities.find(ent => ent instanceof Resource && ent.id === r.id);
            if (!res) { res = new Resource(r.x, r.y, r.value || 0, r.type); res.id = r.id; entityManager.addEntity(res); }
            res.targetX = r.x; res.targetY = r.y; res.quantity = r.quantity ?? r.value; res.itemName = r.itemName || r.type; res.rarity = r.rarity || 'common';
            res.isRare = !!r.isRare; res.color = r.color || '#ffffff'; res.value = r.value || 0; res.radius = r.radius || (r.isRare ? 12 : 8);
            serverEntityIds.add('res_' + r.id);
        });
        if (this.serverState.mines) {
            this.serverState.mines.forEach(m => {
                let mine = entityManager.entities.find(e => e instanceof Mine && e.id === m.id);
                if (!mine) { mine = new Mine(m.x, m.y, m.mineType, m.color, m.ownerFaction); mine.id = m.id; entityManager.addEntity(mine); }
                if (m.age !== undefined) mine.age = m.age; serverEntityIds.add('mine_' + m.id);
            });
        }
        // ── Cargo Box ────────────────────────────────────────────────────
        if (this.serverState.cargoBoxes) {
            this.serverState.cargoBoxes.forEach(b => {
                let box = entityManager.entities.find(e => e instanceof CargoBox && e.id === b.id);
                if (!box) { box = new CargoBox(b.x, b.y); box.id = b.id; entityManager.addEntity(box); }
                box.x = b.x; box.y = b.y;
                if (b.age !== undefined) box.age = b.age;
                if (b.radius !== undefined) box.radius = b.radius;
                serverEntityIds.add('cbox_' + b.id);
            });
        }
        this.serverState.projectiles.forEach(p => {
            let proj = entityManager.entities.find(ent => ent instanceof Projectile && ent.id === p.id);
            if (!proj) { 
                proj = new Projectile(p.x, p.y, p.angle, 0, 0, false, p.color, p.thickness, p.isTurretShot); 
                proj.id = p.id; 
                entityManager.addEntity(proj); 
                
                if (p.isTurretShot) {
                    let nearestTurret = null; let minDist = Infinity;
                    entityManager.entities.forEach(ent => {
                        if (ent instanceof Turret) {
                            let dSq = (ent.x - p.x)**2 + (ent.y - p.y)**2;
                            if (dSq < minDist) { minDist = dSq; nearestTurret = ent; }
                        }
                    });
                    if (nearestTurret && minDist < 10000) nearestTurret.recoil = 1.0;
                }
                
                // ── AUDIO 3D SPAZIALE: Laser di bot, altri player e torrette ──
                if (typeof window.playSfx === 'function') {
                    // Calcola la distanza dal proiettile alla nave del giocatore locale
                    const distSq = (p.x - this.player.x)**2 + (p.y - this.player.y)**2;
                    const maxDistSq = 1600 * 1600; // Distanza massima in cui l'audio è udibile
                    
                    if (distSq < maxDistSq) {
                        const dist = Math.sqrt(distSq);
                        // Volume scala in modo inversamente proporzionale alla distanza
                        // 1.0 (massimo) a 0px, scende fino a 0.05 a 1600px
                        let spatialVolume = 1.0 - (dist / 1600);
                        if (spatialVolume < 0.05) spatialVolume = 0.05;
                        
                        // Chiama playSfx con un parametro aggiuntivo per forzare il volume
                        if (p.isTurretShot) {
                            window.playSfx('audio/laser_torrette_base.mp3', spatialVolume);
                        } else if (p.ammoType === 'sab') {
                            window.playSfx('audio/minizioni_SAB.mp3', spatialVolume);
                        } else {
                            let playbackRate = 1.0;
                            let volModifier = 1.0;
                            if (p.ammoType === 'x2') { playbackRate = 0.9; volModifier = 1.1; }
                            else if (p.ammoType === 'x3') { playbackRate = 0.8; volModifier = 1.2; }
                            else if (p.ammoType === 'x4') { playbackRate = 0.7; volModifier = 1.4; }
                            window.playSfx('audio/laser_x1.mp3', spatialVolume * volModifier, playbackRate);
                        }
                    }
                }
            }
            proj.targetX = p.x; proj.targetY = p.y; proj.angle = p.angle;
            proj.thickness = p.thickness || proj.thickness || 2;
            proj.isFullSlots = p.isFullSlots || false;
            proj.isTurretShot = p.isTurretShot || false;
            proj.isMissile = p.isMissile || false;
            proj.missileType = p.missileType || null;
            proj.ammoType = p.ammoType || 'x1';
            serverEntityIds.add('proj_' + p.id);
        });
        entityManager.entities.forEach(ent => {
            if (ent === this.player || ent instanceof BaseStation || ent instanceof Portal || ent instanceof Particle) return;
            let key = null;
            if (ent instanceof OtherPlayer) key = ent.id; else if (ent instanceof Enemy) key = 'enemy_' + ent.id; else if (ent instanceof Turret) key = 'turret_' + ent.id;
            else if (ent instanceof Resource) key = 'res_' + ent.id; else if (ent instanceof Projectile) key = 'proj_' + ent.id; else if (ent instanceof Mine) key = 'mine_' + ent.id;
            else if (typeof CargoBox !== 'undefined' && ent instanceof CargoBox) key = 'cbox_' + ent.id;
            if (key && !serverEntityIds.has(key)) {
                ent.isDead = true; const distSq = (ent.x - this.player.x)**2 + (ent.y - this.player.y)**2;
                
                if (ent instanceof Projectile && ent.isMissile && distSq < 1500 * 1500) {
                    if (typeof window.playSfx === 'function') window.playSfx('audio/esplosione_missile_impatto.mp3', 0.6);
                }
                
                if (distSq < 2000 * 2000 && (ent instanceof Enemy || ent instanceof OtherPlayer)) {
                    if (typeof window.playSfx === 'function') {
                        if (ent instanceof Enemy) {
                            if (ent.maxHp > 30000) window.playSfx('audio/esplosione_alieni_grandi.mp3', 0.8);
                            else window.playSfx('audio/esplosione_alieni_piccoli.mp3', 0.6);
                        } else if (ent instanceof OtherPlayer) {
                            window.playSfx('audio/esplosione_astronave.mp3', 0.8);
                        }
                    }
                    const rad = ent.radius || 20; let baseColor = '#94a3b8';
                    if (ent instanceof OtherPlayer && ent.shipType && ITEMS.ships && ITEMS.ships[ent.shipType]) baseColor = ITEMS.ships[ent.shipType].color;
                    else if (ent instanceof Enemy) baseColor = ent.color || '#94a3b8';
                    // Frammenti di scafo
                    const scaleFactor = Math.max(0.4, Math.min(2.5, rad / 25));
                    const debrisCount = Math.floor(8 * scaleFactor);
                    for(let i=0; i<debrisCount; i++) {
                        const color = Math.random() > 0.5 ? baseColor : '#334155'; 
                        const p = new Particle(ent.x + (Math.random()-0.5)*rad, ent.y + (Math.random()-0.5)*rad, color, true);
                        p.vx = (Math.random() - 0.5) * 250 * scaleFactor; p.vy = (Math.random() - 0.5) * 250 * scaleFactor; 
                        p.life = 2.0 + Math.random() * 2.0; p.size = (4 + Math.random() * 6) * scaleFactor; entityManager.addEntity(p);
                    }
                    const sparkCount = Math.floor(30 * scaleFactor);
                    for(let i=0; i<sparkCount; i++) {
                        const color = ent.color || (Math.random() > 0.5 ? '#ef4444' : '#f97316'); 
                        const p = new Particle(ent.x + (Math.random()-0.5)*rad, ent.y + (Math.random()-0.5)*rad, color);
                        p.vx = (Math.random() - 0.5) * 450 * scaleFactor; p.vy = (Math.random() - 0.5) * 450 * scaleFactor; 
                        p.life = 0.6 + Math.random() * 0.8; p.size = (2 + Math.floor(Math.random() * 4)) * scaleFactor; entityManager.addEntity(p);
                    }
                }
            }
        });
        
        // ── AUDIO 3D AMBIENTALE: Cubikon Background ──
        let cubikonNearby = false;
        let minCubikonDistSq = Infinity;
        if (this.serverState && this.serverState.enemies) {
            this.serverState.enemies.forEach(e => {
                if (e.type === 'cubikon') {
                    const dSq = (e.x - this.player.x)**2 + (e.y - this.player.y)**2;
                    if (dSq < 4500 * 4500) {
                        cubikonNearby = true;
                        if (dSq < minCubikonDistSq) minCubikonDistSq = dSq;
                    }
                }
            });
        }
        
        if (typeof window.playLoopSfx === 'function' && typeof window.updateLoopVolume === 'function') {
            if (cubikonNearby) {
                let vol = 1.0 - Math.sqrt(minCubikonDistSq) / 4500;
                if (vol < 0.1) vol = 0.1;
                if (!window._cubikonLoopPlaying) {
                    window.playLoopSfx('cubikon_bg', 'audio/boss_cubikon_backgound.mp3', vol * 0.8);
                    window._cubikonLoopPlaying = true;
                } else {
                    window.updateLoopVolume('cubikon_bg', vol * 0.8);
                }
            } else {
                if (window._cubikonLoopPlaying) {
                    if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('cubikon_bg', 1000);
                    window._cubikonLoopPlaying = false;
                }
            }
        }
        
        // ── AUDIO 3D AMBIENTALE: Low HP Loop ──
        if (typeof window.playLoopSfx === 'function' && typeof window.stopLoopSfx === 'function') {
            if (!this.player.isDead && this.player.maxHp > 0 && (this.player.hp / this.player.maxHp) < 0.25) {
                if (!window._lowHpLoopPlaying) {
                    window.playLoopSfx('low_hp_loop', 'audio/hp_sotto_al25%.mp3', 0.8);
                    window._lowHpLoopPlaying = true;
                }
            } else {
                if (window._lowHpLoopPlaying) {
                    window.stopLoopSfx('low_hp_loop', 500);
                    window._lowHpLoopPlaying = false;
                }
            }
        }
    }

    sendMove(x, y, angle, isRegenerating = false, isShieldRegen = false, sprintExhausted = false, empInvulnerable = false, slowDebuffColor = null, isSprinting = false, isCargoFull = false) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'move', x, y, angle, isRegenerating, isShieldRegen, sprintExhausted, empInvulnerable, slowDebuffColor, isSprinting, isCargoFull }));
    }

    // ── PET sync: invia posizione PET al server ogni frame (throttled) ───
    sendPetSync(x, y, angle) {
        const now = Date.now();
        if (!this._lastPetSync || now - this._lastPetSync >= 50) { // ~20fps, leggero
            this._lastPetSync = now;
            if (this.connected && this.ws.readyState === WebSocket.OPEN)
                this.ws.send(JSON.stringify({ type: 'petSync', x, y, angle }));
        }
    }

    sendPetDeactivate() {
        if (this.connected && this.ws.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify({ type: 'petDeactivate' }));
    }

    register(username, password, faction) {
        const ws = new WebSocket(this.url); ws.onopen = () => ws.send(JSON.stringify({ type: 'register', username, password, faction }));
        ws.onmessage = (event) => { try { const data = JSON.parse(event.data); this.handleMessage(data); } catch(e) {} ws.close(); };
    }

    sendChangeMap(mapName) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'changeMap', map: mapName })); }
    sendShoot(angle, laserColor, damage, startX, startY, thickness = 2, targetId = null, extra = {}) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'shoot', angle, laserColor, damage, x: startX, y: startY, thickness, targetId, ...extra })); }
    sendPlaceMine(x, y, mineType) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'placeMine', x, y, mineType })); }
    sendEMP(x, y, range) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'emp', x, y, range })); }
    sendSmartBomb(x, y, aoeRadius, damage) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'smartBomb', x, y, aoeRadius, damage })); }
    sendUpdateStats(hp, maxHp, shipType, drones) { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'updateStats', hp, maxHp, shipType, drones })); }
    sendSyncFullState() {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            const state = { 
                x: this.player.x, y: this.player.y, 
                map: mapManager.currentMap, 
                hp: this.player.hp, 
                shield: this.player.shield,
                maxShield: this.player.maxShield,
                shipType: this.player.shipType, 
                faction: this.player.faction, 
                credits: this.player.credits, uridium: this.player.uridium, 
                cargo: this.player.cargo, maxCargo: this.player.maxCargo || 100, 
                materials: this.player.materials, 
                inventory: this.player.inventory, configs: this.player.configs, 
                activeConfig: this.player.activeConfig, 
                lootCargo: this.player.lootCargo || {}, 
                score: this.player.score || 0, kills: this.player.kills || 0, deaths: this.player.deaths || 0, 
                ammo: this.player.ammo, missileAmmo: this.player.missileAmmo, mineAmmo: this.player.mineAmmo, empAmmo: this.player.empAmmo 
            };
            this.ws.send(JSON.stringify({ type: 'syncFullState', state }));
        }
    }
    requestLeaderboard() { if (this.connected && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'getLeaderboard' })); }

    sendUpdatePilotSkills(pilotSkills) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify({ type: 'updatePilotSkills', pilotSkills }));
    }
}
