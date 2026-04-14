// ── Entità Mina client-side ────────────────────────────────────────────────
class Mine extends Entity {
    constructor(x, y, mineType, color, ownerFaction) {
        super(x, y);
        this.mineType     = mineType     || 'mine-normal';
        this.color        = color        || '#dc2626';
        this.ownerFaction = ownerFaction || null;
        this.radius       = 12;
        this.age          = 0;
        this.pulsePhase   = Math.random() * Math.PI * 2;
    }

    update(deltaTime) {
        super.update(deltaTime);
        this.age += deltaTime;
    }

    draw(ctx) {
        const MINE_LIFE   = 15;
        const timeLeft    = Math.max(0, MINE_LIFE - this.age);
        const urgency     = 1 - timeLeft / MINE_LIFE;            // 0→1 man mano scade
        const pulseSpeed  = 3 + urgency * 8;                     // pulsa sempre più veloce
        const pulse       = 0.7 + 0.3 * Math.sin(this.age * pulseSpeed + this.pulsePhase);
        const r           = this.radius;

        // Colori fazione per l'icona ⬡
        const FACTION_COLORS = { MMO: '#ef4444', EIC: '#3b82f6', VRU: '#22c55e' };
        const factionColor   = (this.ownerFaction && FACTION_COLORS[this.ownerFaction])
                                ? FACTION_COLORS[this.ownerFaction]
                                : this.color;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Alone pulsante — diventa più rosso man mano che scade
        ctx.globalAlpha = (0.2 + urgency * 0.2) * pulse;
        ctx.fillStyle   = urgency > 0.7 ? '#ef4444' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6 + urgency * 6, 0, Math.PI * 2);
        ctx.fill();

        // Corpo esagonale
        ctx.globalAlpha = 0.95;
        ctx.fillStyle   = this.color;
        ctx.strokeStyle = urgency > 0.7 ? '#fff' : '#ffffff88';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
                    : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Icona centrale: ⬡ con colore della fazione del proprietario
        ctx.globalAlpha  = 1;
        ctx.fillStyle    = factionColor;
        ctx.font         = `bold ${r + 2}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⬡', 0, 1);

        // Timer countdown sotto la mina
        ctx.globalAlpha  = 0.85;
        ctx.fillStyle    = urgency > 0.7 ? '#ef4444' : '#fff';
        ctx.font         = '8px Courier New';
        ctx.textBaseline = 'top';
        ctx.fillText(timeLeft.toFixed(0) + 's', 0, r + 2);

        ctx.restore();
    }
}
