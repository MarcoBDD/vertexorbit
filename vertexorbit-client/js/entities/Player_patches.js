// ============================================================
// Player_patches.js — Patch per Player.js:
// - shootLaser: consuma munizioni per numero di laser
// - useEMP: invulnerabilita + particelle elettriche
// - takeDamage: logica scudo 80/20
// - Risposta a empInvulnStart/empInvulnEnd dal server
// Questo file sovrascrive i metodi dopo che Player.js e' caricato.
// ============================================================

// Aspetta che Player sia definita
(function patchPlayer() {
    if (typeof Player === 'undefined') {
        setTimeout(patchPlayer, 50);
        return;
    }

    // ── PATCH 1: shootLaser — consuma munizioni + logica FASE 3 ──────────
    Player.prototype.shootLaser = function(target) {
        if (typeof window.playSfx === 'function') {
            window.playSfx('audio/laser_x1.mp3');
        }
        const ammoType = this.ammo ? this.ammo.laserAmmo : 'x1';
        const ammoDef  = ITEMS.laserAmmo ? ITEMS.laserAmmo[ammoType] : null;

        // Conta laser totali (nave + droni + pet) per consumo munizioni
        const laserCount = (() => {
            let c = 0;
            (this.equipped.lasers    || []).forEach(l  => { if (l && ITEMS.lasers?.[l]) c++; });
            (this.equipped.droneItems|| []).forEach(arr => (arr||[]).forEach(i => { if (i && ITEMS.lasers?.[i]) c++; }));
            (this.equipped.petItems  || []).forEach(i  => { if (i && ITEMS.lasers?.[i]) c++; });
            return Math.max(1, c);
        })();

        // Consuma munizioni
        if (ammoType !== 'x1' && ammoDef && this.ammo && this.ammo.counts) {
            const available = this.ammo.counts[ammoType] || 0;
            if (available < laserCount) {
                this.ammo.laserAmmo = 'x1';
            } else {
                this.ammo.counts[ammoType] -= laserCount;
            }
        }

        const baseDamage  = this.getTotalDamage();
        const multiplier  = ammoDef ? (ammoDef.multiplier || 1) : 1;
        const isSab       = ammoType === 'sab';
        const finalDamage = isSab ? 0 : Math.floor(baseDamage * multiplier);

        // ── Calcolo colore + spessore FASE 3 ─────────────────────────────
        let laserColor     = ammoDef ? (ammoDef.color || '#5EEAD4') : '#5EEAD4';
        let laserThickness = 2;
        let isFullSlots    = false;

        if (!isSab) {
            // Slot laser sulla nave
            const maxShipSlots = ITEMS.ships[this.shipType].laserSlots || 1;
            const shipLasers = this.equipped.lasers
                ? this.equipped.lasers.filter(l => l && ITEMS.lasers && ITEMS.lasers[l])
                : [];
            // Laser sui droni
            const droneLasers = [];
            if (this.equipped.droneItems) {
                this.equipped.droneItems.forEach(arr => {
                    (arr || []).forEach(item => {
                        if (item && ITEMS.lasers && ITEMS.lasers[item]) droneLasers.push(item);
                    });
                });
            }
            const allLasers = [...shipLasers, ...droneLasers];
            const countLf4  = allLasers.filter(l => l === 'lf4').length;
            const countLf3  = allLasers.filter(l => l === 'lf3').length;

            // FASE 3: tutti gli slot laser NAVE occupati
            if (shipLasers.length >= maxShipSlots) {
                laserThickness = 4;
                isFullSlots    = true;
                if (countLf4 > 0 && countLf4 === allLasers.length)       laserColor = '#ff0000';
                else if (countLf3 > 0 && countLf3 === allLasers.length)  laserColor = '#00ff44';
                else                                                      laserColor = '#ffffff';
            } else if (allLasers.length > 0) {
                const hasLf4 = countLf4 > 0, hasLf3 = countLf3 > 0;
                if      (hasLf4 && !hasLf3) laserColor = '#ff0000';
                else if (hasLf3 && !hasLf4) laserColor = '#0044ff';
                else if (hasLf4 || hasLf3)  laserColor = '#d946ef';
            }
            // Colore ammo sovrascrive solo se NON siamo in FASE 3
            if (!isFullSlots && ammoType !== 'x1' && ammoDef) laserColor = ammoDef.color;
        }

        if (typeof wsClient !== 'undefined' && typeof wsClient.sendShoot === 'function') {
            wsClient.sendShoot(this.angle, laserColor, finalDamage, this.x, this.y, laserThickness,
                target ? target.id : null,
                { ammoType, sabPct: isSab ? (ammoDef?.stealPct || 0.08) : 0, isFullSlots });
        }
    };

    // ── PATCH 2: useEMP — invulnerabilita + particelle elettriche ────────
    Player.prototype.useEMP = function() {
        const now = Date.now() / 1000;
        const cd  = ITEMS.emp && ITEMS.emp['emp-01'] ? ITEMS.emp['emp-01'].cooldown : 20;
        if (now - this.lastEmpTime < cd) {
            console.log('[EMP] Cooldown: ' + Math.ceil(cd - (now - this.lastEmpTime)) + 's'); return;
        }
        if (!this.empAmmo || !this.empAmmo.counts || !this.empAmmo.counts['emp-01'] || this.empAmmo.counts['emp-01'] <= 0) {
            console.log('[EMP] Esaurito'); return;
        }
        this.empAmmo.counts['emp-01']--;
        this.lastEmpTime = now;
        // Azzera tutti i target locali
        if (typeof inputManager !== 'undefined') {
            inputManager.targetEntity = null;
            inputManager.isShooting   = false;
        }
        // Invulnerabilita locale (il server sovrascrivera con la durata precisa)
        this.empInvulnerable = true;
        this.empInvulnTimer  = 3.5;
        if (!this.empParticles) this.empParticles = [];
        if (typeof wsClient !== 'undefined' && typeof wsClient.sendEMP === 'function') {
            wsClient.sendEMP(this.x, this.y, ITEMS.emp['emp-01'].range || 400);
        }
        // Particelle burst iniziale
        if (typeof entityManager !== 'undefined') {
            for (let i = 0; i < 32; i++) {
                const angle = (i / 32) * Math.PI * 2;
                const p = new Particle(this.x + Math.cos(angle)*8, this.y + Math.sin(angle)*8, '#22d3ee');
                p.vx = Math.cos(angle) * (200 + Math.random() * 300);
                p.vy = Math.sin(angle) * (200 + Math.random() * 300);
                p.life = 0.5 + Math.random() * 0.5;
                entityManager.addEntity(p);
            }
        }
    };

    // ── PATCH 3: takeDamage — logica scudo 80/20 + Deformazione Direzionale ──
    Player.prototype.takeDamage = function(amount, hitX, hitY) {
        if (this.empInvulnerable) return; // invulnerabile EMP
        this.lastDamageTime = Date.now() / 1000;
        
        // Calcola direzione dell'impatto se abbiamo le coordinate
        if (hitX !== undefined && hitY !== undefined) {
            const dx = hitX - this.x;
            const dy = hitY - this.y;
            const hitAngle = Math.atan2(dy, dx);
            
            if (!this.shieldHits) this.shieldHits = [];
            this.shieldHits.push({ angle: hitAngle, age: 0, life: 0.5, intensity: 1.0 });
        }
        
        if (this.maxShield > 0 && this.shield > 0) {
            // 80% del danno va allo scudo, 20% agli HP
            const shieldPart = Math.floor(amount * 0.8);
            const hpPart     = amount - shieldPart;
            const absorbed   = Math.min(this.shield, shieldPart);
            const overflow   = shieldPart - absorbed;
            this.shield      = Math.max(0, this.shield - shieldPart);
            this.hp         -= (hpPart + overflow);
        } else {
            this.hp -= amount;
        }
        if (this.hp <= 0 && !this.isDead) {
            this.die();
        }
    };

    // ── PATCH 4: update EMP — tick timer invulnerabilita ─────────────────
    const _origUpdate = Player.prototype.update;
    Player.prototype.update = function(deltaTime) {
        // Aggiorna timer EMP invulnerabilita
        if (this.empInvulnerable && this.empInvulnTimer > 0) {
            this.empInvulnTimer -= deltaTime;
            if (this.empInvulnTimer <= 0) {
                this.empInvulnerable = false;
                this.empInvulnTimer  = 0;
            }
        }
        // Genera particelle elettriche pixel durante EMP
        if (this.empInvulnerable) {
            if (!this.empParticles) this.empParticles = [];
            if (Math.random() < 0.65) {
                const angle  = Math.random() * Math.PI * 2;
                const radius = this.radius + 4 + Math.random() * 22;
                this.empParticles.push({
                    x: this.x + Math.cos(angle) * radius,
                    y: this.y + Math.sin(angle) * radius,
                    vx: (Math.random()-0.5)*60, vy: (Math.random()-0.5)*60,
                    life: 0.12 + Math.random()*0.22, age: 0,
                    color: Math.random()<0.55 ? '#22d3ee' : (Math.random()<0.5 ? '#ffffff' : '#a5f3fc'),
                    size: 2 + Math.floor(Math.random()*3)
                });
            }
            // Aggiorna particelle EMP
            if (this.empParticles) {
                for (let i = this.empParticles.length-1; i >= 0; i--) {
                    const ep = this.empParticles[i];
                    ep.x += ep.vx * deltaTime; ep.y += ep.vy * deltaTime;
                    ep.age += deltaTime;
                    if (ep.age >= ep.life) this.empParticles.splice(i, 1);
                }
            }
        }
        _origUpdate.call(this, deltaTime);
    };

    // ── PATCH 5: draw — aggiunge rendering EMP sopra la nave ─────────────
    const _origDraw = Player.prototype.draw;
    Player.prototype.draw = function(ctx) {
        _origDraw.call(this, ctx);
        // Particelle elettriche EMP sopra tutto il resto
        if (this.empInvulnerable && this.empParticles && this.empParticles.length > 0) {
            for (const ep of this.empParticles) {
                ctx.globalAlpha = Math.max(0, 1 - ep.age/ep.life) * 0.9;
                ctx.fillStyle = ep.color;
                ctx.fillRect(Math.round(ep.x)-ep.size/2, Math.round(ep.y)-ep.size/2, ep.size, ep.size);
            }
            ctx.globalAlpha = 1;
            // Alone EMP pulsante
            const empPulse = 0.3 + 0.5*Math.abs(Math.sin(Date.now()/80));
            ctx.strokeStyle = `rgba(34,211,238,${empPulse})`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4,3]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 18, 0, Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([]);
            // Timer countdown
            ctx.fillStyle = '#22d3ee';
            ctx.font = 'bold 10px "Courier New",monospace';
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.9;
            ctx.fillText('EMP ' + this.empInvulnTimer.toFixed(1) + 's', this.x, this.y - this.radius - 22);
            ctx.globalAlpha = 1;
        }
    };

    console.log('[PATCH] Player.js patches applicate: shootLaser, useEMP, takeDamage, EMP invulnerabilita');
})();
