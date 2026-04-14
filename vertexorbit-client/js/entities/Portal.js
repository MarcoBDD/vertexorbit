class Portal extends Entity {
    constructor(x, y, targetMap) {
        super(x, y);
        this.targetMap = targetMap;
        this.radius = 50;
        this.rotation = 0;
    }
    
    update(deltaTime) {
        this.rotation += deltaTime;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Cerchio esterno
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(13, 148, 136, 0.8)'; // Teal
        ctx.lineWidth = 4;
        ctx.setLineDash([15, 10]);
        ctx.stroke();
        
        // Cerchio interno
        ctx.rotate(-this.rotation * 2);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        
        ctx.restore();
        
        // Testo
        ctx.fillStyle = '#fff';
        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`Jump: ${this.targetMap}`, this.x, this.y - this.radius - 15);
        ctx.fillStyle = '#facc15';
        ctx.font = '10px Courier New';
        ctx.fillText(`Press J`, this.x, this.y - this.radius - 3);
    }
}