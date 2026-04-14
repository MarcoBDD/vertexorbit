class EntityManager {
  constructor() {
    this.entities = [];
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  update(deltaTime) {
    let vpLeft = -Infinity, vpTop = -Infinity, vpRight = Infinity, vpBottom = Infinity;
    if (typeof camera !== 'undefined' && typeof canvas !== 'undefined') {
        vpLeft = camera.x - 200;
        vpTop = camera.y - 200;
        vpRight = camera.x + canvas.width + 200;
        vpBottom = camera.y + canvas.height + 200;
    }

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      
      // Ottimizzazione: Culling distruttivo per particelle e rottami fuori dal viewport
      if (ent.constructor.name === 'Particle') {
          if (ent.x < vpLeft || ent.x > vpRight || ent.y < vpTop || ent.y > vpBottom) {
              this.entities.splice(i, 1);
              continue;
          }
      }

      ent.update(deltaTime);
      // Il Player non viene mai rimosso (isDead gestito via respawn)
      if (ent.isDead && !(ent instanceof Player)) {
        this.entities.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    let vpLeft = -Infinity, vpTop = -Infinity, vpRight = Infinity, vpBottom = Infinity;
    if (typeof camera !== 'undefined' && typeof canvas !== 'undefined') {
        vpLeft = camera.x - 200;
        vpTop = camera.y - 200;
        vpRight = camera.x + canvas.width + 200;
        vpBottom = camera.y + canvas.height + 200;
    }

    for (const ent of this.entities) {
      if (ent instanceof Player && ent.isDead) continue;
      
      if (ent.x !== undefined && ent.y !== undefined) {
          const r = ent.radius || 100;
          if (ent.x + r < vpLeft || ent.x - r > vpRight || ent.y + r < vpTop || ent.y - r > vpBottom) {
              if (ent.constructor.name !== 'BaseStation' && ent.constructor.name !== 'Portal') {
                  continue;
              }
          }
      }
      ent.draw(ctx);
    }
  }
}