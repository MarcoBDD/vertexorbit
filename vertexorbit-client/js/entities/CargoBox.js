// ============================================================
//  CargoBox.js — Entità client per le Cargo Box rare
//  Box rotanti luminose raccoglibili sulla mappa.
//  La logica di raccolta è server-authoritative (gameLoop.js).
// ============================================================

class CargoBox {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.id = null;
        this.radius = 18;
        this.age = 0;           // secondi di vita (ricevuto dal server)
        this.isDead = false;

        // Animazione locale
        this._rotAngle = Math.random() * Math.PI * 2;
        this._pulseT   = Math.random() * Math.PI * 2;
        this._sparkTimer = 0;
    }

    update(dt) {
        this._rotAngle  += dt * 1.8;          // rotazione costante
        this._pulseT    += dt * 3.0;          // pulsazione luminosa
        this._sparkTimer += dt;
    }

    draw(ctx) {
        const x = this.x;
        const y = this.y;
        const r = this.radius;
        const pulse = 0.7 + 0.3 * Math.sin(this._pulseT);   // 0.7 – 1.0
        const glow  = Math.floor(pulse * 255);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this._rotAngle);

        // ── Alone esterno ────────────────────────────────────────────
        const glowGrad = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
        glowGrad.addColorStop(0, `rgba(250, 204, 21, ${0.18 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // ── Corpo principale (quadrato ruotato = rombo) ───────────────
        const hs = r * 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -hs);
        ctx.lineTo(hs, 0);
        ctx.lineTo(0, hs);
        ctx.lineTo(-hs, 0);
        ctx.closePath();

        // Gradiente interno oro-giallo
        const bodyGrad = ctx.createRadialGradient(0, -hs * 0.3, 2, 0, 0, hs);
        bodyGrad.addColorStop(0, `rgba(255, 240, 120, ${pulse})`);
        bodyGrad.addColorStop(0.5, `rgba(250, 180, 20, ${pulse * 0.9})`);
        bodyGrad.addColorStop(1, `rgba(180, 100, 0, ${pulse * 0.8})`);
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Bordo brillante
        ctx.strokeStyle = `rgba(255, ${glow}, 0, ${0.9 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // ── Croce centrale (icona cassa) ──────────────────────────────
        ctx.strokeStyle = `rgba(255, 255, 200, ${0.7 * pulse})`;
        ctx.lineWidth = 1.5;
        // linea orizzontale
        ctx.beginPath(); ctx.moveTo(-hs * 0.55, 0); ctx.lineTo(hs * 0.55, 0); ctx.stroke();
        // linea verticale
        ctx.beginPath(); ctx.moveTo(0, -hs * 0.55); ctx.lineTo(0, hs * 0.55); ctx.stroke();

        // ── 4 angoli decorativi ───────────────────────────────────────
        const corners = [[0, -hs * 0.95], [hs * 0.95, 0], [0, hs * 0.95], [-hs * 0.95, 0]];
        ctx.fillStyle = `rgba(255, 240, 80, ${0.8 * pulse})`;
        corners.forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        // ── Etichetta "CARGO" ─────────────────────────────────────────
        ctx.save();
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 220, 50, ${0.6 + 0.4 * Math.sin(this._pulseT * 0.7)})`;
        ctx.fillText('CARGO', x, y + r + 14);
        ctx.restore();
    }
}
