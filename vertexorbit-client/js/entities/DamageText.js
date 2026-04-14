class DamageText extends Entity {
    constructor(x, y, amount, type = 'normal', customColor = null) {
        super(x, y, 0, 0);
        this.amount = typeof amount === 'number' ? Math.floor(amount) : amount;
        this.type = type; // 'normal', 'critical', 'heal', 'shield', 'loot'
        this.customColor = customColor;
        this.life = type === 'loot' ? 1.8 : 1.0;
        this.age = 0;
        this.x += (Math.random() - 0.5) * 40;
        this.y += (Math.random() - 0.5) * 40;
        this.vy = -30 - Math.random() * 20;
        this.vx = (Math.random() - 0.5) * 20;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.age += deltaTime;

        // Decelera
        this.vy *= 0.95;
        this.vx *= 0.95;

        if (this.age >= this.life) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Calcola opacità in base all'età (fade out rapido alla fine)
        let alpha = 1.0;
        const fadeStart = this.life * 0.7;
        if (this.age > fadeStart) {
            alpha = 1.0 - ((this.age - fadeStart) / (this.life - fadeStart));
        }
        
        ctx.globalAlpha = Math.max(0, alpha);

        // Effetto "pop" iniziale: parte grande, rimpicciolisce leggermente
        let scale = 1.0;
        if (this.age < 0.2) {
            scale = 1.0 + (0.2 - this.age) * 2.5; // Scale up to 1.5x at spawn
        }

        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);

        // Colori e Stile in base al tipo
        let fillColor, strokeColor, fontSize, fontFamily;
        
        fontFamily = 'Impact, sans-serif'; // Font bold e moderno
        
        switch (this.type) {
            case 'critical':
                fillColor = '#FCA5A5'; // Rosso chiaro
                strokeColor = '#991B1B'; // Rosso scuro
                fontSize = 24;
                ctx.shadowColor = '#DC2626';
                break;
            case 'heal':
                fillColor = '#86EFAC'; // Verde chiaro
                strokeColor = '#166534'; // Verde scuro
                fontSize = 20;
                ctx.shadowColor = '#22C55E';
                break;
            case 'shield':
                fillColor = '#93C5FD';
                strokeColor = '#1E40AF';
                fontSize = 18;
                ctx.shadowColor = '#3B82F6';
                break;
            case 'loot':
                fillColor = this.customColor || '#facc15';
                strokeColor = 'rgba(0,0,0,0.8)';
                fontSize = 13;
                ctx.shadowColor = this.customColor || '#facc15';
                fontFamily = '"Courier New", monospace';
                break;
            default: // normal damage
                fillColor = '#FDBA74'; // Arancione
                strokeColor = '#9A3412'; // Arancio scuro
                fontSize = 20;
                ctx.shadowColor = '#EA580C';
                break;
        }

        ctx.font = `italic ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.strokeStyle = strokeColor;
        // Loot text mostra la stringa diretta, non "-numero"
        const displayText = this.type === 'loot' ? String(this.amount) : `-${this.amount}`;
        ctx.strokeText(displayText, 0, 0);
        ctx.shadowBlur = 0;
        ctx.fillStyle = fillColor;
        ctx.fillText(displayText, 0, 0);

        ctx.restore();
    }
}