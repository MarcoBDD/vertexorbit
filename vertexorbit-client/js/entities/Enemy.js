class Enemy extends Entity {
  constructor(x, y, type = 'lordakia', overrideData = null) {
    super(x, y);
    // overrideData permette di passare hp/radius/color dal server per tipi non noti (es. cubicle)
    const data = ENEMY_TYPES[type] || overrideData || { hp: 800, radius: 8, color: '#a5f3fc', name: type };
    this.type = type;
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.shield = 0;
    this.maxShield = 0;
    this.radius = data.radius;
    this.color = data.color;
    this.angle = 0;
    this.targetX = x;
    this.targetY = y;
    this.targetAngle = 0;
  }

  update(deltaTime) {
      if (this.targetX !== undefined) {
          this.x += (this.targetX - this.x) * 10 * deltaTime;
          this.y += (this.targetY - this.y) * 10 * deltaTime;
          let diff = this.targetAngle - this.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.angle += diff * 10 * deltaTime;
      }

      if (this.type === 'drone') {
          if (!this.trail) this.trail = [];
          this.trail.unshift({x: this.x, y: this.y});
          if (this.trail.length > 15) this.trail.pop();
      }

      super.update(deltaTime);
  }

  draw(ctx) {
    if (this.type === 'drone' && this.trail && this.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const cell = Math.max(2, Math.floor(this.radius / 7));
    const drawSprite = (rows, colors) => {
        const h = rows.length;
        const w = rows[0].length;
        const ox = Math.floor((w * cell) / 2);
        const oy = Math.floor((h * cell) / 2);
        for (let y = 0; y < h; y++) {
            const row = rows[y];
            for (let x = 0; x < w; x++) {
                const key = row[x];
                if (key !== '.' && colors[key]) {
                    ctx.fillStyle = colors[key];
                    ctx.fillRect(x * cell - ox, y * cell - oy, cell, cell);
                }
            }
        }
    };

    if (this.type === 'drone') {
        if (Date.now() % 300 < 150) ctx.globalAlpha = 0.6;
        drawSprite([
            '...AA...',
            '..BCCB..',
            '.BDDDB.',
            'ACDEDCA',
            '.BDDDB.',
            '..BCCB..',
            '...AA...'
        ], { A: '#ca8a04', B: '#eab308', C: '#facc15', D: '#fef08a', E: '#ffffff' });
        ctx.globalAlpha = 1.0;
    } else if (this.type === 'lordakia') {
        drawSprite(['..AA..', '.ABBA.', 'ABCCBA', 'ABDDCA', '.ABBA.', '..AA..'],
            { A: '#7f1d1d', B: '#b91c1c', C: '#ef4444', D: '#fca5a5' });
    } else if (this.type === 'saimon') {
        drawSprite(['.AAAA.', 'ABCCBA', 'ACDDCA', 'ACDDCA', 'ABCCBA', '.AAAA.'],
            { A: '#9a3412', B: '#ea580c', C: '#fb923c', D: '#ffedd5' });
    } else if (this.type === 'mordon') {
        drawSprite(['.AAAAA.', 'ABCCCBA', 'ACDDDCA', 'ACEEECA', 'ACDDDCA', 'ABCCCBA', '.AAAAA.'],
            { A: '#422006', B: '#78350f', C: '#a16207', D: '#f59e0b', E: '#fde68a' });
    } else if (this.type === 'sibelon') {
        drawSprite(['..AAAA..', '.ABCCBA.', 'ABCDDCBA', 'ACDEEDCA', 'ABCDDCBA', '.ABCCBA.', '..AAAA..'],
            { A: '#312e81', B: '#4c1d95', C: '#7c3aed', D: '#a78bfa', E: '#ddd6fe' });
    } else if (this.type === 'kristallin') {
        drawSprite(['...AA...', '..ABBA..', '.ABCCBA.', 'ABCDDCBA', '.ABCCBA.', '..ABBA..', '...AA...'],
            { A: '#164e63', B: '#0891b2', C: '#06b6d4', D: '#a5f3fc' });
    } else if (this.type === 'kristallon') {
        drawSprite(['..AAAA..', '.ABCCBA.', 'ABCDDCBA', 'ACDEEDCA', 'ACDEEDCA', 'ABCDDCBA', '.ABCCBA.', '..AAAA..'],
            { A: '#1e3a8a', B: '#1d4ed8', C: '#3b82f6', D: '#93c5fd', E: '#dbeafe' });
    } else if (this.type === 'cubikon') {
        drawSprite(['AAAAAAAA', 'ABCCCCBA', 'ACDDDCCA', 'ACDEEDCA', 'ACDEEDCA', 'ACDDDCCA', 'ABCCCCBA', 'AAAAAAAA'],
            { A: '#52525b', B: '#a1a1aa', C: '#d4d4d8', D: '#e4e4e7', E: '#fafafa' });
    } else if (this.type === 'uber_lordakia') {
        drawSprite(['..AAAA..', '.ABCCBA.', 'ABCDDCBA', 'ACDEEDCA', 'ABCDDCBA', '.ABCCBA.', '..AAAA..'],
            { A: '#450a0a', B: '#7f1d1d', C: '#dc2626', D: '#f87171', E: '#fee2e2' });
    } else if (this.type === 'interceptor') {
        drawSprite(['...AA...', '..ABBA..', '.ABCCBA.', 'ABCDDCBA', '.ABCCBA.', '..ABBA..', '...AA...'],
            { A: '#14532d', B: '#16a34a', C: '#22c55e', D: '#bbf7d0' });
    } else if (this.type === 'barracuda') {
        drawSprite(['..AAAA..', '.ABCCBA.', 'ABCDDCBA', 'ACDEEDCA', 'ACDFFDCA', 'ABCDDCBA', '.ABCCBA.', '..AAAA..'],
            { A: '#7c2d12', B: '#c2410c', C: '#ea580c', D: '#fb923c', E: '#fdba74', F: '#ffedd5' });
    } else if (this.type === 'annihilator') {
        drawSprite(['...AAAA...', '..ABCCBA..', '.ABCDDCBA.', 'ABCDFFDCBA', 'ACDFFGFDCA', 'ABCDFFDCBA', '.ABCDDCBA.', '..ABCCBA..', '...AAAA...'],
            { A: '#450a0a', B: '#7f1d1d', C: '#991b1b', D: '#dc2626', F: '#f87171', G: '#fecaca' });
    } else if (this.type === 'phantom') {
        drawSprite(['...AA...', '..ABBA..', '.ABCCBA.', 'ABCDDCBA', 'ABCEECBA', '.ABCCBA.', '..ABBA..', '...AA...'],
            { A: '#312e81', B: '#4338ca', C: '#6366f1', D: '#818cf8', E: '#c7d2fe' });
    } else if (this.type === 'cubicle') {
        // Cubino: piccolo cubo azzurro vivace
        drawSprite(['.AA.', 'ABBA', 'ABBA', '.AA.'],
            { A: '#0891b2', B: '#a5f3fc' });
    } else {
        drawSprite(['.AAAA.', 'ABCCBA', 'ABCCBA', '.AAAA.'],
            { A: '#334155', B: '#64748b', C: '#e2e8f0' });
    }

    ctx.restore();

    // ── Barre HP + Scudo ──────────────────────────────────────────────────
    const barW = Math.max(40, Math.floor(this.radius * 1.4));
    const barX = this.x - (barW / 2);
    const barY = this.y - this.radius - 13;

    // Sfondo barra HP
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 6);
    // Barra HP vuota (rossa)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(barX, barY, barW, 4);
    // Barra HP piena (verde)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, this.hp / this.maxHp)), 4);

    // Barra scudo (sotto HP, azzurra) — sempre visibile se la nave ha scudo
    if (this.maxShield > 0) {
        const shY = barY + 6;
        // Sfondo sempre visibile (scudo esaurito = grigio scuro)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(barX - 1, shY - 1, barW + 2, 5);
        // Track vuoto (indica che lo scudo esiste ma è a 0)
        ctx.fillStyle = '#0f2744';
        ctx.fillRect(barX, shY, barW, 3);
        // Fill azzurro proporzionale allo scudo rimanente
        const shPct = Math.max(0, Math.min(1, (this.shield || 0) / this.maxShield));
        if (shPct > 0) {
            ctx.fillStyle = shPct > 0.5 ? '#38bdf8' : '#0369a1';
            ctx.fillRect(barX, shY, barW * shPct, 3);
        }
    }

    // Nome alieno
    const nameY = this.y - this.radius - (this.maxShield > 0 ? 22 : 16);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, Math.min(14, Math.floor(this.radius / 3)))}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText((ENEMY_TYPES[this.type] || { name: this.type }).name, this.x, nameY);

    // Indicatore target
    if (typeof inputManager !== 'undefined' && inputManager.targetEntity === this) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
  }
}

class Particle extends Entity {
    constructor(x, y, color, isDebris = false) {
        super(x, y);
        this.color = color;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200;
        this.life = 1.0;
        this.age = 0;
        this.size = 4;
        this.isDebris = isDebris;
        this.angle = Math.random() * Math.PI * 2;
        this.vAngle = (Math.random() - 0.5) * 10;
        this.friction = isDebris ? 0.96 : 1.0;
    }
    update(deltaTime) {
        super.update(deltaTime);
        if (this.friction !== 1.0) {
            this.vx *= Math.pow(this.friction, deltaTime * 60);
            this.vy *= Math.pow(this.friction, deltaTime * 60);
            this.angle += this.vAngle * deltaTime;
            this.vAngle *= Math.pow(this.friction, deltaTime * 60);
        }
        this.age += deltaTime;
        if (this.age >= this.life) this.isDead = true;
    }
    draw(ctx) {
        const p = Math.max(0, 1 - (this.age / this.life));
        ctx.globalAlpha = this.isDebris ? (p > 0.3 ? 1 : p * 3.3) : p;
        ctx.fillStyle = this.color;
        if (this.isDebris) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(-this.size/4, -this.size/4, this.size/2, this.size/2);
            ctx.restore();
        } else {
            const s = this.size || 4;
            ctx.fillRect(this.x - s/2, this.y - s/2, s, s);
        }
        ctx.globalAlpha = 1.0;
    }
}
