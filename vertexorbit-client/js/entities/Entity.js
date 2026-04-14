class Entity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 10; // For basic collision
    this.isDead = false;
  }

  update(deltaTime) {
    if (this.targetX !== undefined && this.targetY !== undefined && this.constructor.name !== 'Player') {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        
        // Se la distanza è eccessiva (es. teleport, respawn o lag spike), scatta subito alla posizione
        if (dx*dx + dy*dy > 250000) { // 500px^2
            this.x = this.targetX;
            this.y = this.targetY;
        } else {
            // Interpolazione fluida verso il target: avvicina il 10% della distanza rimanente ogni frame a 60fps
            const lerpFactor = Math.min(1.0, 10 * deltaTime);
            this.x += dx * lerpFactor;
            this.y += dy * lerpFactor;
        }

        if (this.targetAngle !== undefined) {
            let diff = this.targetAngle - (this.angle || 0);
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle = (this.angle || 0) + diff * Math.min(1.0, 10 * deltaTime);
        }
    } else {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }
  }

  draw(ctx) {
    // Base draw (override in subclasses)
  }
}