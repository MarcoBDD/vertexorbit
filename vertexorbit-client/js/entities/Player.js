/**
 * Formazione STANDARD BASE dei droni:
 *   Indice 0-3 → rombo DIETRO la nave (asse X negativo = coda nave)
 *   Indice 4-5 → lato SINISTRO (affiancati, stessa X)
 *   Indice 6-7 → lato DESTRO  (affiancati, stessa X)
 *   Indice 8-9 → fallback orbita circolare per droni extra
 *
 * Il sistema di coordinate "nave" ha:
 *   X+ = prua (davanti)   X- = coda (dietro)
 *   Y- = sinistra         Y+ = destra
 * Rotated dalla nave tramite formationAngle nella chiamata.
 */
function getStandardDroneOffset(index) {
    switch (index) {
        // ── Rombo dietro ──────────────────────────────────────────────────
        case 0: return { x: -85, y:   0  };  // centro rombo
        case 1: return { x: -110, y: -30  };  // ala sinistra
        case 2: return { x: -110, y:  30  };  // ala destra
        case 3: return { x:-140, y:   0  };  // punta rombo (coda)
        // ── Lato sinistro/destro alternati (5°=sx, 6°=dx, 7°=sx ext, 8°=dx ext) ──
        case 4: return { x: -15, y: -75  };  // sinistro interno
        case 5: return { x: -15, y:  75  };  // destro interno   ← opposto al 5°
        case 6: return { x: -15, y: -110 };  // sinistro esterno
        case 7: return { x: -15, y:  110 };  // destro esterno
        // ── Droni extra (9-10°): orbita circolare di fallback ─────────────
        default: {
            const angle = ((index - 8) * Math.PI * 2 / 2) + Math.PI * 0.75;
            return { x: Math.cos(angle) * 85, y: Math.sin(angle) * 85 };
        }
    }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y);
    this.shipType = 'phoenix';
    this.hp = ITEMS.ships[this.shipType].hp;
    this.maxHp = ITEMS.ships[this.shipType].hp;
    this.shield = 0;
    this.maxShield = 0;
    this.credits = 25000;
    this.faction = 'MMO'; // MMO, EIC, VRU
    this.speed = ITEMS.ships[this.shipType].speed;
    this.radius = 20;
    
    // Movimento Point & Click
    this.targetX = x;
    this.targetY = y;
    
    // Fase 4: Risorse e Stiva
    this.cargo = 0;
    this.maxCargo = ITEMS.ships[this.shipType].cargo || 100;
    this.materials = {
        prometium: 0,
        endurium: 0,
        terbium: 0,
        prometid: 0,
        duranium: 0,
        promerium: 0,
        seprom: 0
    };
    
    this.lastShotTime = 0;
    this.fireRate = 0.3;
    this.angle = 0;
    this.lastDamageTime = 0;
    this.isRegenerating = false;
    this.isShieldRegen = false;
    // Particelle per animazione rigenerazione scudo
    this.shieldParticles = [];

    // Debuff rallentamento
    this.slowDebuff = null;

    // Timers per audio
    this.audioTimers = { move: 0, regenHp: 0, regenShield: 0 };

    // ── Inventario consumabili ────────────────────────────────────────────
    this.ammo = {
        laserAmmo: 'x1',         // tipo munizione attivo
        counts: {
            x1: 999999, x2: 500, x3: 200, x4: 100, sab: 100
        }
    };
    this.missileAmmo = {
        selected: 'plt-2026',
        counts: { 'r-310': 50, 'plt-2026': 30, 'plt-3030': 10, 'pld-8': 20, 'agt-500': 5 }
    };
    this.mineAmmo = {
        selected: 'mine-normal',
        counts: { 'mine-normal': 10, 'mine-slow': 10, 'smart-bomb': 3 }
    };
    this.empAmmo = { counts: { 'emp-01': 5 } };
    
    this.selectedSpecial = 'mine-normal';

    // Cooldown consumabili
    this.lastEmpTime       = 0;
    this.lastMineTime      = 0;
    this.lastSmartBombTime = 0;
    this.lastMissileTime   = 0;

    // Inventario globale
    this.inventory = {
        lasers: ['lf2'],
        shields: ['sg3n-b01'],
        generators: ['g3n-7900'],
        drones: ['flax'],
        missiles: ['plt-2026'],
        pets: []
    };
    
    // Due configurazioni indipendenti
    this.configs = {
        1: { shipType: 'phoenix', lasers: ['lf2'], shields: [], generators: ['g3n-7900'], cpus: ['auto-rocket'], missiles: ['plt-2026'], drones: ['flax'], droneItems: [[]], pets: [] },
        2: { shipType: 'phoenix', lasers: [], shields: ['sg3n-b01'], generators: [], cpus: [], missiles: ['plt-2026'], drones: ['flax'], droneItems: [[]], pets: [] }
    };
    this.score = 0;
    this.kills = 0;
    this.deaths = 0;
    // ── Pilot Skills (valori di default, aggiornati dal server) ──────────
    this.pilotLevel  = 1;
    this.pilotExp    = 0;
    this.skillPoints = 0;
    this.expNeeded   = 1000;
    this.pilotSkills = { hp:0, speed:0, sprint:0, shield:0, damage:0, laser:0, missile:0, coins:0, loot:0, exp:0 };
    this.activeConfig = 1;
    this.formationAngle = 0;
    this.formation = 'standard';
    this.lastMovingAngle = 0;  // angolo congelato all'ultimo movimento valido

    // ── Animazione switch formazione droni ───────────────────────────────
    this.lastFormationSwitchTime = 0;
    this.formationSwitchCd = 5;           // secondi di cooldown tra switch
    this.droneCurrentPositions = [];      // posizioni world correnti [{ x, y }]
    this.droneTargetPositions  = [];      // posizioni target verso cui interpolano
    
    this.recalculateStats();

    // Sprint — inizializzato dopo recalculateStats che setta maxSprint
    this.sprint = this.maxSprint;
    this.sprintStillTime = 0;  // secondi fermi consecutivi
    this.sprintExhausted  = false; // flag: sprint a 0
  }

  get equipped() {
      // Le chiavi JSON sono sempre stringhe — supporta sia 1 che "1"
      return this.configs[this.activeConfig] || this.configs[String(this.activeConfig)] || this.configs[1] || this.configs['1'];
  }

  switchConfig() {
      this.activeConfig = this.activeConfig === 1 ? 2 : 1;
      this.recalculateStats();
      console.log("Config cambiata a: " + this.activeConfig);
      if (typeof uiManager !== 'undefined') {
          uiManager.viewingConfig = this.activeConfig;
          uiManager.selectConfig(this.activeConfig);
      }
      if (typeof entityManager !== 'undefined') {
          entityManager.addEntity(new DamageText(this.x, this.y - 30, 'CONFIG ' + this.activeConfig, 'loot', '#5EEAD4'));
      }
  }

  recalculateStats() {
      if (this.equipped.shipType) this.shipType = this.equipped.shipType;

      if (!this.equipped.lasers) this.equipped.lasers = [];
      if (!this.equipped.shields) this.equipped.shields = [];
      if (!this.equipped.generators) this.equipped.generators = [];
      if (!this.equipped.cpus) this.equipped.cpus = [];
      if (!this.equipped.missiles) this.equipped.missiles = [];
      if (!this.equipped.drones) this.equipped.drones = [];
      if (!this.equipped.droneItems) this.equipped.droneItems = [];
      if (!this.equipped.pets) this.equipped.pets = [];

      const ship = ITEMS.ships[this.shipType];
      this.maxHp = ship.hp;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
      this.maxCargo = ship.cargo || 100;
      
      this.speed = ship.speed;
      if (this.equipped.generators) {
          this.equipped.generators.forEach(g => {
              if (g && ITEMS.generators[g]) this.speed += ITEMS.generators[g].speed;
          });
      }
      
      this.maxShield = 0;
      if (this.equipped.shields) {
          this.equipped.shields.forEach(s => {
              if (s && ITEMS.shields[s]) this.maxShield += ITEMS.shields[s].shield;
          });
      }
      // Aggiungi scudi dei droni
      if (this.equipped.droneItems) {
          this.equipped.droneItems.forEach(dArr => {
              dArr.forEach(item => {
                  if (item && ITEMS.shields[item]) this.maxShield += ITEMS.shields[item].shield;
              });
          });
      }
      
      // Aggiungi scudi del PET
      if (this.equipped.petItems) {
          this.equipped.petItems.forEach(item => {
              if (item && ITEMS.shields[item]) this.maxShield += ITEMS.shields[item].shield;
          });
      }

      // Buff globali passivi dei droni (es. Apis, Zeus)
      if (this.equipped.drones) {
          let droneShieldMultiplier = 1.0;
          this.equipped.drones.forEach(d => {
              if (d && ITEMS.drones[d] && ITEMS.drones[d].shieldBonus) {
                  droneShieldMultiplier += ITEMS.drones[d].shieldBonus;
              }
          });
          this.maxShield *= droneShieldMultiplier;
      }
      
      if (this.shield > this.maxShield) this.shield = this.maxShield;
      
      // Drone Formation Modifiers
      if (this.formation === 'turtle') {
          this.maxShield *= 1.10; // +10% shield
          this.speed *= 0.95; // -5% speed
      } else if (this.formation === 'arrow') {
          this.maxShield *= 0.90; // -10% shield
      }
      
      // Spawn o Despawn del PET in base all'equipaggiamento
      if (this.equipped.pets && this.equipped.pets.length > 0) {
          if (!this.pet || this.pet.isDead) {
              this.pet = new PET(this);
              if (typeof entityManager !== 'undefined') entityManager.addEntity(this.pet);
              // Notifica il server che il PET è attivo (darà il via al broadcast della pos)
              if (typeof wsClient !== 'undefined' && wsClient.connected) {
                  wsClient.sendPetSync(this.x + 50, this.y, 0);
              }
          }
      } else {
          if (this.pet) {
              this.pet.isDead = true;
              this.pet = null;
              // Notifica il server: PET rimosso → smette di essere incluso nel worldUpdate
              if (typeof wsClient !== 'undefined' && wsClient.connected) {
                  wsClient.sendPetDeactivate();
              }
          }
      }
      
      this.maxShield = Math.floor(this.maxShield);
      this.speed = Math.floor(this.speed);

      // ── Sprint ──────────────────────────────────────────────────────────
      const shipDef = ITEMS.ships[this.shipType];
      this.maxSprint  = shipDef.sprintBase || 8000;
      this.sprintDrain = shipDef.sprintDrain || 300;
      if (this.equipped.generators) {
          this.equipped.generators.forEach(g => {
              if (g && ITEMS.generators[g] && ITEMS.generators[g].sprintBonus)
                  this.maxSprint += ITEMS.generators[g].sprintBonus;
          });
      }
      this.maxSprint = Math.floor(this.maxSprint);
      if (this.sprint === undefined) this.sprint = this.maxSprint;
      if (this.sprint > this.maxSprint) this.sprint = this.maxSprint;

      // ── Applica buff PILOT SKILLS ────────────────────────────────────────
      const ps = this.pilotSkills || {};
      if (ps.hp     > 0) this.maxHp     = Math.floor(this.maxHp     * (1 + ps.hp     / 100));
      if (ps.speed  > 0) this.speed     = Math.floor(this.speed     * (1 + ps.speed  / 100));
      if (ps.shield > 0) this.maxShield = Math.floor(this.maxShield * (1 + ps.shield / 100));
      if (ps.sprint > 0) this.maxSprint = Math.floor(this.maxSprint * (1 + ps.sprint / 100));
      // Clamp HP / shield / sprint al nuovo massimo
      if (this.hp     > this.maxHp)     this.hp     = this.maxHp;
      if (this.shield > this.maxShield) this.shield = this.maxShield;
      if (this.sprint > this.maxSprint) this.sprint = this.maxSprint;
  }
  
  // ── Debuff rallentamento da attacco speciale alieno ──────────────────────
  applySlowDebuff(slowPct, duration, color) {
      this.slowDebuff = {
          slowPct,                    // es. 0.30 = -30% velocità
          duration,
          timeLeft: duration,
          color: color || '#a855f7',  // viola di default
          waveParticles: []
      };
      console.log(`[DEBUFF] Rallentamento ${Math.round(slowPct*100)}% per ${duration}s`);
  }

  getTotalDamage() {
      let dmg = 0;
      let laserDmg = 0;
      if (this.equipped.lasers) {
          this.equipped.lasers.forEach(l => {
              if(l && ITEMS.lasers[l]) laserDmg += ITEMS.lasers[l].damage;
          });
      }
      if (this.equipped.droneItems) {
          this.equipped.droneItems.forEach(dArr => {
              dArr.forEach(item => {
                  if (item && ITEMS.lasers[item]) laserDmg += ITEMS.lasers[item].damage;
              });
          });
      }
      dmg = laserDmg;
      if(dmg === 0) dmg = 5;
      
      // Drone Formation Modifiers
      if (this.formation === 'arrow') dmg *= 1.20;

      // Buff globali passivi dei droni (es. Zeus)
      if (this.equipped.drones) {
          let droneDamageMultiplier = 1.0;
          this.equipped.drones.forEach(d => {
              if (d && ITEMS.drones[d] && ITEMS.drones[d].damageBonus) {
                  droneDamageMultiplier += ITEMS.drones[d].damageBonus;
              }
          });
          dmg *= droneDamageMultiplier;
      }

      // ── Pilot Skills: damage globale + laser specialization ───────────
      const ps = this.pilotSkills || {};
      if (ps.damage > 0) dmg = Math.floor(dmg * (1 + ps.damage / 100));
      if (ps.laser  > 0) dmg = Math.floor(dmg * (1 + ps.laser  / 100));
      
      return Math.floor(dmg);
  }

  getMissileDamage(baseDamage) {
      const ps = this.pilotSkills || {};
      let dmg = baseDamage;
      if (ps.damage  > 0) dmg = Math.floor(dmg * (1 + ps.damage  / 100));
      if (ps.missile > 0) dmg = Math.floor(dmg * (1 + ps.missile / 100));
      return dmg;
  }

  takeDamage(amount, hitX, hitY) {
      if (this.empInvulnerable) return; // invulnerabile EMP
      this.lastDamageTime = Date.now() / 1000;
      
      // Calcola direzione dell'impatto se abbiamo le coordinate
      if (hitX !== undefined && hitY !== undefined) {
          const dx = hitX - this.x;
          const dy = hitY - this.y;
          const hitAngle = Math.atan2(dy, dx);
          
          if (!this.shieldHits) this.shieldHits = [];
          this.shieldHits.push({ angle: hitAngle, age: 0, life: 0.5, intensity: 1.0 });
      }

      if (this.shield > 0) {
          if (this.shield >= amount) {
              this.shield -= amount;
              return;
          } else {
              amount -= this.shield;
              this.shield = 0;
          }
      }
      this.hp -= amount;
      if (this.hp <= 0 && !this.isDead) {
          this.die();
      }
  }

  die() {
      if (this.isDead) return;
      this.hp = 0;
      this.isDead = true;
      console.log("[PLAYER] died — notifica server");
      for (let res in this.materials) {
          this.materials[res] = Math.floor(this.materials[res] * 0.8);
      }
      if (typeof wsClient !== 'undefined' && wsClient.connected) {
          wsClient.ws.send(JSON.stringify({ type: 'notifyDead' }));
      }
  }

  respawn() {
      // NON toccare isDead né hp qui.
      // Il reset avviene SOLO quando arriva 'respawnOk' dal server.
      console.log("[PLAYER] respawn request inviata al server");
      if (typeof wsClient !== 'undefined' && wsClient.connected) {
          wsClient.ws.send(JSON.stringify({ type: 'respawn' }));
      }
  }

  update(deltaTime) {
    super.update(deltaTime);
    
    const now = Date.now() / 1000;
    this.isRegenerating = false;
    this.isShieldRegen = false;
    this.isSprinting = false; // reset ogni frame, viene riattivato sotto se sprint attivo

// src/js/game.js o dove fai l'update loop
// Se player.js aggiorna la sua velocità ma la durata del debuff scade, 
// deve avvisare il server che non ha più il debuff. In Player.js update()
    // ── Tick Debuff rallentamento ────────────────────────────────────────────
    if (this.slowDebuff) {
        this.slowDebuff.timeLeft -= deltaTime;
        if (this.slowDebuff.timeLeft <= 0) {
            this.slowDebuff = null; // debuff scaduto
            if (typeof wsClient !== 'undefined') {
                wsClient.sendMove(this.x, this.y, this.angle, this.isRegenerating, this.isShieldRegen, this.sprintExhausted, this.empInvulnerable, null, this.isSprinting, this.isCargoFull);
            }
        } else {
            // Genera particelle scia a onde (circa 3-4 per frame)
            if (Math.random() < 0.4) {
                const wp = this.slowDebuff.waveParticles;
                wp.push({
                    x: this.x + (Math.random() - 0.5) * 10,
                    y: this.y + (Math.random() - 0.5) * 10,
                    radius: 4 + Math.random() * 6,
                    maxRadius: 28 + Math.random() * 20,
                    alpha: 0.85,
                    age: 0,
                    life: 0.8 + Math.random() * 0.6,
                    phase: Math.random() * Math.PI * 2
                });
            }
            // Aggiorna e pulisci particelle onda
            const wp = this.slowDebuff.waveParticles;
            for (let i = wp.length - 1; i >= 0; i--) {
                const p = wp[i];
                p.age += deltaTime;
                p.radius += (p.maxRadius - p.radius) * 5 * deltaTime;
                p.alpha = Math.max(0, 1 - p.age / p.life);
                if (p.age >= p.life) wp.splice(i, 1);
            }
        }
    }

    // ── Sistema SPRINT ───────────────────────────────────────────────────
    {
        const isMoving = (Math.abs(this.targetX - this.x) > 8 || Math.abs(this.targetY - this.y) > 8);
        
        if (isMoving && typeof window.playSfx === 'function') {
            if (now - this.audioTimers.move > 1.2) {
                window.playSfx('audio/movimento_astronave.mp3', 0.2);
                this.audioTimers.move = now;
            }
        }

        if (isMoving) {
            // Consuma sprint mentre ci si muove
            this.sprintStillTime = 0;
            if (this.sprint > 0) {
                this.sprint -= this.sprintDrain * deltaTime;
                if (this.sprint <= 0) {
                    this.sprint = 0;
                    this.sprintExhausted = true;
                }
                this.isSprinting = true; // sprint attivo e non esaurito
            }
            if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('sprint_regen', 200);
        } else {
            // Fermo: conta il tempo e dopo 2s inizia a recuperare (5% di maxSprint al secondo)
            this.sprintStillTime += deltaTime;
            if (this.sprintStillTime >= 2.0 && this.sprint < this.maxSprint) {
                this.sprint += this.maxSprint * 0.05 * deltaTime;
                if (typeof window.playLoopSfx === 'function') window.playLoopSfx('sprint_regen', 'audio/rigenerazione_sprint.mp3', 0.5);
                if (this.sprint >= this.maxSprint) {
                    this.sprint = this.maxSprint;
                    this.sprintExhausted = false;
                    if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('sprint_regen', 500);
                }
                // Rimuove lo stato exhausted non appena parte il recupero
                if (this.sprintExhausted && this.sprint > 0) this.sprintExhausted = false;
            } else if (this.sprint >= this.maxSprint) {
                if (typeof window.stopLoopSfx === 'function') window.stopLoopSfx('sprint_regen', 500);
            }
        }
        if (this.sprint === undefined) this.sprint = this.maxSprint;
    }

    // ── Rigenerazione SCUDO: solo se non sotto attacco da 10 secondi ──
    if (this.maxShield > 0 && this.shield < this.maxShield && !this.isDead) {
        if (now - this.lastDamageTime > 10) {
            this.isShieldRegen = true;
            this.shield += this.maxShield * 0.08 * deltaTime; // 8% al secondo
            if (this.shield > this.maxShield) this.shield = this.maxShield;
            if (now - this.audioTimers.regenShield > 1.5 && typeof window.playSfx === 'function') {
                window.playSfx('audio/generazione_scudi.mp3', 0.4);
                this.audioTimers.regenShield = now;
            }
        }
    }

    // ── Aggiorna particelle scudo ──
    if (this.isShieldRegen) {
        // Spawn nuove particelle (circa 4 per frame a 60fps)
        if (Math.random() < 0.25) {
            const angle = Math.random() * Math.PI * 2;
            const orbitR = this.radius + 14 + Math.random() * 10;
            this.shieldParticles.push({
                angle,
                orbitR,
                speed: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.5), // rad/s
                life: 0.6 + Math.random() * 0.6,
                age: 0,
                size: 2 + Math.floor(Math.random() * 3),
                color: Math.random() < 0.6 ? '#38bdf8' : (Math.random() < 0.5 ? '#7dd3fc' : '#e0f2fe')
            });
        }
    }
    // Aggiorna e pulisci particelle
    for (let i = this.shieldParticles.length - 1; i >= 0; i--) {
        const p = this.shieldParticles[i];
        p.age += deltaTime;
        p.angle += p.speed * deltaTime;
        if (p.age >= p.life) this.shieldParticles.splice(i, 1);
    }
    
    // Aggiorna gli impatti sullo scudo
    if (this.shieldHits) {
        for (let i = this.shieldHits.length - 1; i >= 0; i--) {
            const h = this.shieldHits[i];
            h.age += deltaTime;
            if (h.age >= h.life) this.shieldHits.splice(i, 1);
        }
    }

    // ── Rigenerazione HP: solo dopo 15s senza danno ──
    if (this.hp > 0 && this.hp < this.maxHp && !this.isDead) {
        if (now - this.lastDamageTime > 15) {
            this.isRegenerating = true;
            this.hp += this.maxHp * 0.05 * deltaTime;
            if (this.hp > this.maxHp) this.hp = this.maxHp;
            if (now - this.audioTimers.regenHp > 1.5 && typeof window.playSfx === 'function') {
                window.playSfx('audio/generazione_hp.mp3', 0.4);
                this.audioTimers.regenHp = now;
            }
        }
    }
    
    // 1. Gestione Movimento Point & Click
    if (inputManager.mouse.isDown && !inputManager.mouse.justClickedEntity) {
        // Se tieni premuto o clicchi sul vuoto, aggiorna il target di movimento
        this.targetX = inputManager.mouse.x;
        this.targetY = inputManager.mouse.y;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Invia pacchetto move periodico quando si muove
    if (dist > 5 && typeof wsClient !== 'undefined') {
        if (!this.lastMoveTime) this.lastMoveTime = 0;
        if (now - this.lastMoveTime > 0.1) {
            wsClient.sendMove(this.x, this.y, this.angle, this.isRegenerating, this.isShieldRegen, this.sprintExhausted, this.empInvulnerable, this.slowDebuff ? this.slowDebuff.color : null, this.isSprinting, this.isCargoFull);
            this.lastMoveTime = now;
        }
    }
    
    // Debuff velocità stiva: a stiva piena la nave perde fino al 30% della velocità base
    const cargoFillRatio = this.maxCargo > 0 ? Math.min(1, Math.max(0, this.cargo / this.maxCargo)) : 0;
    this.isCargoFull = (this.maxCargo > 0 && this.cargo >= this.maxCargo);
    this.currentSpeed = this.speed * (1 - (cargoFillRatio * 0.30));

    // Velocità effettiva: sprint esaurito = -60%, debuff rallentamento aggiuntivo
    let effectiveSpeed = this.currentSpeed;
    if (this.sprintExhausted || this.sprint <= 0) {
        effectiveSpeed *= 0.40; // 60% in meno = rimane il 40%
    }
    if (this.slowDebuff) {
        effectiveSpeed *= (1 - this.slowDebuff.slowPct);
    }

    if (dist > 5) {
        this.vx = (dx / dist) * effectiveSpeed;
        this.vy = (dy / dist) * effectiveSpeed;
        
        if (dist > 25) {
            const movingAngle = Math.atan2(dy, dx);
            this.angle = movingAngle;
            this.lastMovingAngle = movingAngle; // salva l'angolo valido più recente
        } else if (this.lastMovingAngle !== undefined) {
            this.angle = this.lastMovingAngle;
        }
    } else {
        this.vx = 0;
        this.vy = 0;
        // Snap targetX/Y sulla posizione attuale: azzera dx/dy definitivamente
        // così dist rimane 0 e non ci sono frame spuri con atan2(~0,~0) = 0
        this.targetX = this.x;
        this.targetY = this.y;
        // Congela l'angolo all'ultimo valore valido (senza bersaglio attivo)
        if ((!inputManager.targetEntity || !inputManager.isShooting)
                && this.lastMovingAngle !== undefined) {
            this.angle = this.lastMovingAngle;
        }
    }

    // Controllo disingaggio target (morte o troppa distanza)
    if (inputManager.targetEntity) {
        if (inputManager.targetEntity.isDead) {
            inputManager.targetEntity = null;
            inputManager.isShooting = false;
        } else {
            const tdist = Math.sqrt((inputManager.targetEntity.x - this.x)**2 + (inputManager.targetEntity.y - this.y)**2);
            if (tdist > 1500) {
                inputManager.targetEntity = null;
                inputManager.isShooting = false;
            }
        }
    }

    // Aggiorna angolo se c'è un bersaglio e stiamo sparando, per guardare il nemico
    if (inputManager.targetEntity && inputManager.isShooting) {
        const tdx = inputManager.targetEntity.x - this.x;
        const tdy = inputManager.targetEntity.y - this.y;
        this.angle = Math.atan2(tdy, tdx);
    }
    
    let diff = this.angle - this.formationAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.formationAngle += diff * 12 * deltaTime;
    
    // 2. Gestione Combattimento (Laser continui ON/OFF toggle)
    if (inputManager.isShooting && inputManager.targetEntity) {
        // Controllo ostilità fazione se è un giocatore
        let canShoot = true;
        if (inputManager.targetEntity instanceof OtherPlayer) {
            if (inputManager.targetEntity.faction === this.faction && mapManager.maps[mapManager.currentMap].type !== 'pvp') {
                canShoot = false; // Stessa fazione, no fuoco amico tranne in zone pvp assolute
            }
        }
        
        if (canShoot) {
            const now = Date.now() / 1000;
            if (now - this.lastShotTime > this.fireRate) {
                const distToTarget = Math.sqrt((inputManager.targetEntity.x - this.x)**2 + (inputManager.targetEntity.y - this.y)**2);
                if (distToTarget <= 600) {
                    this.shootLaser(inputManager.targetEntity);
                    this.lastShotTime = now;
                }
            }
        }
    }

    // 3. Gestione Missili
    // L'input manuale è gestito da InputManager (barra spaziatrice -> tryShootMissile)
    
    // Controllo CPU Auto-Rocket
    if (inputManager.targetEntity && inputManager.isShooting) {
        if (this.equipped.cpus && this.equipped.cpus.includes('auto-rocket')) {
            this.tryShootMissile();
        }
    }
  }
  
  // LASER con sistema munizioni
  shootLaser(target) {
      if (typeof window.playSfx === 'function') {
          window.playSfx('audio/laser_x1.mp3');
      }
      const ammoType = this.ammo ? this.ammo.laserAmmo : 'x1';
      const ammoDef  = ITEMS.laserAmmo ? ITEMS.laserAmmo[ammoType] : null;
      if (ammoType !== 'x1' && ammoDef && this.ammo && this.ammo.counts) {
          if (!this.ammo.counts[ammoType] || this.ammo.counts[ammoType] <= 0) {
              this.ammo.laserAmmo = 'x1'; // fallback x1 se esaurita
          } else {
              this.ammo.counts[ammoType]--;
          }
      }
      const baseDamage = this.getTotalDamage();
      const multiplier = ammoDef ? (ammoDef.multiplier || 1) : 1;
      const isSab      = ammoType === 'sab';
      const finalDamage = isSab ? 0 : Math.floor(baseDamage * multiplier);

      let laserColor = ammoDef ? (ammoDef.color || '#5EEAD4') : '#5EEAD4';
      // FASE 3 — slot laser nave tutti pieni → doppio fascio grosso
      let laserThickness = 2;
      let isFullSlots    = false;
      if (!isSab) {
          // Laser equipaggiati sugli slot NAVE (non droni)
          const shipSlots  = this.equipped.lasers ? this.equipped.lasers.length : 0;
          const shipLasers = this.equipped.lasers
              ? this.equipped.lasers.filter(l => l && ITEMS.lasers && ITEMS.lasers[l])
              : [];
          // Laser equipaggiati sui droni
          const droneLasers = [];
          if (this.equipped.droneItems) {
              this.equipped.droneItems.forEach(arr => {
                  arr.forEach(item => {
                      if (item && ITEMS.lasers && ITEMS.lasers[item]) droneLasers.push(item);
                  });
              });
          }
          const allLasers = [...shipLasers, ...droneLasers];
          const countLf4  = allLasers.filter(l => l === 'lf4').length;
          const countLf3  = allLasers.filter(l => l === 'lf3').length;
          // FASE 3: TUTTI gli slot laser della nave devono essere occupati
          if (shipSlots >= 2 && shipLasers.length >= shipSlots) {
              laserThickness = 4;
              isFullSlots    = true;
              if (countLf4 > 0 && countLf4 === allLasers.length)  laserColor = '#ff0000';
              else if (countLf3 > 0 && countLf3 === allLasers.length) laserColor = '#00ff44';
              else                                                  laserColor = '#ffffff';
          } else if (allLasers.length > 0) {
              const hasLf4 = countLf4 > 0, hasLf3 = countLf3 > 0;
              if      (hasLf4 && !hasLf3) laserColor = '#ff0000';
              else if (hasLf3 && !hasLf4) laserColor = '#0044ff';
              else if (hasLf4 || hasLf3)  laserColor = '#d946ef';
          }
          // Colore ammo sovrascrive SOLO se non siamo in FASE 3
          if (!isFullSlots && ammoType !== 'x1' && ammoDef) laserColor = ammoDef.color;
      }
      
      // Calcolo offset dinamico dei cannoni in base al tipo di nave
      let gunOffsetX = 0;
      let gunOffsetY = 0;
      switch(this.shipType) {
          case 'phoenix': gunOffsetX = 18; gunOffsetY = 0; break;
          case 'liberator': gunOffsetX = 18; gunOffsetY = 0; break;
          case 'nostromo': gunOffsetX = 24; gunOffsetY = 12; break; // Ali larghe
          case 'bigboy': gunOffsetX = 12; gunOffsetY = 18; break; // Ali larghe
          case 'leonov': gunOffsetX = 12; gunOffsetY = 0; break;
          case 'vengeance': gunOffsetX = 24; gunOffsetY = 3; break; // Punta avanzata
          case 'goliath': gunOffsetX = 12; gunOffsetY = 18; break; // Cannoni laterali
          case 'aegis': gunOffsetX = 6; gunOffsetY = 15; break; // Braccia laterali
          case 'spearhead': gunOffsetX = 30; gunOffsetY = 0; break; // Caccia lunghissimo
          case 'citadel': gunOffsetX = 24; gunOffsetY = 12; break; // Cannoni frontali
          case 'tartarus': gunOffsetX = 18; gunOffsetY = 15; break; // Fusoliere laterali
          case 'pusat': gunOffsetX = 24; gunOffsetY = 0; break; // Caccia a V punta centrale
      }

      // Alterna o calcola la posizione esatta dello sparo
      // Se c'è offset Y, spara un po' a destra e un po' a sinistra (simulato)
      const fireSide = (Math.random() > 0.5) ? 1 : -1;
      const cosA = Math.cos(this.angle);
      const sinA = Math.sin(this.angle);
      const fireX = this.x + (gunOffsetX * cosA) - (gunOffsetY * fireSide * sinA);
      const fireY = this.y + (gunOffsetX * sinA) + (gunOffsetY * fireSide * cosA);

      wsClient.sendShoot(this.angle, laserColor, finalDamage, fireX, fireY, laserThickness,
          target ? target.id : null,
          { ammoType, sabPct: isSab ? (ammoDef.stealPct || 0.08) : 0 , isFullSlots: isFullSlots });
  }

  // MISSILE con tipo selezionabile
  tryShootMissile() {
      if (!inputManager.targetEntity) return;
      const now   = Date.now() / 1000;
      const mType = (this.missileAmmo && this.missileAmmo.selected) || 'plt-2026';
      const mDef  = ITEMS.missiles ? (ITEMS.missiles[mType] || ITEMS.missiles['plt-2026']) : { damage: 500, cooldown: 2 };
      const cd    = mDef.cooldown || 2;
      if (now - this.lastMissileTime < cd) return;
      const dist = Math.sqrt((inputManager.targetEntity.x - this.x) ** 2 + (inputManager.targetEntity.y - this.y) ** 2);
      if (dist > 400) return;   // missili: range più corto dei laser (laser = 600)
      if (this.missileAmmo && this.missileAmmo.counts) {
          if (!this.missileAmmo.counts[mType] || this.missileAmmo.counts[mType] <= 0) return;
          this.missileAmmo.counts[mType]--;
      }
      this.shootMissile(inputManager.targetEntity, mDef, mType);
      this.lastMissileTime = now;
  }

  shootMissile(target, mDef, mType) {
      const damage = mDef ? mDef.damage : 500;
      const mColor = mDef ? (mDef.color || '#ff8800') : '#ff8800';
      const thickness = mDef ? (mDef.radius || 6) : 6;
      if (typeof wsClient !== 'undefined' && typeof wsClient.sendShoot === 'function') {
          wsClient.sendShoot(this.angle, mColor, damage, this.x, this.y, thickness,
              target ? target.id : null,
              { missileType: mType || 'plt-2026', mDef });
      }
  }

  // Piazza mina nello spazio
  placeMine() {
      const now = Date.now() / 1000;
      if (now - this.lastMineTime < 2) return; // cooldown 2s tra mine
      const mType = (this.mineAmmo && this.mineAmmo.selected) || 'mine-normal';
      if (this.mineAmmo && this.mineAmmo.counts) {
          if (!this.mineAmmo.counts[mType] || this.mineAmmo.counts[mType] <= 0) {
              console.log('[MINE] Esaurite: ' + mType); return;
          }
          this.mineAmmo.counts[mType]--;
      }
      if (typeof wsClient !== 'undefined' && typeof wsClient.sendPlaceMine === 'function') {
          wsClient.sendPlaceMine(this.x, this.y, mType);
      }
      // Sound feedback per tipo di mina
      if (typeof window.playSfx === 'function') {
          if (mType === 'mine-slow') {
              window.playSfx('audio/piazzamento_mina_slow.mp3', 0.85);
          } else {
              window.playSfx('audio/piazzamento_mina_normale.mp3', 0.85);
          }
      }
      this.lastMineTime = now;
  }

  // Usa EMP
  useEMP() {
      const now = Date.now() / 1000;
      const cd  = ITEMS.emp && ITEMS.emp['emp-01'] ? ITEMS.emp['emp-01'].cooldown : 20;
      if (now - this.lastEmpTime < cd) {
          console.log('[EMP] Cooldown: ' + Math.ceil(cd - (now - this.lastEmpTime)) + 's'); return;
      }
      if (!this.empAmmo || !this.empAmmo.counts || !this.empAmmo.counts['emp-01'] || this.empAmmo.counts['emp-01'] <= 0) {
          console.log('[EMP] Esaurito'); return;
      }
      this.empAmmo.counts['emp-01']--;
      this.lastEmpTime = now;
      // Effetto locale: azzera target lock
      if (typeof inputManager !== 'undefined') {
          inputManager.targetEntity = null;
          inputManager.isShooting   = false;
      }
      if (typeof wsClient !== 'undefined' && typeof wsClient.sendEMP === 'function') {
          wsClient.sendEMP(this.x, this.y, ITEMS.emp['emp-01'].range || 400);
      }
      // Feedback visivo: aggiunge particelle EMP
      if (typeof entityManager !== 'undefined') {
          for (let i = 0; i < 20; i++) {
              const p = new Particle(this.x, this.y, '#22d3ee');
              p.vx = (Math.random() - 0.5) * 500;
              p.vy = (Math.random() - 0.5) * 500;
              p.life = 0.5 + Math.random() * 0.4;
              entityManager.addEntity(p);
          }
      }
  }

  // Usa Smart Bomb (area attorno alla nave) — cooldown 5s dedicato
  useSmartBomb() {
      const now = Date.now() / 1000;
      const sbCd = 5;
      if (now - this.lastSmartBombTime < sbCd) {
          console.log('[SMARTBOMB] Cooldown: ' + Math.ceil(sbCd - (now - this.lastSmartBombTime)) + 's');
          return;
      }
      if (!this.mineAmmo || !this.mineAmmo.counts || !this.mineAmmo.counts['smart-bomb'] || this.mineAmmo.counts['smart-bomb'] <= 0) {
          console.log('[SMARTBOMB] Esaurita'); return;
      }
      this.lastSmartBombTime = now;
      this.mineAmmo.counts['smart-bomb']--;
      const def = ITEMS.mines['smart-bomb'];
      if (typeof wsClient !== 'undefined' && typeof wsClient.sendSmartBomb === 'function') {
          wsClient.sendSmartBomb(this.x, this.y, def.aoeRadius || 350, def.damage || 3500);
      }
      // Effetto visivo
      if (typeof entityManager !== 'undefined') {
          for (let i = 0; i < 35; i++) {
              const p = new Particle(this.x, this.y, i % 3 === 0 ? '#f59e0b' : (i % 3 === 1 ? '#ef4444' : '#ffffff'));
              p.vx = (Math.random() - 0.5) * 700;
              p.vy = (Math.random() - 0.5) * 700;
              p.life = 0.4 + Math.random() * 0.6;
              entityManager.addEntity(p);
          }
      }
  }

  // Seleziona munizione laser
  selectLaserAmmo(type) {
      if (!ITEMS.laserAmmo || !ITEMS.laserAmmo[type]) return;
      this.ammo.laserAmmo = type;
  }

  // Seleziona missile
  selectMissile(type) {
      if (!ITEMS.missiles || !ITEMS.missiles[type]) return;
      this.missileAmmo.selected = type;
  }

  // Seleziona mina
  selectMine(type) {
      if (!ITEMS.mines || !ITEMS.mines[type]) return;
      this.mineAmmo.selected = type;
  }

  // Seleziona speciale
  selectSpecial(type) {
      this.selectedSpecial = type;
  }

  // Usa lo speciale selezionato
  useSelectedSpecial() {
      if (!this.selectedSpecial) return;
      switch (this.selectedSpecial) {
          case 'mine-normal':
          case 'mine-slow':
              this.mineAmmo.selected = this.selectedSpecial;
              this.placeMine();
              break;
          case 'smart-bomb':
              this.useSmartBomb();
              break;
          case 'emp-01':
              this.useEMP();
              break;
      }
  }

  tryJump() {
      if (typeof mapManager === 'undefined') return;
      const portals = entityManager.entities.filter(e => e instanceof Portal);
      for (let p of portals) {
          const dx = this.x - p.x;
          const dy = this.y - p.y;
          if (Math.sqrt(dx*dx + dy*dy) < p.radius + this.radius) {
              mapManager.changeMap(p.targetMap);
              if (typeof wsClient !== 'undefined' && typeof wsClient.sendChangeMap === 'function') {
                  wsClient.sendChangeMap(p.targetMap);
              }
              break;
          }
      }
  }

  draw(ctx) {
    // ── Animazione scia a onde DEBUFF rallentamento ───────────────────────
    if (this.slowDebuff && this.slowDebuff.waveParticles.length > 0) {
        const col = this.slowDebuff.color || '#a855f7';
        for (const p of this.slowDebuff.waveParticles) {
            ctx.save();
            ctx.globalAlpha = p.alpha * 0.7;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            // Cerchio ondulato: aggiungiamo una leggera deformazione sinusoidale
            ctx.beginPath();
            const steps = 32;
            for (let s = 0; s <= steps; s++) {
                const a = (s / steps) * Math.PI * 2;
                const wave = Math.sin(a * 4 + p.phase + p.age * 6) * 3;
                const r = p.radius + wave;
                const px = p.x + Math.cos(a) * r;
                const py = p.y + Math.sin(a) * r;
                s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // Indicatore testo debuff sopra la nave
        const timeLeft = this.slowDebuff.timeLeft.toFixed(1);
        const pct = Math.round(this.slowDebuff.slowPct * 100);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = this.slowDebuff.color || '#a855f7';
        ctx.font = 'bold 11px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`⚡-${pct}% (${timeLeft}s)`, this.x, this.y - this.radius - 28);
        ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.formationAngle);
    
    // Anima propulsori se la nave si sta muovendo (distanza dal target > tolleranza)
    const isMoving = Math.abs(this.targetX - this.x) > 5 || Math.abs(this.targetY - this.y) > 5;
    if (isMoving) {
        // Offset personalizzato per ogni nave
        let engOffset = -this.radius; 
        switch(this.shipType) {
            case 'phoenix': engOffset = -18; break;
            case 'liberator': engOffset = -15; break;
            case 'nostromo': engOffset = -24; break;
            case 'bigboy': engOffset = -30; break;
            case 'leonov': engOffset = -18; break;
            case 'vengeance': engOffset = -30; break;
            case 'goliath': engOffset = -30; break;
            case 'aegis': engOffset = -24; break;
            case 'spearhead': engOffset = -24; break;
            case 'citadel': engOffset = -36; break;
            case 'tartarus': engOffset = -30; break;
            case 'pusat': engOffset = -24; break;
        }

        if (this.sprintExhausted || this.sprint <= 0) {
            // Motori scarichi: fiammella piccola e tremolante, colore spento
            const flickerLen = 5 + Math.random() * 6;
            ctx.fillStyle = (Date.now() % 300 < 150) ? '#475569' : '#64748b';
            ctx.beginPath();
            ctx.moveTo(engOffset + 5, -3);
            ctx.lineTo(engOffset - flickerLen, 0);
            ctx.lineTo(engOffset + 5, 3);
            ctx.fill();
        } else {
            // Propulsori normali
            ctx.fillStyle = (Date.now() % 200 < 100) ? '#f97316' : '#fef08a';
            ctx.beginPath();
            ctx.moveTo(engOffset + 5, -5);
            ctx.lineTo(engOffset - 15 - Math.random() * 10, 0);
            ctx.lineTo(engOffset + 5, 5);
            ctx.fill();
        }
    }
    
    const s = 6;
    const drawPix = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x*s, y*s, w*s, h*s); };
    const drawSymH = (x, y, w, h, c) => { drawPix(x, y, w, h, c); if (y !== 0) drawPix(x, -y - h, w, h, c); };
    const neon = '#5EEAD4';
    
    switch (this.shipType) {
        case 'phoenix': 
            // Caccia leggero base (tipo X-Wing chiuso)
            drawPix(-3,-1.5,6,3,'#94A3B8'); 
            drawSymH(-4,1.5,3,1,'#475569'); 
            drawPix(1,-0.5,3,1,neon); 
            drawSymH(-2,2.5,1,1,'#F59E0B'); // mini laser ai lati
            break;
            
        case 'liberator': 
            // Caccia a dardo (stile Jedi Starfighter)
            drawPix(-2,-1,5,2,'#94A3B8'); 
            drawSymH(-4,1,3,1,'#475569'); 
            drawSymH(-1,2,2,1,'#334155'); 
            drawPix(3,-0.5,3,1,neon); 
            break;
            
        case 'nostromo': 
            // Fregata industriale squadrata (stile Y-Wing massiccio)
            drawPix(-4,-2,8,4,'#475569'); 
            drawSymH(-2,2,6,1.5,'#334155'); 
            drawSymH(2,3.5,4,1,'#1E293B'); // piloni anteriori
            drawPix(-1,-1,4,2,neon); 
            break;
            
        case 'bigboy': 
            // Incrociatore corazzato tozzo (stile bombardiere pesante)
            drawPix(-5,-3.5,10,7,'#78350F'); 
            drawSymH(-3,3.5,8,2,'#451A03'); 
            drawSymH(0,5.5,3,1.5,'#D97706'); // torrette laterali
            drawPix(2,-2,4,4,neon); 
            break;
            
        case 'leonov': 
            // Caccia intercettore alieno (forme curve/viola tipo Covenant/Tie Interceptor)
            drawPix(-3,-1.5,7,3,'#7E22CE'); 
            drawSymH(-2,1.5,3,1,'#581C87'); 
            drawSymH(1,2.5,3,1.5,'#3B0764'); // ali a sciabola in avanti
            drawPix(2,-1,3,2,neon); 
            break;
            
        case 'vengeance': 
            // Caccia puro ad ala a delta (A-Wing / caccia stealth)
            drawPix(-4,-1.5,8,3,'#EAB308'); 
            drawSymH(-5,1.5,4,2,'#A16207'); 
            drawSymH(-2,3.5,3,1.5,'#713F12'); // ali esterne arretrate
            drawPix(4,-0.5,2,1,neon); // cabina molto avanzata
            break;
            
        case 'goliath': 
            // Corazzata da battaglia principale (Star Destroyer in miniatura / incrociatore)
            drawPix(-5,-3,10,6,'#991B1B'); 
            drawSymH(-4,3,8,2,'#7F1D1D'); 
            drawSymH(-2,5,6,1.5,'#450A0A'); 
            drawSymH(2,6.5,2,1,'#F87171'); // cannoni sporgenti
            drawPix(1,-1.5,4,3,neon); 
            break;
            
        case 'aegis': 
            // Nave di supporto medico/ingegneristico (forma a U o pinza, stile Nebulon-B ibrida)
            drawPix(-4,-2.5,7,5,'#166534'); 
            drawSymH(1,2.5,4,2,'#14532D'); // braccia estese in avanti
            drawSymH(-2,4.5,3,1.5,'#064E3B'); // scudi laterali
            drawPix(-1,-1,3,2,neon); 
            break;
            
        case 'spearhead': 
            // Ricognitore stealth ultra-sottile (stile SR-71 Blackbird)
            drawPix(-2,-1,10,2,'#0891B2'); 
            drawSymH(-4,1,4,1,'#164E63'); 
            drawSymH(-1,2,2,0.5,'#083344'); 
            drawPix(5,-0.5,4,1,neon); // cabina a punta lunghissima
            break;
            
        case 'citadel': 
            // Fortezza volante colossale (forma a blocco/esagono, stile incrociatore imperiale pesante)
            drawPix(-6,-5,12,10,'#C2410C'); 
            drawSymH(-4,5,10,3,'#7C2D12'); 
            drawSymH(-2,8,8,2,'#431407'); // piastre armature aggiuntive estreme
            drawPix(4,-2,3,4,neon); 
            break;
            
        case 'tartarus': 
            // Caccia pesante d'assalto (Doppia fusoliera, stile Tie Bomber / pod racer corazzato)
            drawPix(-3,-1.5,8,3,'#DC2626'); // corpo centrale
            drawSymH(-5,3,9,2.5,'#991B1B'); // piloni massicci separati
            drawSymH(2,5.5,2,1.5,'#FCA5A5'); // armi sui piloni
            drawPix(3,-1,3,2,neon); 
            break;
            
        case 'pusat': 
            // Caccia intercettore leggero avanzato (forma a freccia estrema V-Shape)
            drawPix(-2,-1,8,2,'#BE123C'); 
            drawSymH(-4,1,5,1.5,'#881337'); 
            drawSymH(0,2.5,4,1,'#4C0519'); // ali proiettate in avanti acute
            drawPix(4,-0.5,3,1,neon); 
            break;
        default: drawPix(-2,-2,4,4,'#FFFFFF'); break;
    }

    ctx.restore();
    
    if (this.shield > 0) {
        // Calcola quanti slot scudo nave sono occupati
        const maxShSlots    = ITEMS.ships[this.shipType] ? ITEMS.ships[this.shipType].shieldSlots || 1 : 1;
        const _usedShSlots  = this.equipped && this.equipped.shields ? this.equipped.shields.filter(s => s).length : 0;
        const fillRatio     = _usedShSlots / maxShSlots;

        const _shAlpha  = 0.25 + 0.35 * (this.shield / this.maxShield);
        const _baseRad  = this.radius + 35; // Ripristinato il raggio base originale
        
        // Calcola deformazione dello scudo dovuta agli impatti
        let deformArray = new Array(32).fill(0); // Deformazione per 32 angoli
        if (this.shieldHits && this.shieldHits.length > 0) {
            for (const hit of this.shieldHits) {
                const impactStr = Math.max(0, 1 - hit.age / hit.life) * 15; // Deformazione max 15px
                for (let a = 0; a < 32; a++) {
                    const angleRad = (a / 32) * Math.PI * 2;
                    let diff = Math.abs(angleRad - hit.angle);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    // Distribuisci la deformazione lungo l'arco (Gaussiana approssimata)
                    if (diff < Math.PI / 2) {
                        deformArray[a] += impactStr * Math.cos(diff);
                        
                        // Effetto Pixel Danno sulla deformazione
                        if (Math.random() < 0.4 && hit.age < 0.2) {
                            ctx.fillStyle = (Math.random() > 0.5) ? '#38bdf8' : '#e0f2fe';
                            const pRad = _baseRad - deformArray[a] + (Math.random()-0.5)*5;
                            const px = this.x + Math.cos(angleRad) * pRad;
                            const py = this.y + Math.sin(angleRad) * pRad;
                            const pSize = 1 + Math.floor(Math.random()*3);
                            ctx.fillRect(px, py, pSize, pSize);
                        }
                    }
                }
            }
        }
        
        // Funzione helper per disegnare un cerchio deformato
        const drawDeformedCircle = (baseRadius, alpha, lineWidth) => {
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            for (let a = 0; a <= 32; a++) {
                const idx = a % 32;
                const angleRad = (a / 32) * Math.PI * 2;
                // Deforma raggio verso l'interno (danno)
                const r = baseRadius - deformArray[idx];
                const px = this.x + Math.cos(angleRad) * r;
                const py = this.y + Math.sin(angleRad) * r;
                if (a === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        };

        // Cerchio 1 — sempre presente
        drawDeformedCircle(_baseRad, _shAlpha, 2);

        if (this.shield / this.maxShield > 0.8) {
            ctx.strokeStyle = 'rgba(125, 211, 252, ' + (this.shield / this.maxShield) * 0.2 + ')';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, _baseRad, 0, Math.PI * 2);
            ctx.stroke(); // Il bordo grosso lo lasciamo liscio come base
        }

        // Cerchio 2 se >= 50% degli slot occupati
        if (fillRatio >= 0.5) {
            drawDeformedCircle(_baseRad + 10, _shAlpha * 0.5, 1.5);
        }

        // Cerchio 3 se tutti gli slot occupati (100%)
        if (fillRatio >= 1.0) {
            drawDeformedCircle(_baseRad + 22, _shAlpha * 0.2, 1);
        }
    }
    
    // ── Animazione particelle pixel durante ricarica scudo ──
    if (this.shieldParticles && this.shieldParticles.length > 0) {
        for (const p of this.shieldParticles) {
            const alpha = Math.max(0, 1 - p.age / p.life);
            const px = this.x + Math.cos(p.angle) * p.orbitR;
            const py = this.y + Math.sin(p.angle) * p.orbitR;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            // Pixel quadrato (pixel-art style)
            ctx.fillRect(Math.round(px) - Math.floor(p.size / 2),
                         Math.round(py) - Math.floor(p.size / 2),
                         p.size, p.size);
        }
        ctx.globalAlpha = 1.0;

        // Anello pulsante durante ricarica
        const pulse = 0.3 + 0.4 * Math.abs(Math.sin(Date.now() / 300));
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 22, 0, Math.PI * 2); // Ripristinato a +22
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (this.isRegenerating) {
        ctx.strokeStyle = (Date.now() % 200 < 100) ? '#4ade80' : '#22c55e';
        ctx.lineWidth = 2; // Spessore dimezzato per renderlo visibile ma non invasivo
        ctx.beginPath();
        for (let i = 0; i <= Math.PI * 2; i += 0.5) {
            const r = this.radius + 25 + Math.random() * 8; // Ripristinato il raggio a +20 originale
            const hx = this.x + Math.cos(i) * r;
            const hy = this.y + Math.sin(i) * r;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Animazione Invulnerabilità EMP
    if (this.empInvulnerable) {
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 200));
        ctx.strokeStyle = `rgba(34, 211, 238, ${pulse})`; // #22d3ee
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 40, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = `rgba(34, 211, 238, ${pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 40, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ── Draw Drones con animazione di transizione fluida ─────────────────
    let validDronesCount = 0;
    this.equipped.drones.forEach(d => { if(d) validDronesCount++; });

    // Calcola posizioni TARGET per ogni drone in base alla formazione attuale
    const _droneTargets = [];
    let _ci = 0;
    for (let i = 0; i < this.equipped.drones.length; i++) {
        if (!this.equipped.drones[i]) continue;
        let ox = 0, oy = 0;
        if (this.formation === 'arrow') {
            const isLeft = _ci % 2 === 0;
            const pairIndex = Math.floor(_ci / 2);
            ox = -30 - (pairIndex * 25);
            oy = (isLeft ? -1 : 1) * (55 + pairIndex * 25);
        } else if (this.formation === 'turtle') {
            const baseOffsetAngle = (_ci * Math.PI * 2 / validDronesCount);
            ox = Math.cos(baseOffsetAngle) * 90;
            oy = Math.sin(baseOffsetAngle) * 90;
        } else {
            const pos = getStandardDroneOffset(_ci);
            ox = pos.x; oy = pos.y;
        }
        const cosA = Math.cos(this.formationAngle);
        const sinA = Math.sin(this.formationAngle);
        _droneTargets.push({
            wx: this.x + (ox * cosA - oy * sinA),
            wy: this.y + (ox * sinA + oy * cosA)
        });
        _ci++;
    }

    // Inizializza posizioni correnti se necessario (prima volta o numero droni cambiato)
    if (!this.droneCurrentPositions) this.droneCurrentPositions = [];
    while (this.droneCurrentPositions.length < _droneTargets.length) {
        const t = _droneTargets[this.droneCurrentPositions.length];
        this.droneCurrentPositions.push({ x: t.wx, y: t.wy });
    }
    if (this.droneCurrentPositions.length > _droneTargets.length)
        this.droneCurrentPositions.length = _droneTargets.length;

    // Interpola posizioni correnti verso target — velocità transizione
    const _lerpSpeed = 4.0; // unità/s in proporzione — regola fluidità
    const _dtApprox = 0.016; // ~60fps, usato per lerp nel draw
    for (let di = 0; di < _droneTargets.length; di++) {
        const cur = this.droneCurrentPositions[di];
        const tgt = _droneTargets[di];
        const dxL = tgt.wx - cur.x;
        const dyL = tgt.wy - cur.y;
        const distL = Math.sqrt(dxL*dxL + dyL*dyL);
        if (distL > 0.5) {
            const step = Math.min(distL, distL * _lerpSpeed * _dtApprox + 2.5);
            cur.x += (dxL / distL) * step;
            cur.y += (dyL / distL) * step;
        } else {
            cur.x = tgt.wx; cur.y = tgt.wy;
        }
    }

    let currentIndex = 0;
    for(let i=0; i<this.equipped.drones.length; i++) {
        const type = this.equipped.drones[i];
        if(!type) continue;

        const dronePos = this.droneCurrentPositions[currentIndex] || _droneTargets[currentIndex];
        const dx = dronePos ? dronePos.x : this.x;
        const dy = dronePos ? dronePos.y : this.y;
        
        ctx.save();
        ctx.translate(dx, dy);
        // Il drone punta nella stessa direzione della formazione
        ctx.rotate(this.formationAngle);
        
        if (type === 'iris') {
            ctx.fillStyle = '#10B981'; // Smeraldo per l'Iris
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8); ctx.fill();
            ctx.fillStyle = '#6EE7B7';
            ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-5, 3); ctx.lineTo(-3, 0); ctx.lineTo(-5, -3); ctx.fill();
            ctx.fillStyle = '#065F46';
            ctx.beginPath(); ctx.arc(-4, 0, 2, 0, Math.PI*2); ctx.fill();
        } else if (type === 'apis') {
            ctx.fillStyle = '#F59E0B'; // Ambra per l'Apis
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
            ctx.fillStyle = '#92400E';
            ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
        } else if (type === 'zeus') {
            ctx.fillStyle = '#EAB308'; // Oro per lo Zeus
            ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
            ctx.fillStyle = '#854D0E';
            ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
        } else { // flax
            ctx.fillStyle = '#64748B'; // Grigio scuro per il Flax
            ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.fill();
            ctx.fillStyle = '#94A3B8';
            ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-4, 2); ctx.lineTo(-2, 0); ctx.lineTo(-4, -2); ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath(); ctx.arc(-3, 0, 1.5, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        currentIndex++;
    }
    
    // Draw Target Indicator if this is target
    if (typeof inputManager !== 'undefined' && inputManager.targetEntity === this) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 35, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── Barre HP + Scudo sotto la nave del player ─────────────────────────
    const inParty = this.party && this.party.members && this.party.members.length > 1;
    const partyLabel = inParty ? (this.party.name || 'PARTY') : false;
    drawShipBars(ctx, this.x, this.y, this.radius,
        this.hp, this.maxHp, this.shield, this.maxShield,
        { nameLabel: this.username || null, isPlayer: true, faction: this.faction, partyLabel: partyLabel, pilotLevel: this.pilotLevel });

    // Linea di navigazione
    if (this.targetX !== this.x || this.targetY !== this.y) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        if (Math.sqrt(dx*dx + dy*dy) > 10) {
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.targetX, this.targetY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // X di arrivo
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(this.targetX - 5, this.targetY - 5);
            ctx.lineTo(this.targetX + 5, this.targetY + 5);
            ctx.moveTo(this.targetX + 5, this.targetY - 5);
            ctx.lineTo(this.targetX - 5, this.targetY + 5);
            ctx.stroke();
        }
    }
  }
}
