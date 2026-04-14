class Projectile extends Entity {
  constructor(x, y, angle, speed, damage, isPlayerOwned, color = null, thickness = 2, isTurretShot = false) {
    super(x, y);
    this.angle = angle;
    this.color = color || (isPlayerOwned ? '#5EEAD4' : '#ff0000');
    this.thickness = thickness;
    this.isTurretShot = isTurretShot;
    this.targetX = x;
    this.targetY = y;
  }

  update(deltaTime) {
    // Interpolazione movimento
    if (this.targetX !== undefined) {
        this.x += (this.targetX - this.x) * 15 * deltaTime;
        this.y += (this.targetY - this.y) * 15 * deltaTime;
    }
    if (this.isMissile) {
        if (!this.trail) this.trail = [];
        this.trail.unshift({x: this.x, y: this.y});
        if (this.trail.length > 12) this.trail.pop();
    }
    super.update(deltaTime);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const t = this.thickness;

    if (this.isMissile) {
        // ══════════════════════════════════════════════════════════════════
        // ── MISSILE: ogiva + corpo + alette + scia dinamica ───────────────
        // ══════════════════════════════════════════════════════════════════
        const now = Date.now();
        const col = this.color || '#fb923c';

        // -- Scia dinamica (fumo e fuoco) basata sul path ------------------
        ctx.restore(); // Esci dalla rotazione locale per disegnare la scia in coordinate globali
        if (this.trail && this.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = `rgba(255, 150, 0, ${0.5 + Math.random() * 0.3})`;
            ctx.lineWidth = 6 + Math.random() * 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = `rgba(220, 220, 220, ${0.4 + Math.random() * 0.3})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }
        ctx.save(); // Rientra per disegnare il missile
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // -- Corpo principale (rettangolo arrotondato) ----------------------
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 6;
        ctx.shadowColor = col;
        ctx.fillStyle = '#c0c8d8';             // grigio metallico
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-6, -3, 16, 6, 2);
        } else {
            ctx.rect(-6, -3, 16, 6);           // fallback browser vecchi
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Striscia colore del tipo missile sul dorso
        ctx.fillStyle = col;
        ctx.fillRect(-4, -3, 12, 2);

        // -- Ogiva (triangolo puntuto a destra) ----------------------------
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(10, 0);     // punta
        ctx.lineTo(4,  -3);
        ctx.lineTo(4,   3);
        ctx.closePath();
        ctx.fill();

        // Riflesso lucido sull'ogiva
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(9, -0.5);
        ctx.lineTo(5, -2.5);
        ctx.lineTo(5, -0.5);
        ctx.closePath();
        ctx.fill();

        // -- Alette posteriori (2 alette diagonali) ------------------------
        ctx.fillStyle = '#94a3b8';
        // Aletta superiore
        ctx.beginPath();
        ctx.moveTo(-3, -3);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-6, -3);
        ctx.closePath();
        ctx.fill();
        // Aletta inferiore
        ctx.beginPath();
        ctx.moveTo(-3,  3);
        ctx.lineTo(-8,  7);
        ctx.lineTo(-6,  3);
        ctx.closePath();
        ctx.fill();

        // -- Punto di fuoco motore (cerchio luminoso in coda) --------------
        const thrPulse = 0.7 + 0.3 * Math.abs(Math.sin(now / 60));
        ctx.globalAlpha = thrPulse;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff9800';
        ctx.fillStyle = '#fff9c4';
        ctx.beginPath();
        ctx.arc(-6, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

    } else if (this.isTurretShot) {
        // ── TORRETTA BASE ─────────────────────────────────────────────────
        const len = 30 + Math.random() * 15;
        const bw = Math.max(t, 6);
        ctx.globalAlpha = 0.4; ctx.shadowBlur = bw * 2; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(-len - 4, -bw * 2.5, (len + 4) * 2, bw * 5);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.fillStyle = this.color; ctx.fillRect(-len, -bw * 1.5, len * 2, bw);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-len + 2, -bw * 1.5 + bw/4, len * 2 - 4, bw/2);
        ctx.fillStyle = this.color; ctx.fillRect(-len, bw * 0.5, len * 2, bw);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-len + 2, bw * 0.5 + bw/4, len * 2 - 4, bw/2);
        ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffffff';
        ctx.fillRect(-len + 6, -bw * 0.5, len * 2 - 12, bw);

    } else {
        // ── LASER PLAYER: sistema ammoType (x1/x2/x3/x4) ─────────────────
        // isFullSlots aumenta spessore base ma non cambia la logica dei fasci
        const ammo      = this.ammoType || 'x1';
        const fullBonus = this.isFullSlots ? 1.5 : 1.0; // slot pieni → spessore extra
        const baseThick = Math.max(1, this.thickness || 2) * fullBonus;
        const baseLen   = (this.isFullSlots ? 20 : 15) + Math.random() * 8;
        const col       = this.color;

        // Helper: disegna UN singolo fascio laser centrato su offsetY
        const drawBeam = (offsetY, thick, len) => {
            const half = thick / 2;
            ctx.globalAlpha = 0.75 + Math.random() * 0.25;
            ctx.shadowBlur  = 4 + thick * 1.5;
            ctx.shadowColor = col;
            ctx.fillStyle   = col;
            ctx.fillRect(-len, offsetY - half, len * 2, thick);
            ctx.shadowBlur  = 0;
            ctx.fillStyle   = '#ffffff';
            ctx.fillRect(-len + 2, offsetY - half / 2, len * 2 - 4, half);
        };

        if (ammo === 'x1') {
            drawBeam(0, baseThick, baseLen);

        } else if (ammo === 'x2') {
            // +30% spessore rispetto a x1
            drawBeam(0, baseThick * 1.3, baseLen);

        } else if (ammo === 'x3') {
            // 3 fasci: superiore + centrale + inferiore, spessore x2
            const t3   = baseThick * 1.3;
            const gap3 = t3 * 2.2;
            drawBeam(-gap3, t3, baseLen);
            drawBeam(0,     t3, baseLen);
            drawBeam( gap3, t3, baseLen);

        } else if (ammo === 'x4') {
            // 4 fasci, spessore x3 +30%
            const t4   = baseThick * 1.3 * 1.3;
            const gap4 = t4 * 1.8;
            drawBeam(-gap4 * 1.5, t4, baseLen);
            drawBeam(-gap4 * 0.5, t4, baseLen);
            drawBeam( gap4 * 0.5, t4, baseLen);
            drawBeam( gap4 * 1.5, t4, baseLen);

        } else {
            drawBeam(0, baseThick, baseLen);
        }
    }

    ctx.restore();
  }
}