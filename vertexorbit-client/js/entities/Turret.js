class Turret extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 25; // Raggio di hitbox per i click (non necessariamente visivo)
        this.angle = 0;
        this.targetAngle = 0;
        this.recoil = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        // Interpolazione angolare fluida dal server
        if (this.targetAngle !== undefined) {
            let diff = this.targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 10 * deltaTime;
        }
        if (this.recoil > 0) {
            this.recoil -= deltaTime * 5;
            if (this.recoil < 0) this.recoil = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const pixelSize = 8; // Scala per Pixel Art Torretta
        
        const colors = {
            baseDark: '#1E293B',
            baseLight: '#334155',
            gun: '#64748B',
            neon: '#EF4444', // Neon rosso per le armi
            core: '#0EA5E9'
        };

        // --- GLOW (Illuminazione a terra dinamica) ---
        ctx.beginPath();
        ctx.arc(0, 0, 100, 0, Math.PI * 2);
        const glowGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 100);
        const alpha = 0.15 + this.recoil * 0.25; // Aumenta quando spara
        glowGrad.addColorStop(0, `rgba(14, 165, 233, ${alpha})`); // Colore core
        glowGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Ombra torretta
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Disegno BASE FISSA della torretta in Voxel Art
        ctx.fillStyle = colors.baseDark;
        ctx.fillRect(-4 * pixelSize, -6 * pixelSize, 8 * pixelSize, 12 * pixelSize);
        ctx.fillRect(-6 * pixelSize, -4 * pixelSize, 12 * pixelSize, 8 * pixelSize);
        
        ctx.fillStyle = colors.baseLight;
        ctx.fillRect(-3 * pixelSize, -5 * pixelSize, 6 * pixelSize, 10 * pixelSize);
        ctx.fillRect(-5 * pixelSize, -3 * pixelSize, 10 * pixelSize, 6 * pixelSize);

        // Nucleo torretta
        ctx.fillStyle = colors.core;
        ctx.fillRect(-2 * pixelSize, -2 * pixelSize, 4 * pixelSize, 4 * pixelSize);

        ctx.shadowBlur = 0; // Disabilito l'ombra per il cannone rotante per pulizia

        // CANNONE ROTANTE
        ctx.rotate(this.angle);
        
        // --- EFFETTO RINCULO ---
        const recoilOffset = this.recoil * pixelSize * -1.5; // Rinculo all'indietro
        ctx.translate(recoilOffset, 0);
        
        // Struttura a blocchi per il cannone (doppia canna)
        ctx.fillStyle = colors.gun;
        // Corpo cannone
        ctx.fillRect(-2 * pixelSize, -3 * pixelSize, 5 * pixelSize, 6 * pixelSize);
        
        // Canna sinistra
        ctx.fillRect(3 * pixelSize, -3 * pixelSize, 6 * pixelSize, 2 * pixelSize);
        // Canna destra
        ctx.fillRect(3 * pixelSize, 1 * pixelSize, 6 * pixelSize, 2 * pixelSize);
        
        // Punte neon delle canne
        ctx.fillStyle = colors.neon;
        ctx.fillRect(9 * pixelSize, -3 * pixelSize, 1 * pixelSize, 2 * pixelSize);
        ctx.fillRect(9 * pixelSize, 1 * pixelSize, 1 * pixelSize, 2 * pixelSize);

        ctx.restore();
    }
}