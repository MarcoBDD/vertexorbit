class Resource extends Entity {
  constructor(x, y, value, type = 'credits') {
    super(x, y);
    this.value = value;
    this.type = type;
    this.radius = 8;
    this.targetX = x;
    this.targetY = y;
    this.age = 0;
    // Campi loot avanzati (popolati dal worldUpdate)
    this.quantity = value;
    this.itemName = type;
    this.rarity = 'common';
    this.isRare = false;
    this.color = '#ffffff';
    // Particelle pixel per i rari
    this._particles = [];
  }

  update(deltaTime) {
    if (this.targetX !== undefined) {
      this.x += (this.targetX - this.x) * 10 * deltaTime;
      this.y += (this.targetY - this.y) * 10 * deltaTime;
    }
    this.age += deltaTime;

    // Genera particelle pixel per i loot rari
    if (this.isRare && Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 40;
      this._particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.6,
        age: 0,
        color: this.color,
        size: 2 + Math.floor(Math.random() * 3)
      });
    }
    // Aggiorna particelle
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.age += deltaTime;
      if (p.age >= p.life) this._particles.splice(i, 1);
    }
    super.update(deltaTime);
  }

  draw(ctx) {
    // Disegna particelle pixel (sotto il loot)
    if (this.isRare) {
      for (const p of this._particles) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x) - p.size/2, Math.round(p.y) - p.size/2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const r = this.isRare ? 10 : 6;
    const col = this.color || '#ffffff';

    // Alone/glow per i rari
    if (this.isRare) {
      const pulse = 0.55 + 0.45 * Math.sin(this.age * 4);
      ctx.shadowColor = col;
      ctx.shadowBlur = 14 * pulse;
      // Bordo esterno animato
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Corpo del loot — pixel box ruotato
    ctx.rotate(this.age * (this.isRare ? 1.5 : 2));
    ctx.fillStyle = col;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // Dettaglio interno (quadratino più chiaro)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-r + 2, -r + 2, r - 2, r - 2);

    // Bordo
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = this.isRare ? 1.5 : 1;
    ctx.strokeRect(-r, -r, r * 2, r * 2);

    ctx.shadowBlur = 0;
    ctx.restore();

    // Etichetta quantità sotto il loot
    const qty = Math.floor(this.quantity !== undefined ? this.quantity : this.value);
    if (qty > 0) {
      ctx.save();
      const rarityColors = { common:'#94a3b8', uncommon:'#4ade80', rare:'#38bdf8', epic:'#d946ef', legendary:'#facc15' };
      const labelCol = rarityColors[this.rarity] || '#fff';
      
      const displayName = this.itemName || this.type || '';
      const text = `${displayName} x${qty}`;
      
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      
      const textWidth = ctx.measureText(text).width;
      const padding = 10;
      
      ctx.fillStyle = labelCol;
      ctx.fillText(text, this.x, this.y + (this.isRare ? 24 : 20));
      ctx.restore();
    }
  }
}
