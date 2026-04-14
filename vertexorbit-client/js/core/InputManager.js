class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, screenX: 0, screenY: 0, isDown: false, clicked: false, rightClicked: false };
    this.targetEntity = null;
    this.isShooting = false;

    window.addEventListener('keydown', (e) => {
        if (window.isBindingKey) return; // Non gestire input di gioco se stiamo bindando
        this.keys[e.code] = true;
        const k = window.gameSettings?.keys || { shoot: 'ControlLeft', special: 'Space', formation: 'ShiftLeft', jump: 'KeyJ' };
        const isShootKey = e.code === k.shoot || e.key === k.shoot || e.key.toLowerCase() === k.shoot.toLowerCase();

        if (isShootKey && !e.repeat && typeof gameState !== 'undefined' && gameState === 'playing') {
            e.preventDefault();
            if (typeof player === 'undefined' || player.isDead) return;

            if (this.targetEntity && this.isShooting) {
                // Target attivo → Ctrl lo disattiva
                this.targetEntity = null;
                this.isShooting   = false;
            } else {
                // Nessun target attivo → aggancia il nemico PIÙ VICINO (ignora precedente)
                let nearest = null;
                let minDist = Infinity;
                if (typeof entityManager !== 'undefined') {
                    for (const ent of entityManager.entities) {
                        // Aggancia Enemy o OtherPlayer (se non è della stessa fazione e non è in safe-zone/EMP)
                        if (!ent.isDead && (ent instanceof Enemy || ent instanceof OtherPlayer)) {
                            // Non targettare compagni di fazione se non in PvP arena
                            if (ent instanceof OtherPlayer && ent.faction === player.faction && mapManager.maps[mapManager.currentMap].type !== 'pvp') continue;
                            if (ent instanceof OtherPlayer && ent.empInvulnerable) continue;
                            
                            const d = Math.hypot(ent.x - player.x, ent.y - player.y);
                            if (d < minDist) { minDist = d; nearest = ent; }
                        }
                    }
                }
                if (nearest) {
                    this.targetEntity = nearest;
                    this.isShooting   = true;
                }
            }
        }

        const isSpecialKey = e.code === k.special || e.key === k.special || e.key.toLowerCase() === k.special.toLowerCase();
        if (isSpecialKey && typeof gameState !== 'undefined' && gameState === 'playing') {
            if (typeof player !== 'undefined') player.useSelectedSpecial();
        }

        // ── Tasto H: BASE — solo se nella propria safe zone (stesso check del bottone BASE) ──
        if (e.code === 'KeyH' && typeof gameState !== 'undefined') {
            if (gameState === 'hangar') {
                changeGameState('playing');
            } else if (gameState === 'playing') {
                const btnBase = document.getElementById('btn-base');
                if (btnBase && !btnBase.disabled) {
                    changeGameState('hangar');
                }
                // Fuori dalla base: tasto ignorato silenziosamente
            }
        }

        // Scorciatoia per Shop (B)
        if (e.code === 'KeyB' && typeof gameState !== 'undefined') {
            if (gameState === 'playing') {
                const btnBase = document.getElementById('btn-base');
                if (btnBase && !btnBase.disabled) changeGameState('shop');
            } else if (gameState === 'shop') changeGameState('playing');
            else if (gameState === 'hangar') {
                if (typeof uiManager !== 'undefined') uiManager.switchBaseTab('shop');
            }
        }

        const isJumpKey = e.code === k.jump || e.key === k.jump || e.key.toLowerCase() === k.jump.toLowerCase();
        if (isJumpKey && typeof gameState !== 'undefined' && gameState === 'playing') {
            if (typeof player !== 'undefined') player.tryJump();
        }

        if (typeof gameState !== 'undefined' && gameState === 'playing' && typeof player !== 'undefined') {
            const isFormationKey = e.code === k.formation || e.key === k.formation || e.key.toLowerCase() === k.formation.toLowerCase();
            if (isFormationKey || e.code === 'ShiftRight') {
                e.preventDefault();
                const now = Date.now() / 1000;
                const cd = player.formationSwitchCd || 5;
                if (now - (player.lastFormationSwitchTime || 0) < cd) {
                    const rem = Math.ceil(cd - (now - (player.lastFormationSwitchTime || 0)));
                    if (typeof entityManager !== 'undefined')
                        entityManager.addEntity(new DamageText(player.x, player.y - 30, `FORMATION CD ${rem}s`, 'loot', '#f59e0b'));
                    return;
                }
                player.lastFormationSwitchTime = now;
                // Salva posizioni correnti prima dello switch per animazione fluida
                player.droneCurrentPositions = (player.droneCurrentPositions || []).slice();
                const formations = ['standard', 'arrow', 'turtle'];
                const idx = formations.indexOf(player.formation || 'standard');
                player.formation = formations[(idx + 1) % formations.length];
                player.recalculateStats();
            }
        }

        if (e.code === 'KeyL' && typeof gameState !== 'undefined' && gameState === 'playing') {
            if (typeof mapManager !== 'undefined' && mapManager.maps[mapManager.currentMap].type === 'safe') {
                changeGameState('menu');
            }
        }
    });

    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('mousemove', (e) => {
      this.mouse.screenX = e.clientX;
      this.mouse.screenY = e.clientY;
      this.updateMouseWorld();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (typeof gameState !== 'undefined' && gameState === 'playing') {
            if (e.button === 0) {
                this.updateMouseWorld();
                this.mouse.isDown = true;
                this.mouse.justClickedEntity = false;
                
                const ctxMenu = document.getElementById('player-context-menu');
                if (ctxMenu && !e.target.closest('#player-context-menu')) {
                    ctxMenu.classList.add('hidden');
                }

                if (this.mouse.hoverEntity) {
                    if (this.targetEntity !== this.mouse.hoverEntity) {
                        this.isShooting = false;
                    }
                    this.targetEntity = this.mouse.hoverEntity;
                    this.mouse.justClickedEntity = true;

                    if (this.targetEntity instanceof OtherPlayer && this.targetEntity.faction === player.faction) {
                        if (ctxMenu) {
                            ctxMenu.style.left = e.clientX + 'px';
                            ctxMenu.style.top = e.clientY + 'px';
                            ctxMenu.classList.remove('hidden');
                            document.getElementById('context-player-name').textContent = this.targetEntity.id;
                            const btnInvite = document.getElementById('btn-invite-party');
                            btnInvite.onclick = () => {
                                if(typeof wsClient !== 'undefined') wsClient.ws.send(JSON.stringify({type:'partyInvite', targetUsername: this.targetEntity.id}));
                                ctxMenu.classList.add('hidden');
                            };
                        }
                    }
                }
            } else if (e.button === 2) {
                this.targetEntity = null;
                this.isShooting = false;
            }
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouse.isDown = false;
    });
  }

  updateMouseWorld() {
    this.mouse.x = this.mouse.screenX + (typeof camera !== 'undefined' ? camera.x : 0);
    this.mouse.y = this.mouse.screenY + (typeof camera !== 'undefined' ? camera.y : 0);
    this.mouse.hoverEntity = null;
    if (typeof entityManager !== 'undefined') {
        for (let i = entityManager.entities.length - 1; i >= 0; i--) {
            const ent = entityManager.entities[i];
            // Non permettere di cliccare su OtherPlayer con EMP attivo
            if (ent instanceof Enemy ||
                (ent instanceof OtherPlayer && !(ent.empInvulnerable))) {
                const dx = this.mouse.x - ent.x;
                const dy = this.mouse.y - ent.y;
                if (Math.sqrt(dx*dx + dy*dy) <= ent.radius + 20) {
                    this.mouse.hoverEntity = ent;
                    break;
                }
            }
        }
    }
  }

  checkEntityClick() {}

  update() {
    this.updateMouseWorld();
    // Se il target corrente e' un OtherPlayer con EMP attivo, rimuovilo
    if (this.targetEntity instanceof OtherPlayer && this.targetEntity.empInvulnerable) {
        this.targetEntity = null;
        this.isShooting   = false;
    }
  }

  isKeyDown(code) {
    if (typeof gameState !== 'undefined' && gameState !== 'playing') return false;
    return !!this.keys[code];
  }
}
