class PET extends Entity {
    constructor(owner) {
        super(owner.x + 50, owner.y + 50);
        this.owner = owner;
        this.radius = 12;
        this.speed = owner.speed * 0.65;
        this.baseSpeed = owner.speed * 0.65;
        this.mode = 'auto-loot';
        this.angle = 0;
        this.targetRes = null;
        this.lastShotTime = 0;
        this.fireRate = 0.5;
        this.lootCooldown = 0;
        this.idleOffsetX = 70;
        this.idleOffsetY = 0;
        this.nextIdleMoveTime = 0;
        this.isWaiting = false;

        // Stati sincronizzati dal server (se esteso in futuro)
        this.isRegenerating = false;
        this.isShieldRegen = false;
    }
    
    updateIdlePattern(now) {
        if (now > this.nextIdleMoveTime) {
            if (this.isWaiting) {
                this.isWaiting = false;
                const angle = Math.random() * Math.PI * 2;
                const dist = 50 + Math.random() * 80;
                this.idleOffsetX = Math.cos(angle) * dist;
                this.idleOffsetY = Math.sin(angle) * dist;
                this.nextIdleMoveTime = now + 1.0 + Math.random() * 2.0;
            } else {
                this.isWaiting = true;
                this.nextIdleMoveTime = now + 0.5 + Math.random() * 2.0;
            }
        }
    }

    update(deltaTime) {
        // Se il PET appartiene a un OtherPlayer, seguiamo le coordinate target ricevute dal server
        // Se appartiene al Player locale, manteniamo la logica di predizione/AI locale
        const isLocalPlayerPet = (this.owner instanceof Player);

        if (!isLocalPlayerPet) {
            // PET di un altro giocatore: segue semplicemente il padrone con lerp
            this.x += (this.owner.x - this.x) * 5 * deltaTime;
            this.y += (this.owner.y - this.y) * 5 * deltaTime;
            this.angle = this.owner.angle;
            super.update(deltaTime);
            return;
        }

        super.update(deltaTime);
        let targetX = this.owner.x;
        let targetY = this.owner.y;
        const now = Date.now() / 1000;
        let currentSpeed = this.baseSpeed;
        
        if (this.mode === 'auto-loot') {
            if (now < this.lootCooldown) {
                targetX = this.x;
                targetY = this.y;
            } else {
                if (!this.targetRes || this.targetRes.isCollected || !entityManager.entities.includes(this.targetRes)) {
                    this.targetRes = null;
                    let closest = null;
                    let minDist = 750;
                    entityManager.entities.forEach(e => {
                        if (e instanceof Resource && !e.isCollected) {
                            const dist = Math.sqrt((e.x - this.owner.x)**2 + (e.y - this.owner.y)**2);
                            if (dist < minDist) {
                                minDist = dist;
                                closest = e;
                            }
                        }
                    });
                    if (closest) this.targetRes = closest;
                }
                
                if (this.targetRes) {
                    targetX = this.targetRes.x;
                    targetY = this.targetRes.y;
                    currentSpeed = this.owner.speed * 0.45;
                    const distToRes = Math.sqrt((targetX - this.x)**2 + (targetY - this.y)**2);
                    if (distToRes < this.targetRes.radius + this.radius + 20) {
                        if (typeof wsClient !== 'undefined' && wsClient.connected) {
                            wsClient.ws.send(JSON.stringify({ type: 'collect', id: this.targetRes.id }));
                        }
                        this.targetRes.isCollected = true;
                        this.targetRes = null;
                        this.lootCooldown = now + 1.0;
                        targetX = this.x;
                        targetY = this.y;
                    }
                } else {
                    this.updateIdlePattern(now);
                    targetX = this.owner.x + this.idleOffsetX;
                    targetY = this.owner.y + this.idleOffsetY;
                }
            }
        } else {
            this.updateIdlePattern(now);
            targetX = this.owner.x + this.idleOffsetX;
            targetY = this.owner.y + this.idleOffsetY;
        }
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            this.x += (dx/dist) * currentSpeed * deltaTime;
            this.y += (dy/dist) * currentSpeed * deltaTime;
            this.angle = Math.atan2(dy, dx);
        } else if (this.isWaiting && !this.targetRes) {
            let angleToOwner = Math.atan2(this.owner.y - this.y, this.owner.x - this.x);
            let angleDiff = angleToOwner - this.angle;
            while(angleDiff < -Math.PI) angleDiff += Math.PI*2;
            while(angleDiff > Math.PI) angleDiff -= Math.PI*2;
            this.angle += angleDiff * 5 * deltaTime;
        }
        
        if (typeof inputManager !== 'undefined' && inputManager.targetEntity && inputManager.isShooting) {
            const tdx = inputManager.targetEntity.x - this.x;
            const tdy = inputManager.targetEntity.y - this.y;
            if (Math.sqrt(tdx*tdx + tdy*tdy) <= 600) {
                this.angle = Math.atan2(tdy, tdx);
                if (now - this.lastShotTime > this.fireRate) {
                    this.shootLaser(inputManager.targetEntity);
                    this.lastShotTime = now;
                }
            }
        }

        // ── Sincronizza posizione PET al server (per broadcast a tutti i player) ─
        if (typeof wsClient !== 'undefined' && wsClient.connected) {
            wsClient.sendPetSync(this.x, this.y, this.angle);
        }
    }
    
    shootLaser(target) {
        let baseDamage = 50;
        let laserColor = '#10B981';
        
        // Calculate dynamic damage based on PET type and equipped lasers
        if (this.owner && this.owner.equipped && this.owner.equipped.pets && this.owner.equipped.pets[0]) {
            const petId = this.owner.equipped.pets[0];
            if (typeof ITEMS !== 'undefined' && ITEMS.pets[petId]) {
                baseDamage = ITEMS.pets[petId].damage || 50;
                if (petId === 'pet-20') laserColor = '#3B82F6';
                if (petId === 'pet-30') laserColor = '#F97316';
            }
            
            // Add damage from equipped PET lasers
            if (this.owner.equipped.petItems) {
                this.owner.equipped.petItems.forEach(itemId => {
                    if (itemId && typeof ITEMS !== 'undefined' && ITEMS.lasers[itemId]) {
                        baseDamage += ITEMS.lasers[itemId].damage || 0;
                    }
                });
            }
        }
        
        if (typeof wsClient !== 'undefined' && typeof wsClient.sendShoot === 'function') {
            wsClient.sendShoot(this.angle, laserColor, baseDamage, this.x, this.y, 2, target ? target.id : null);
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        let c1='#10B981', c2='#059669', c3='#6EE7B7', c4='#34D399';
        if (this.owner && this.owner.equipped && this.owner.equipped.pets && this.owner.equipped.pets[0]) {
            const petId = this.owner.equipped.pets[0];
            if(petId === 'pet-20'){ c1='#3B82F6'; c2='#1D4ED8'; c3='#93C5FD'; c4='#60A5FA'; }
            if(petId === 'pet-30'){ c1='#F97316'; c2='#C2410C'; c3='#FDBA74'; c4='#FB923C'; }
        }

        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.lineTo(0, -8); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.fill();
        ctx.fillStyle = c3; ctx.fillRect(-4, -12, 6, 4); ctx.fillRect(-4, 8, 6, 4);
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(2, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = (Date.now() % 200 < 100) ? c4 : c3;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-12, -4); ctx.lineTo(-10, 0); ctx.lineTo(-12, 4); ctx.fill();
        ctx.restore();
    }
}
