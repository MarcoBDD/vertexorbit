class BaseStation extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 400; // Dimensioni giganti (collision/safe zone)
    }
    
    update(deltaTime) {
        // La base è statica
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // --- SAFE ZONE VISUAL (Raggio 1000) ---
        ctx.beginPath();
        ctx.arc(0, 0, 1000, 0, Math.PI * 2);
        
        // Gradiente per la bolla di safe zone
        const safeGrad = ctx.createRadialGradient(0, 0, 400, 0, 0, 1000);
        safeGrad.addColorStop(0, 'rgba(16, 185, 129, 0.15)'); // Verde/teal al centro
        safeGrad.addColorStop(0.8, 'rgba(16, 185, 129, 0.05)');
        safeGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        
        ctx.fillStyle = safeGrad;
        ctx.fill();
        
        // Bordo bolla
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 30]);
        ctx.stroke();
        ctx.setLineDash([]);
        // -------------------------------------

        // --- PIXEL ART GIGANTE (MOTHERSHIP) ---
        const pixelSize = 30; // 50% più grande dell'originale (20)
        
        // Colori per lo stile Voxel/Pixel
        const colors = {
            dark: '#0F172A',
            hull: '#1E293B',
            light: '#334155',
            neon: '#0EA5E9',
            engine: '#F59E0B',
            core: '#10B981',
            glass: '#38BDF8'
        };

        // Disegno Voxel-style simmetrico basato su blocchi
        // Ombra globale della Mothership
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 50;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 15;

        // Funzione helper per disegnare blocchi simmetrici (Top-Down, asse X simmetrico, orientata verso l'alto/basso o circolare)
        // Creiamo una struttura a stella o nave da guerra a croce, che fa da base fazione.
        
        const drawBlock = (px, py, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(px * pixelSize, py * pixelSize, w * pixelSize, h * pixelSize);
        };

        const drawSymBlock = (px, py, w, h, color) => {
            drawBlock(px, py, w, h, color);
            if (px !== 0) drawBlock(-px - w, py, w, h, color); // Simmetria speculare orizzontale
        };

        // Corpo Centrale Spina dorsale
        drawSymBlock(0, -15, 2, 30, colors.dark);
        drawSymBlock(0, -14, 4, 28, colors.hull);
        drawSymBlock(0, -12, 6, 24, colors.light);
        
        // Ali superiori (Prua)
        drawSymBlock(4, -10, 2, 8, colors.dark);
        drawSymBlock(6, -8, 2, 6, colors.hull);
        drawSymBlock(8, -6, 2, 4, colors.dark);
        
        // Ali principali laterali (Centro)
        drawSymBlock(4, -2, 6, 8, colors.hull);
        drawSymBlock(10, 0, 4, 4, colors.dark);
        drawSymBlock(14, 1, 2, 2, colors.neon); // Punte neon ali
        
        // Piattaforme posteriori (Motori / Poppa)
        drawSymBlock(4, 8, 4, 6, colors.hull);
        drawSymBlock(2, 14, 4, 2, colors.dark);
        
        // Dettagli Voxel interni
        drawSymBlock(0, -8, 2, 4, colors.glass); // Ponte di comando
        drawSymBlock(0, 4, 2, 2, colors.core);   // Nucleo reattore (Centro)
        
        // Dettagli strisce neon
        drawSymBlock(2, -4, 2, 12, colors.dark);
        drawSymBlock(2, -2, 1, 8, colors.neon);
        
        // Motori acceso Voxel-style (Fuoco)
        drawSymBlock(2, 16, 2, 1, colors.engine);
        drawSymBlock(2, 17, 2, 1, '#DC2626'); // Rosso fuoco

        // Piattaforme Attracco (Aree per i player)
        drawSymBlock(5, 0, 3, 4, colors.dark); // Pad sx/dx
        drawSymBlock(6, 1, 1, 2, colors.core); // Indicatori pad
        
        ctx.shadowBlur = 0; // Reset ombra per evitare artefatti

        ctx.restore();
    }
}