class OtherPlayer extends Entity {
    constructor(x, y, id, shipType) {
        super(x, y, 40, 40);
        this.id = id;
        this.shipType = shipType;
        this.targetX = x;
        this.targetY = y;
        this.targetAngle = 0;
        this.angle = 0;
        this.formationAngle = 0;
        this.hp = 1000;
        this.maxHp = 1000;
        this.radius = 20;
        this.equipped = { drones: [] };
        this.isRegenerating = false;
        this.isShieldRegen = false;
        this.sprintExhausted = false;
        this.empInvulnerable = false;
        this.slowDebuffColor = null;
        this.isSprinting = false;
        this.isCargoFull = false;
        this.sprintParticles = [];
        this.cargoParticles = [];
        this.shieldParticles = [];
        this.waveParticles = [];
        // Impatti sullo scudo sincronizzati dal server via animEvent
        this.shieldHits = [];
    }

    update(deltaTime) {
        // Lerp per movimento fluido
        this.x += (this.targetX - this.x) * 10 * deltaTime;
        this.y += (this.targetY - this.y) * 10 * deltaTime;
        
        // Lerp angolare (semplificato)
        let diff = this.targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * 10 * deltaTime;
        
        let fDiff = this.angle - this.formationAngle;
        while (fDiff < -Math.PI) fDiff += Math.PI * 2;
        while (fDiff > Math.PI) fDiff -= Math.PI * 2;
        this.formationAngle += fDiff * 5 * deltaTime;

        // Tick impatti scudo
        if (this.shieldHits) {
            for (let i = this.shieldHits.length - 1; i >= 0; i--) {
                this.shieldHits[i].age += deltaTime;
                if (this.shieldHits[i].age >= this.shieldHits[i].life) this.shieldHits.splice(i, 1);
            }
        }

        // Tick timer debuff slow client-side (backup in caso di ritardo worldUpdate)
        if (this._slowDebuffTimer > 0) {
            this._slowDebuffTimer -= deltaTime;
            if (this._slowDebuffTimer <= 0) {
                this._slowDebuffTimer = 0;
                this.slowDebuffColor = null;
                this.waveParticles = [];
            }
        }

        // Particelle scudo
        if (this.isShieldRegen) {
            if (Math.random() < 0.25) {
                const angle = Math.random() * Math.PI * 2;
                const orbitR = this.radius + 14 + Math.random() * 10;
                this.shieldParticles.push({
                    angle, orbitR,
                    speed: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.5),
                    life: 0.6 + Math.random() * 0.6,
                    age: 0,
                    size: 2 + Math.floor(Math.random() * 3),
                    color: Math.random() < 0.6 ? '#38bdf8' : (Math.random() < 0.5 ? '#7dd3fc' : '#e0f2fe')
                });
            }
        }
        for (let i = this.shieldParticles.length - 1; i >= 0; i--) {
            const p = this.shieldParticles[i];
            p.age += deltaTime;
            p.angle += p.speed * deltaTime;
            if (p.age >= p.life) this.shieldParticles.splice(i, 1);
        }

        // Particelle Debuff Rallentamento
        if (this.slowDebuffColor) {
            if (Math.random() < 0.4) {
                this.waveParticles.push({
                    x: this.x + (Math.random() - 0.5) * 10,
                    y: this.y + (Math.random() - 0.5) * 10,
                    radius: 4 + Math.random() * 6,
                    maxRadius: 28 + Math.random() * 20,
                    alpha: 0.85,
                    age: 0,
                    life: 0.8 + Math.random() * 0.6,
                    phase: Math.random() * Math.PI * 2
                });
            }
        }
        for (let i = this.waveParticles.length - 1; i >= 0; i--) {
            const p = this.waveParticles[i];
            p.age += deltaTime;
            p.radius += (p.maxRadius - p.radius) * 5 * deltaTime;
            p.alpha = Math.max(0, 1 - p.age / p.life);
            if (p.age >= p.life) this.waveParticles.splice(i, 1);
        }

        // ── Particelle Sprint ─────────────────────────────────────────────
        if (this.isSprinting) {
            if (Math.random() < 0.5) {
                const angle = Math.random() * Math.PI * 2;
                this.sprintParticles.push({
                    x: this.x + (Math.random() - 0.5) * this.radius,
                    y: this.y + (Math.random() - 0.5) * this.radius,
                    vx: Math.cos(angle) * (60 + Math.random() * 80),
                    vy: Math.sin(angle) * (60 + Math.random() * 80),
                    life: 0.3 + Math.random() * 0.3,
                    age: 0,
                    size: 2 + Math.floor(Math.random() * 3),
                    color: Math.random() < 0.5 ? '#f43f5e' : '#fb923c'
                });
            }
        }
        for (let i = this.sprintParticles.length - 1; i >= 0; i--) {
            const p = this.sprintParticles[i];
            p.age += deltaTime;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            if (p.age >= p.life) this.sprintParticles.splice(i, 1);
        }

        // ── Particelle Cargo Pieno ────────────────────────────────────────
        if (this.isCargoFull) {
            if (Math.random() < 0.3) {
                const angle = Math.random() * Math.PI * 2;
                const r = this.radius + 8 + Math.random() * 10;
                this.cargoParticles.push({
                    x: this.x + Math.cos(angle) * r,
                    y: this.y + Math.sin(angle) * r,
                    life: 0.5 + Math.random() * 0.5,
                    age: 0,
                    size: 2 + Math.floor(Math.random() * 3),
                    color: Math.random() < 0.6 ? '#f59e0b' : '#fbbf24'
                });
            }
        }
        for (let i = this.cargoParticles.length - 1; i >= 0; i--) {
            const p = this.cargoParticles[i];
            p.age += deltaTime;
            if (p.age >= p.life) this.cargoParticles.splice(i, 1);
        }
    }

    draw(ctx) {
        // ── PET sincronizzato dal server — disegnalo con lerp fluido ─────
        if (this.pet && this.pet.active) {
            // Lerp lato client sulla posizione server per smoothing visivo
            if (this.pet.renderX === undefined) { this.pet.renderX = this.pet.x; this.pet.renderY = this.pet.y; this.pet.renderAngle = this.pet.angle; }
            this.pet.renderX += (this.pet.x - this.pet.renderX) * 0.25;
            this.pet.renderY += (this.pet.y - this.pet.renderY) * 0.25;
            let aDiff = this.pet.angle - this.pet.renderAngle;
            while (aDiff < -Math.PI) aDiff += Math.PI * 2;
            while (aDiff > Math.PI) aDiff -= Math.PI * 2;
            this.pet.renderAngle += aDiff * 0.25;

            ctx.save();
            ctx.translate(this.pet.renderX, this.pet.renderY);
            ctx.rotate(this.pet.renderAngle);

            // ── Design identico a PET.draw() ─────────────────────────────
            // Corpo principale
            ctx.fillStyle = '#10B981';
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.lineTo(0, -8); ctx.fill();
            // Ventre scuro
            ctx.fillStyle = '#059669';
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.fill();
            // Ali superiore e inferiore
            ctx.fillStyle = '#6EE7B7';
            ctx.fillRect(-4, -12, 6, 4);
            ctx.fillRect(-4, 8, 6, 4);
            // Occhio bianco
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(2, 0, 3, 0, Math.PI * 2); ctx.fill();
            // Propulsore posteriore lampeggiante
            ctx.fillStyle = (Date.now() % 200 < 100) ? '#34D399' : '#A7F3D0';
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-12, -4); ctx.lineTo(-10, 0); ctx.lineTo(-12, 4); ctx.fill();
            // ─────────────────────────────────────────────────────────────

            ctx.restore();
        }



        // ── Animazione scia a onde DEBUFF rallentamento ───────────────────────
        if (this.slowDebuffColor && this.waveParticles.length > 0) {            const col = this.slowDebuffColor;
            for (const p of this.waveParticles) {
                ctx.save();
                ctx.globalAlpha = p.alpha * 0.7;
                ctx.strokeStyle = col;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                const steps = 32;
                for (let s = 0; s <= steps; s++) {
                    const a = (s / steps) * Math.PI * 2;
                    const wave = Math.sin(a * 4 + p.phase + p.age * 6) * 3;
                    const r = p.radius + wave;
                    const px = p.x + Math.cos(a) * r;
                    const py = p.y + Math.sin(a) * r;
                    s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

    const isMoving = Math.abs(this.targetX - this.x) > 5 || Math.abs(this.targetY - this.y) > 5;    if (isMoving) {
        // Offset personalizzato per ogni nave
        let engOffset = -this.radius; 
        switch(this.shipType) {
            case 'phoenix': engOffset = -18; break;
            case 'liberator': engOffset = -15; break;
            case 'nostromo': engOffset = -24; break;
            case 'bigboy': engOffset = -30; break;
            case 'leonov': engOffset = -18; break;
            case 'vengeance': engOffset = -30; break;
            case 'goliath': engOffset = -30; break;
            case 'aegis': engOffset = -24; break;
            case 'spearhead': engOffset = -24; break;
            case 'citadel': engOffset = -36; break;
            case 'tartarus': engOffset = -30; break;
            case 'pusat': engOffset = -24; break;
        }

        if (this.sprintExhausted) {
            const flickerLen = 5 + Math.random() * 6;
            ctx.fillStyle = (Date.now() % 300 < 150) ? '#475569' : '#64748b';
            ctx.beginPath();
            ctx.moveTo(engOffset + 5, -3);
            ctx.lineTo(engOffset - flickerLen, 0);
            ctx.lineTo(engOffset + 5, 3);
            ctx.fill();
        } else {
            ctx.fillStyle = (Date.now() % 200 < 100) ? '#f43f5e' : '#fda4af'; // Propulsori rossi per i nemici
            ctx.beginPath();
            ctx.moveTo(engOffset + 5, -5);
            ctx.lineTo(engOffset - 15 - Math.random() * 10, 0);
            ctx.lineTo(engOffset + 5, 5);
            ctx.fill();
        }
    }

    const s = 6;
    const drawPix = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x*s, y*s, w*s, h*s); };
    const drawSymH = (x, y, w, h, c) => { drawPix(x, y, w, h, c); if (y !== 0) drawPix(x, -y - h, w, h, c); };
    // Gli OtherPlayer (nemici) hanno neon azzurro scuro per distinguersi, o rosso se nemici (ma qui usiamo un blu scuro per tutti gli estranei per ora)
    const neon = '#3B82F6'; 
    
    switch (this.shipType) {
        case 'phoenix': 
            // Caccia leggero base (tipo X-Wing chiuso)
            drawPix(-3,-1.5,6,3,'#64748B'); 
            drawSymH(-4,1.5,3,1,'#334155'); 
            drawPix(1,-0.5,3,1,neon); 
            drawSymH(-2,2.5,1,1,'#B45309'); // mini laser ai lati
            break;
            
        case 'liberator': 
            // Caccia a dardo (stile Jedi Starfighter)
            drawPix(-2,-1,5,2,'#64748B'); 
            drawSymH(-4,1,3,1,'#334155'); 
            drawSymH(-1,2,2,1,'#1E293B'); 
            drawPix(3,-0.5,3,1,neon); 
            break;
            
        case 'nostromo': 
            // Fregata industriale squadrata (stile Y-Wing massiccio)
            drawPix(-4,-2,8,4,'#334155'); 
            drawSymH(-2,2,6,1.5,'#1E293B'); 
            drawSymH(2,3.5,4,1,'#0F172A'); // piloni anteriori
            drawPix(-1,-1,4,2,neon); 
            break;
            
        case 'bigboy': 
            // Incrociatore corazzato tozzo (stile bombardiere pesante)
            drawPix(-5,-3.5,10,7,'#59280A'); 
            drawSymH(-3,3.5,8,2,'#311302'); 
            drawSymH(0,5.5,3,1.5,'#92400E'); // torrette laterali
            drawPix(2,-2,4,4,neon); 
            break;
            
        case 'leonov': 
            // Caccia intercettore alieno (forme curve/viola tipo Covenant/Tie Interceptor)
            drawPix(-3,-1.5,7,3,'#581C87'); 
            drawSymH(-2,1.5,3,1,'#3B0764'); 
            drawSymH(1,2.5,3,1.5,'#2E1065'); // ali a sciabola in avanti
            drawPix(2,-1,3,2,neon); 
            break;
            
        case 'vengeance': 
            // Caccia puro ad ala a delta (A-Wing / caccia stealth)
            drawPix(-4,-1.5,8,3,'#A16207'); 
            drawSymH(-5,1.5,4,2,'#713F12'); 
            drawSymH(-2,3.5,3,1.5,'#451A03'); // ali esterne arretrate
            drawPix(4,-0.5,2,1,neon); // cabina molto avanzata
            break;
            
        case 'goliath': 
            // Corazzata da battaglia principale (Star Destroyer in miniatura / incrociatore)
            drawPix(-5,-3,10,6,'#7F1D1D'); 
            drawSymH(-4,3,8,2,'#450A0A'); 
            drawSymH(-2,5,6,1.5,'#290505'); 
            drawSymH(2,6.5,2,1,'#DC2626'); // cannoni sporgenti
            drawPix(1,-1.5,4,3,neon); 
            break;
            
        case 'aegis': 
            // Nave di supporto medico/ingegneristico (forma a U o pinza, stile Nebulon-B ibrida)
            drawPix(-4,-2.5,7,5,'#14532D'); 
            drawSymH(1,2.5,4,2,'#064E3B'); // braccia estese in avanti
            drawSymH(-2,4.5,3,1.5,'#022C22'); // scudi laterali
            drawPix(-1,-1,3,2,neon); 
            break;
            
        case 'spearhead': 
            // Ricognitore stealth ultra-sottile (stile SR-71 Blackbird)
            drawPix(-2,-1,10,2,'#164E63'); 
            drawSymH(-4,1,4,1,'#083344'); 
            drawSymH(-1,2,2,0.5,'#042F2E'); 
            drawPix(5,-0.5,4,1,neon); // cabina a punta lunghissima
            break;
            
        case 'citadel': 
            // Fortezza volante colossale (forma a blocco/esagono, stile incrociatore imperiale pesante)
            drawPix(-6,-5,12,10,'#9A3412'); 
            drawSymH(-4,5,10,3,'#7C2D12'); 
            drawSymH(-2,8,8,2,'#431407'); // piastre armature aggiuntive estreme
            drawPix(4,-2,3,4,neon); 
            break;
            
        case 'tartarus': 
            // Caccia pesante d'assalto (Doppia fusoliera, stile Tie Bomber / pod racer corazzato)
            drawPix(-3,-1.5,8,3,'#991B1B'); // corpo centrale
            drawSymH(-5,3,9,2.5,'#7F1D1D'); // piloni massicci separati
            drawSymH(2,5.5,2,1.5,'#FCA5A5'); // armi sui piloni
            drawPix(3,-1,3,2,neon); 
            break;
            
        case 'pusat': 
            // Caccia intercettore leggero avanzato (forma a freccia estrema V-Shape)
            drawPix(-2,-1,8,2,'#9F1239'); 
            drawSymH(-4,1,5,1.5,'#881337'); 
            drawSymH(0,2.5,4,1,'#4C0519'); // ali proiettate in avanti acute
            drawPix(4,-0.5,3,1,neon); 
            break;
        default: drawPix(-2,-2,4,4,'#1E3A8A'); break;
    }

        ctx.restore();

        // Disegna i droni dell'altro giocatore in formazione statica Arrow con scivolamento
        if (this.equipped && this.equipped.drones) {
            let validDronesCount = 0;
            this.equipped.drones.forEach(d => { if(d) validDronesCount++; });
            
            let currentIndex = 0;
            for(let i=0; i<this.equipped.drones.length; i++) {
                const type = this.equipped.drones[i];
                if(!type) continue;
                
                // Formazione STANDARD BASE (stessa di Player)
                const pos = getStandardDroneOffset(currentIndex);
                const offsetX = pos.x;
                const offsetY = pos.y;
                
                const cosA = Math.cos(this.formationAngle);
                const sinA = Math.sin(this.formationAngle);
                
                const rotatedX = offsetX * cosA - offsetY * sinA;
                const rotatedY = offsetX * sinA + offsetY * cosA;
                
                const dx = this.x + rotatedX;
                const dy = this.y + rotatedY;
                
                ctx.save();
                ctx.translate(dx, dy);
                ctx.rotate(this.formationAngle);
                
        if (type === 'iris') {
            ctx.fillStyle = '#10B981'; // Smeraldo per l'Iris
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8); ctx.fill();
            ctx.fillStyle = '#6EE7B7';
            ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-5, 3); ctx.lineTo(-3, 0); ctx.lineTo(-5, -3); ctx.fill();
            ctx.fillStyle = '#065F46';
            ctx.beginPath(); ctx.arc(-4, 0, 2, 0, Math.PI*2); ctx.fill();
        } else if (type === 'apis') {
            ctx.fillStyle = '#F59E0B'; // Ambra per l'Apis
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
            ctx.fillStyle = '#92400E';
            ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
        } else if (type === 'zeus') {
            ctx.fillStyle = '#EAB308'; // Oro per lo Zeus
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
            ctx.fillStyle = '#854D0E';
            ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
        } else { // flax
            ctx.fillStyle = '#64748B'; // Grigio scuro per il Flax
            ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.fill();
            ctx.fillStyle = '#94A3B8';
            ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-4, 2); ctx.lineTo(-2, 0); ctx.lineTo(-4, -2); ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.arc(-3, 0, 1.5, 0, Math.PI*2); ctx.fill();
        }
                ctx.restore();
                currentIndex++;
            }
        }

        // ── FASE 3 — Anelli scudo statici + animazione impatto server-sync ──
        // _shRings: quanti anelli sono equipaggiati (da server, da config)
        // _shRatio: scudo CORRENTE / maxShield — se 0 non si disegnano gli anelli
        const _shRings = this.shieldRings || 0;
        const _shRatio = (this.maxShield > 0) ? Math.max(0, (this.shield || 0) / this.maxShield) : 0;
        const _baseRad = this.radius + 35;

        if (_shRings >= 1 && _shRatio > 0) {
            // Calcola deformazione da impatti ricevuti (stessa logica di Player.js)
            let deformArray = new Array(32).fill(0);
            if (this.shieldHits && this.shieldHits.length > 0) {
                for (const hit of this.shieldHits) {
                    const impactStr = Math.max(0, 1 - hit.age / hit.life) * 14;
                    for (let a = 0; a < 32; a++) {
                        const angleRad = (a / 32) * Math.PI * 2;
                        let diff = Math.abs(angleRad - hit.angle);
                        if (diff > Math.PI) diff = Math.PI * 2 - diff;
                        if (diff < Math.PI / 2) {
                            deformArray[a] += impactStr * Math.cos(diff);
                            // Pixel spark sull'impatto (solo frame iniziali)
                            if (Math.random() < 0.3 && hit.age < 0.15) {
                                ctx.fillStyle = '#7dd3fc';
                                const pRad = _baseRad - deformArray[a] + (Math.random() - 0.5) * 4;
                                const px = this.x + Math.cos(angleRad) * pRad;
                                const py = this.y + Math.sin(angleRad) * pRad;
                                const sz = 1 + Math.floor(Math.random() * 3);
                                ctx.fillRect(px - sz/2, py - sz/2, sz, sz);
                            }
                        }
                    }
                }
            }

            const _shAlpha = 0.25 + 0.35 * _shRatio;

            // ── Cerchio 1: più spesso, più vicino ────────────────────────
            ctx.save();
            ctx.strokeStyle = 'rgba(56, 189, 248, ' + _shAlpha + ')';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let a = 0; a < 32; a++) {
                const ang = (a / 32) * Math.PI * 2;
                const r = _baseRad - deformArray[a];
                const px = this.x + Math.cos(ang) * r;
                const py = this.y + Math.sin(ang) * r;
                a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();

            // ── Cerchio 2: medio ─────────────────────────────────────────
            if (_shRings >= 2) {
                ctx.save();
                ctx.strokeStyle = 'rgba(56, 189, 248, ' + (_shAlpha * 0.55) + ')';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                for (let a = 0; a < 32; a++) {
                    const ang = (a / 32) * Math.PI * 2;
                    const r = _baseRad + 10 - deformArray[a] * 0.6;
                    const px = this.x + Math.cos(ang) * r;
                    const py = this.y + Math.sin(ang) * r;
                    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            // ── Cerchio 3: sottile, più lontano ──────────────────────────
            if (_shRings >= 3) {
                ctx.save();
                ctx.strokeStyle = 'rgba(56, 189, 248, ' + (_shAlpha * 0.22) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let a = 0; a < 32; a++) {
                    const ang = (a / 32) * Math.PI * 2;
                    const r = _baseRad + 22 - deformArray[a] * 0.3;
                    const px = this.x + Math.cos(ang) * r;
                    const py = this.y + Math.sin(ang) * r;
                    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        }

        // Animazione ricarica scudo (pixel)
        if (this.shieldParticles && this.shieldParticles.length > 0) {
            for (const p of this.shieldParticles) {
                const alpha = Math.max(0, 1 - p.age / p.life);
                const px = this.x + Math.cos(p.angle) * p.orbitR;
                const py = this.y + Math.sin(p.angle) * p.orbitR;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(px) - Math.floor(p.size / 2),
                             Math.round(py) - Math.floor(p.size / 2),
                             p.size, p.size);
            }
            ctx.globalAlpha = 1.0;

            const pulse = 0.3 + 0.4 * Math.abs(Math.sin(Date.now() / 300));
            ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 22 + 35 - 14, 0, Math.PI * 2); // allineato al +35
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // ── Particelle Sprint ─────────────────────────────────────────────
        if (this.sprintParticles && this.sprintParticles.length > 0) {
            for (const p of this.sprintParticles) {
                const alpha = Math.max(0, 1 - p.age / p.life);
                ctx.globalAlpha = alpha * 0.85;
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(p.x) - Math.floor(p.size / 2),
                             Math.round(p.y) - Math.floor(p.size / 2),
                             p.size, p.size);
            }
            ctx.globalAlpha = 1.0;
        }

        // ── Aura + Particelle Cargo Pieno ─────────────────────────────────
        if (this.isCargoFull) {
            const pulse = 0.3 + 0.35 * Math.abs(Math.sin(Date.now() / 400));
            ctx.strokeStyle = `rgba(245, 158, 11, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (this.cargoParticles && this.cargoParticles.length > 0) {
            for (const p of this.cargoParticles) {
                const alpha = Math.max(0, 1 - p.age / p.life);
                ctx.globalAlpha = alpha * 0.9;
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(p.x) - Math.floor(p.size / 2),
                             Math.round(p.y) - Math.floor(p.size / 2),
                             p.size, p.size);
            }
            ctx.globalAlpha = 1.0;
        }

        if (this.isRegenerating) {
            // Regen HP — colore verde
            ctx.save();
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)'; // verde #4ade80
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= Math.PI * 2; i += 0.5) {
                const r = this.radius + 25 + Math.random() * 8;
                const hx = this.x + Math.cos(i) * r;
                const hy = this.y + Math.sin(i) * r;
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // Animazione Invulnerabilità EMP
        if (this.empInvulnerable) {
            const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 200));
            ctx.strokeStyle = `rgba(34, 211, 238, ${pulse})`; // #22d3ee
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 40, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(34, 211, 238, ${pulse * 0.2})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 40, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Target Indicator if this is target
        if (typeof inputManager !== 'undefined' && inputManager.targetEntity === this) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 30, 0, Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // ── Nome + Barre HP + Scudo sotto la nave avversaria ──────────────
        // Party label: use server-synced data (works for bots too) or fallback to local party object
        const isPartyMember = (this.serverPartyId && typeof player !== 'undefined' && player.partyId && this.serverPartyId === player.partyId)
            || (typeof player !== 'undefined' && player.party && player.party.members && player.party.members.some(m => m.username === this.id));
        const partyLabel = isPartyMember
            ? (this.serverPartyName || (player.party && player.party.name) || 'PARTY')
            : false;
        drawShipBars(ctx, this.x, this.y, this.radius,
            this.hp, this.maxHp, this.shield || 0, this.maxShield || 0,
            { nameLabel: this.id, isPlayer: false, faction: this.faction, partyLabel: partyLabel, pilotLevel: this.pilotLevel || null });
    }
}