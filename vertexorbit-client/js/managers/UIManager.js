class UIManager {
  constructor() {
    this.hpEl = document.getElementById('hp-val');
    this.maxHpEl = document.getElementById('maxhp-val');
    this.shieldEl = document.getElementById('shield-val');
    this.maxShieldEl = document.getElementById('maxshield-val');
    this.speedEl = document.getElementById('speed-val');
    this.sprintEl = document.getElementById('sprint-val');
    this.maxSprintEl = document.getElementById('maxsprint-val');
    this.creditsEl = document.getElementById('credits-val');
    this.uridiumEl = document.getElementById('uridium-val');
    this.shipEl = document.getElementById('ship-val');
    this.mapEl = document.getElementById('map-val');
    this.mapTypeEl = document.getElementById('map-type-val');
    this.cargoEl = document.getElementById('cargo-val');
    this.maxCargoEl = document.getElementById('maxcargo-val');
    this.uiLayer = document.getElementById('ui-layer');
    this.menuScreen = document.getElementById('menu-screen');
    this.hangarScreen = document.getElementById('hangar-screen');
    this.shopScreen = document.getElementById('shop-screen');
    this.dragState = null;
    this._didDrag = false;
    this._dragStartTime = 0;
    this._currentBaseTab = 'hangar';

    // ── BASE Button (enable/disable based on safe zone) ────────────
    const btnBase = document.getElementById('btn-base');
    if (btnBase) {
      btnBase.addEventListener('click', () => {
        if (!btnBase.disabled) changeGameState('hangar');
      });
    }

    // ── BASE tab buttons ────────────────────────────────────────────────────
    document.getElementById('btn-sell-all-cargo')?.addEventListener('click', () => this.sellAllCargo());
    document.getElementById('btn-quick-sell')?.addEventListener('click', () => this.sellAllCargo());

    // ── Shop cat buttons inside the base shop panel ─────────────────
    document.querySelectorAll('#base-panel-shop .shop-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shopFilter = btn.dataset.cat;
        document.querySelectorAll('#base-panel-shop .shop-cat-btn').forEach(b => b.classList.remove('active-config'));
        btn.classList.add('active-config');
        this.renderShopCatalog();
      });
    });

    document.getElementById('btn-close-hangar').addEventListener('click', () => changeGameState('playing'));
    document.getElementById('btn-close-shop')?.addEventListener('click', () => changeGameState('playing'));
    document.getElementById('btn-go-hangar-from-shop')?.addEventListener('click', () => changeGameState('hangar'));

    document.getElementById('btn-leaderboard').addEventListener('click', () => {
      const panel = document.getElementById('leaderboard-panel');
      if (panel) {
        panel.classList.toggle('hidden');
        // Blocca input di gioco quando la leaderboard è aperta
        if (!panel.classList.contains('hidden')) {
          if (typeof wsClient !== 'undefined') wsClient.requestLeaderboard?.();
        }
      }
    });

    // Chiudi leaderboard col bottone interno
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-close-leaderboard') {
        const panel = document.getElementById('leaderboard-panel');
        if (panel) panel.classList.add('hidden');
      }
    });

    document.getElementById('btn-config-1').addEventListener('click', () => this.selectConfig(1));
    document.getElementById('btn-config-2').addEventListener('click', () => this.selectConfig(2));

    this.viewingConfig = 1;
    this.shopFilter = 'ships';
    this.shopCatalog = [];

    // Shop cat buttons (legacy shop - stub)
    document.querySelectorAll('.shop-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shopFilter = btn.dataset.cat;
        document.querySelectorAll('.shop-cat-btn').forEach(b => b.classList.remove('active-config'));
        btn.classList.add('active-config');
        this.renderShopCatalog();
      });
    });

    // Override alert with custom notification
    window.alert = (msg) => this.showNotification(msg);
  }

  showNotification(msg, isError=true) {
    const existing = document.getElementById('ui-notification');
    if (existing) existing.remove();
    const notif = document.createElement('div');
    notif.id = 'ui-notification';
    notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
      background:rgba(8,15,28,0.95);border:1px dashed ${isError?'#ef4444':'#10b981'};
      color:${isError?'#fca5a5':'#6ee7b7'};padding:12px 24px;border-radius:4px;
      font-family:'Courier New',monospace;font-size:12px;font-weight:bold;
      box-shadow:0 0 20px ${isError?'rgba(239,68,68,0.4)':'rgba(16,185,129,0.4)'};
      z-index:999999;text-align:center;letter-spacing:1px;
      animation: notifyPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);`;
    notif.innerHTML = `<div style="font-size:16px;margin-bottom:4px;color:${isError?'#ef4444':'#10b981'};">${isError?'⚠ ERROR':'✅ SUCCESS'}</div><div>${msg}</div>
      <button style="margin-top:10px;background:transparent;border:1px dashed ${isError?'#ef4444':'#10b981'};color:${isError?'#fca5a5':'#6ee7b7'};padding:4px 12px;cursor:pointer;font-family:'Courier New';">OK</button>`;
    document.body.appendChild(notif);
    notif.querySelector('button').onclick = () => notif.remove();
    setTimeout(() => { if(notif.parentNode) notif.remove(); }, 3500);
  }

  update(p) {
    this.shipEl.textContent = ITEMS.ships[p.shipType].name;
    this.hpEl.textContent = Math.floor(p.hp);
    this.maxHpEl.textContent = p.maxHp;
    this.shieldEl.textContent = Math.floor(p.shield);
    this.maxShieldEl.textContent = p.maxShield;
    this.creditsEl.textContent = Math.floor(p.credits).toLocaleString();
    if (this.uridiumEl)  this.uridiumEl.textContent  = p.uridium || 0;
    if (this.speedEl)    this.speedEl.textContent    = Math.floor(p.currentSpeed || p.speed || 0);
    if (this.sprintEl)   this.sprintEl.textContent   = Math.floor(p.sprint || 0);
    if (this.maxSprintEl) this.maxSprintEl.textContent = p.maxSprint || 0;
    if (this.cargoEl)    this.cargoEl.textContent    = Math.floor(p.cargo);
    if (this.maxCargoEl) this.maxCargoEl.textContent = p.maxCargo;

    const pctHP     = p.maxHp     ? Math.max(0, Math.min(1, p.hp / p.maxHp))          : 0;
    const pctShield = p.maxShield ? Math.max(0, Math.min(1, p.shield / p.maxShield))   : 0;
    const pctSprint = p.maxSprint ? Math.max(0, Math.min(1, (p.sprint||0) / p.maxSprint)) : 1;
    const pctCargo  = p.maxCargo  ? Math.max(0, Math.min(1, p.cargo / p.maxCargo))     : 0;

    const barHp = document.getElementById('bar-hp');
    const barSh = document.getElementById('bar-shield');
    const barSpeed = document.getElementById('bar-speed');
    const barSp = document.getElementById('bar-sprint');
    const barCg = document.getElementById('bar-cargo');

    if (barHp) {
      barHp.style.width = (pctHP * 100).toFixed(1) + '%';
      barHp.style.background = pctHP > 0.6 ? 'linear-gradient(90deg,#16a34a,#4ade80)'
        : pctHP > 0.3 ? 'linear-gradient(90deg,#a16207,#facc15)'
        : 'linear-gradient(90deg,#991b1b,#ef4444)';
    }
    if (barSh) barSh.style.width = (pctShield * 100).toFixed(1) + '%';
    if (barSpeed) barSpeed.style.width = (Math.max(0, Math.min(1, (p.currentSpeed || p.speed) / (p.speed || 1))) * 100).toFixed(1) + '%';
    if (barSp) {
      barSp.style.width = (pctSprint * 100).toFixed(1) + '%';
      barSp.style.background = (p.sprintExhausted || pctSprint < 0.05)
        ? 'linear-gradient(90deg,#991b1b,#ef4444)'
        : pctSprint < 0.3 ? 'linear-gradient(90deg,#854d0e,#f97316)'
        : 'linear-gradient(90deg,#92400e,#facc15)';
    }
    if (barCg) barCg.style.width = (pctCargo * 100).toFixed(1) + '%';

    const hc = document.getElementById('hangar-credits');
    if (hc) hc.textContent = Math.floor(p.credits).toLocaleString();
    const sc = document.getElementById('shop-credits');
    if (sc) sc.textContent = Math.floor(p.credits).toLocaleString();

    // ── HUD Cooldown Updates ──
    const now = Date.now() / 1000;
    
    // Missile Cooldown
    const mType = (p.missileAmmo && p.missileAmmo.selected) || 'plt-2026';
    const mDef  = ITEMS.missiles ? (ITEMS.missiles[mType] || ITEMS.missiles['plt-2026']) : { cooldown: 2 };
    const mCd = mDef.cooldown || 2;
    const mTimeLeft = Math.max(0, mCd - (now - (p.lastMissileTime || 0)));
    this._updateCooldownUI('ab-missiles', mTimeLeft, mCd);

    // Mine Cooldown (2s fixed) — solo mine normali e slow
    const mineCd = 2;
    const mineTimeLeft = Math.max(0, mineCd - (now - (p.lastMineTime || 0)));
    this._updateCooldownUI('ab-mine', mineTimeLeft, mineCd);
    this._updateCooldownUI('ab-smines', mineTimeLeft, mineCd);

    // Smart Bomb Cooldown separato (5s)
    const sbCd = 5;
    const sbTimeLeft = Math.max(0, sbCd - (now - (p.lastSmartBombTime || 0)));
    this._updateCooldownUI('ab-sbomb', sbTimeLeft, sbCd);

    // EMP Cooldown
    const empCd = ITEMS.emp && ITEMS.emp['emp-01'] ? ITEMS.emp['emp-01'].cooldown : 20;
    const empTimeLeft = Math.max(0, empCd - (now - (p.lastEmpTime || 0)));
    this._updateCooldownUI('ab-emp', empTimeLeft, empCd);
  }

  _updateCooldownUI(groupId, timeLeft, totalCd) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return;
    
    const slots = groupEl.classList.contains('ab-slot') ? [groupEl] : groupEl.querySelectorAll('.ab-slot');
    
    slots.forEach(slot => {
      let overlay = slot.querySelector('.cd-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'cd-overlay';
        overlay.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.7);transition:height 0.1s linear;pointer-events:none;z-index:1;';
        slot.style.position = 'relative';
        slot.style.overflow = 'hidden';
        slot.appendChild(overlay);
        
        const text = document.createElement('div');
        text.className = 'cd-text';
        text.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#facc15;font-size:10px;font-weight:bold;z-index:2;text-shadow:1px 1px 2px #000;pointer-events:none;';
        slot.appendChild(text);
      }
      
      const textEl = slot.querySelector('.cd-text');
      
      if (timeLeft > 0) {
        const pct = (timeLeft / totalCd) * 100;
        overlay.style.height = pct + '%';
        textEl.textContent = Math.ceil(timeLeft) + 's';
        slot.style.opacity = '0.6';
        slot.style.cursor = 'not-allowed';
      } else {
        overlay.style.height = '0%';
        textEl.textContent = '';
        slot.style.opacity = '1';
        slot.style.cursor = 'pointer';
      }
    });
  }

  showPartyInvite(from, partyId) {
    const container = document.getElementById('party-invites');
    if (!container) return;
    const card = document.createElement('div');
    card.className = 'invite-card';
    card.innerHTML = `
      <div style="color:#38bdf8;margin-bottom:4px;font-weight:bold;">PARTY INVITE</div>
      <div><b>${from}</b> invited you to join their party.</div>
      <div class="invite-actions">
        <button class="invite-btn accept" onclick="if(typeof wsClient !== 'undefined') wsClient.ws.send(JSON.stringify({type:'partyAccept', partyId:${partyId}})); this.parentElement.parentElement.remove();">ACCEPT</button>
        <button class="invite-btn reject" onclick="if(typeof wsClient !== 'undefined') wsClient.ws.send(JSON.stringify({type:'partyReject', partyId:${partyId}})); this.parentElement.parentElement.remove();">DECLINE</button>
      </div>
    `;
    container.appendChild(card);
    setTimeout(() => { if(card.parentElement) card.remove(); }, 60000);
  }

  updatePartyUI(party) {
    const hud = document.getElementById('party-hud');
    const list = document.getElementById('party-members-list');
    let nameDisplay = document.getElementById('party-name-display');
    if (!hud || !list) return;

    // Fallback anti-cache: crea la struttura dinamica se manca in index.html
    if (!nameDisplay) {
        const header = hud.querySelector('.party-header');
        if (header) {
            header.innerHTML = `
                <span id="party-name-display" style="cursor:pointer;" title="Click to rename (Leader only)">PARTY <span id="party-leader-star" style="color:#facc15;font-size:10px;">★</span></span>
                <span id="btn-toggle-party" style="cursor:pointer; color:#94a3b8; font-size:16px; padding: 0 4px;" title="Expand/Collapse">−</span>
            `;
            nameDisplay = document.getElementById('party-name-display');
        } else {
            return;
        }
    }

    if (!party) {
      hud.classList.add('hidden');
      return;
    }
    hud.classList.remove('hidden');
    
    // Set party name — recupera username in modo difensivo
    const myUsername = (typeof player !== 'undefined' && player.username) ? player.username : '';
    const isMeLeader = myUsername && party.leader && myUsername.toLowerCase() === party.leader.toLowerCase();
    if (isMeLeader) {
        // Non sovrascrivere l'input se l'utente sta già scrivendo
        const existingInput = document.getElementById('party-name-input');
        const isEditing = existingInput && document.activeElement === existingInput;
        if (!isEditing) {
            nameDisplay.innerHTML = `<input type="text" id="party-name-input" value="${party.name || 'PARTY'}" style="background:transparent; border:none; border-bottom:1px dashed #0D9488; color:#10b981; font-family:'Courier New',monospace; font-size:11px; width:110px; font-weight:bold; outline:none; cursor:text;" maxlength="20" title="Click to rename"> <span style="color:#facc15;font-size:10px;">★</span>`;
            setTimeout(() => {
                const nameInput = document.getElementById('party-name-input');
                if (nameInput) {
                    // Salva automaticamente su blur (quando si clicca fuori)
                    nameInput.onblur = () => {
                        const newName = nameInput.value.trim();
                        if (newName.length > 0 && typeof wsClient !== 'undefined') {
                            wsClient.ws.send(JSON.stringify({type:'partyChangeName', newName: newName}));
                        }
                    };
                    nameInput.onkeydown = (e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') nameInput.blur();
                        if (e.key === 'Escape') { nameInput.value = party.name || 'PARTY'; nameInput.blur(); }
                    };
                }
            }, 50);
        }
    } else {
        nameDisplay.innerHTML = `${party.name || 'PARTY'} <span id="party-leader-star" style="color:#facc15;font-size:10px;">★</span>`;
    }

    // Toggle setup
    const toggleBtn = document.getElementById('btn-toggle-party');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            if (list.style.display === 'none') {
                list.style.display = 'flex';
                toggleBtn.textContent = '−';
            } else {
                list.style.display = 'none';
                toggleBtn.textContent = '+';
            }
        };
    }

    list.innerHTML = '';
    
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'ui-button';
    leaveBtn.style.cssText = 'font-size:9px; margin-bottom:8px; color:#ef4444; width:100%; flex-shrink:0;';
    leaveBtn.textContent = 'LEAVE PARTY';
    leaveBtn.onclick = () => { if(typeof wsClient !== 'undefined') wsClient.ws.send(JSON.stringify({type:'partyLeave'})); };
    list.appendChild(leaveBtn);

    party.members.forEach(m => {
      const isLeader = m.username === party.leader;
      const isMe = m.username === player.username;
      
      const div = document.createElement('div');
      div.className = 'party-member';
      
      const hpPct = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
      const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#facc15' : '#ef4444';
      
      const shPct = m.maxShield > 0 ? Math.max(0, Math.min(1, m.shield / m.maxShield)) : 0;
      const shColor = shPct > 0.5 ? '#38bdf8' : '#0369a1';
      
      let actionsHtml = '';
      if (isMeLeader && !isMe) {
        actionsHtml = `
          <div class="party-actions-wrap">
            <button class="party-btn-small promote" onclick="uiManager.showPartyConfirm('PROMOTE', '${m.username}', 'Promote <b>${m.username}</b> to Leader?', () => wsClient.ws.send(JSON.stringify({type:'partyPromote', targetUsername:'${m.username}'})))" title="Promote to Leader">⇧</button>
            <button class="party-btn-small kick" onclick="uiManager.showPartyConfirm('KICK', '${m.username}', 'Kick <b>${m.username}</b> from the party?', () => wsClient.ws.send(JSON.stringify({type:'partyKick', targetUsername:'${m.username}'})))" title="Kick">✕</button>
          </div>
        `;
      }

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span class="party-member-name" title="${m.username}">${m.username} ${isLeader ? '<span style="color:#facc15;font-size:10px;">★</span>' : ''} ${m.offline ? '<span style="color:#ef4444;font-size:9px;">[OFF]</span>' : ''}</span>
          ${actionsHtml}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; margin-bottom:1px;">
            <span>HP</span><span id="party-hp-text-${m.username}">${Math.floor(m.hp||0)} / ${m.maxHp||0}</span>
        </div>
        <div class="party-member-hp-track">
          <div id="party-hp-fill-${m.username}" class="party-member-hp-fill" style="width:${hpPct*100}%; background:${hpColor}"></div>
        </div>
        <div id="party-sh-text-container-${m.username}" style="display:${m.maxShield > 0 ? 'flex' : 'none'}; justify-content:space-between; font-size:9px; color:#94a3b8; margin-top:4px; margin-bottom:1px;">
            <span>SH</span><span id="party-sh-text-${m.username}">${Math.floor(m.shield||0)} / ${m.maxShield||0}</span>
        </div>
        <div id="party-sh-track-${m.username}" class="party-member-sh-track" style="display:${m.maxShield > 0 ? 'block' : 'none'}">
          <div id="party-sh-fill-${m.username}" class="party-member-sh-fill" style="width:${shPct*100}%; background:${shColor}"></div>
        </div>
      `;
      list.appendChild(div);
    });
  }

  showPartyConfirm(action, targetName, message, onConfirm) {
    // Remove any existing dialog
    const existing = document.getElementById('party-confirm-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'party-confirm-dialog';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.55); z-index:99999;
      display:flex; align-items:center; justify-content:center;
      backdrop-filter:blur(3px);
    `;

    const accentColor = action === 'KICK' ? '#ef4444' : '#38bdf8';
    const icon = action === 'KICK' ? '✕' : '⇧';

    overlay.innerHTML = `
      <div style="
        background:rgba(8,15,28,0.97);
        border:1px dashed ${accentColor};
        padding:24px 28px; min-width:260px; max-width:320px;
        font-family:'Courier New',monospace;
        box-shadow:0 0 30px ${accentColor}33, 0 0 60px rgba(0,0,0,0.8);
        position:relative;
      ">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;border-bottom:1px dashed ${accentColor}44;padding-bottom:12px;">
          <span style="font-size:18px;color:${accentColor};">${icon}</span>
          <span style="color:${accentColor};font-size:12px;font-weight:bold;letter-spacing:2px;">${action} PLAYER</span>
        </div>
        <div style="color:#cbd5e1;font-size:11px;margin-bottom:20px;line-height:1.6;">${message}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="pcd-cancel" style="
            background:transparent;border:1px dashed #334155;color:#94a3b8;
            padding:6px 16px;font-family:'Courier New',monospace;font-size:11px;
            cursor:pointer;letter-spacing:1px;
          ">CANCEL</button>
          <button id="pcd-confirm" style="
            background:transparent;border:1px dashed ${accentColor};color:${accentColor};
            padding:6px 16px;font-family:'Courier New',monospace;font-size:11px;
            cursor:pointer;letter-spacing:1px;font-weight:bold;
          ">CONFIRM</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('pcd-cancel').onclick = () => overlay.remove();
    document.getElementById('pcd-confirm').onclick = () => { onConfirm(); overlay.remove(); };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  updateMapInfo(name, type) {
    if (this.mapEl) this.mapEl.textContent = name;
    if (this.mapTypeEl) {
      this.mapTypeEl.textContent = '(' + type + ')';
      this.mapTypeEl.style.color = type === 'pvp' ? '#ef4444' : '#aaa';
    }
  }

  updateBaseButton(distFromBase) {
    const btn = document.getElementById('btn-base');
    const btnQuickSell = document.getElementById('btn-quick-sell');
    if (!btn) return;
    const SAFE_RADIUS = 1000;
    const inBase = distFromBase <= SAFE_RADIUS;
    btn.disabled = !inBase;
    btn.style.opacity = inBase ? '1' : '0.4';
    btn.style.cursor = inBase ? 'pointer' : 'not-allowed';
    btn.title = inBase ? 'Enter BASE' : 'Approach your base to access';
    if (inBase) {
      btn.style.borderColor = '#10b981';
      btn.style.boxShadow = 'none';
      if (btnQuickSell) btnQuickSell.style.display = 'block';
    } else {
      btn.style.borderColor = '';
      btn.style.boxShadow = 'none';
      if (btnQuickSell) btnQuickSell.style.display = 'none';
    }
  }

  switchBaseTab(tab) {
    this._currentBaseTab = tab;
    const panels = ['hangar','cargo','shop'];
    panels.forEach(p => {
      const el = document.getElementById('base-panel-' + p);
      if (el) el.classList.toggle('hidden', p !== tab);
      const btn = document.getElementById('base-tab-' + p);
      if (btn) btn.classList.toggle('active-config', p === tab);
    });
    const titles = { hangar:'⚙ HANGAR & EQUIPMENT', cargo:'📦 SHIP CARGO', shop:'🛒 GALACTIC SHOP' };
    const titleEl = document.getElementById('hangar-title');
    if (titleEl) titleEl.textContent = titles[tab] || '';
    if (tab === 'hangar') { 
        if (typeof window.playSfx === 'function') window.playSfx('audio/open_hangar.mp3', 0.8);
        this.viewingConfig = player.activeConfig || 1; this.selectConfig(this.viewingConfig); 
    }
    if (tab === 'cargo')  this.refreshCargo();
    if (tab === 'shop')   { 
        if (typeof window.playSfx === 'function') window.playSfx('audio/open_shop.mp3', 0.8);
        this.buildShop(); this.renderShopCatalog(); 
    }
  }

  refreshCargo() {
    if (!player) return;
    const cargo = player.materials || {};
    const maxCargo = player.maxCargo || 100;
    const used = player.cargo || 0;
    const pct = Math.min(100, (used / maxCargo) * 100);
    const barEl = document.getElementById('cargo-bar');
    if (barEl) barEl.style.width = pct.toFixed(1) + '%';
    const usedEl = document.getElementById('cargo-used');
    if (usedEl) usedEl.textContent = Math.floor(used);
    const maxEl = document.getElementById('cargo-max');
    if (maxEl) maxEl.textContent = maxCargo;

    let totalValue = 0;
    const LOOT_VALUES = {
      scrap_metal:5, alien_chip:12, energy_cell:35, plasma_shard:55,
      dark_crystal:180, neutrino_core:240, quantum_matrix:600, void_essence:750,
      stellar_heart:2400, annihilium:3600, drone_relic:50000,
      prometium:8, endurium:10, terbium:14
    };
    const rarityColors = { common:'#94a3b8', uncommon:'#4ade80', rare:'#38bdf8', epic:'#d946ef', legendary:'#facc15' };
    const rarityLabels = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary' };
    const LOOT_META = {
      scrap_metal:  { name:'Scrap Metal',     rarity:'common',    color:'#94a3b8' },
      alien_chip:   { name:'Alien Chip',      rarity:'common',    color:'#64748b' },
      energy_cell:  { name:'Energy Cell',     rarity:'uncommon',  color:'#f59e0b' },
      plasma_shard: { name:'Plasma Shard',    rarity:'uncommon',  color:'#fb923c' },
      dark_crystal: { name:'Dark Crystal',    rarity:'rare',      color:'#7c3aed' },
      neutrino_core:{ name:'Neutrino Core',   rarity:'rare',      color:'#0891b2' },
      quantum_matrix:{ name:'Quantum Matrix',  rarity:'epic',      color:'#d946ef' },
      void_essence: { name:'Void Essence',    rarity:'epic',      color:'#6366f1' },
      stellar_heart:{ name:'Stellar Heart',   rarity:'legendary', color:'#facc15' },
      annihilium:   { name:'Annihilium',       rarity:'legendary', color:'#f87171' },
      drone_relic:  { name:'Drone Relic',     rarity:'legendary', color:'#facc15' },
      prometium:    { name:'Prometium',        rarity:'common',    color:'#4ade80' },
      endurium:     { name:'Endurium',         rarity:'common',    color:'#60a5fa' },
      terbium:      { name:'Terbium',          rarity:'common',    color:'#f97316' },
    };

    const grid = document.getElementById('cargo-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hasItems = Object.keys(cargo).some(k => (cargo[k] || 0) > 0);
    if (!hasItems) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#475569;padding:40px;font-size:14px;">🚀 Cargo empty — destroy enemies to collect loot!</div>';
      const tv = document.getElementById('cargo-total-value');
      if (tv) tv.textContent = '0 CR';
      return;
    }

    Object.keys(cargo).forEach(itemId => {
      const qty = cargo[itemId] || 0;
      if (qty <= 0) return;
      const meta = LOOT_META[itemId] || { name: itemId, rarity:'common', color:'#fff' };
      const valPer = LOOT_VALUES[itemId] || 1;
      const itemTotal = qty * valPer;
      totalValue += itemTotal;
      const rCol = rarityColors[meta.rarity] || '#fff';
      const rLbl = rarityLabels[meta.rarity] || meta.rarity;
      const card = document.createElement('div');
      card.style.cssText = `background:rgba(15,23,42,0.9);border:1px solid ${rCol}33;border-radius:8px;
        padding:14px;display:flex;flex-direction:column;gap:8px;
        box-shadow:0 0 8px ${rCol}22;`;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:${meta.color}22;border:2px solid ${meta.color};
            border-radius:4px;display:flex;align-items:center;justify-content:center;
            font-size:16px;flex-shrink:0;">▪</div>
          <div>
            <div style="font-size:13px;color:${rCol};font-weight:bold;">${meta.name}</div>
            <div style="font-size:10px;color:${rCol}88;text-transform:uppercase;letter-spacing:1px;">${rLbl}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e293b;padding-top:8px;">
          <div>
            <div style="font-size:11px;color:#64748b;">Quantity</div>
            <div style="font-size:16px;color:#e2e8f0;font-family:'Courier New',monospace;font-weight:bold;">x${qty}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#64748b;">${valPer} CR/u</div>
            <div style="font-size:14px;color:#facc15;font-family:'Courier New',monospace;">${itemTotal} CR</div>
          </div>
        </div>`;
      grid.appendChild(card);
    });

    const tv = document.getElementById('cargo-total-value');
    if (tv) tv.textContent = totalValue.toLocaleString() + ' CR';
  }

  sellAllCargo() {
    if (!player) return;
    const cargo = player.materials || {};
    let hasItems = false;
    let total = 0;
    const LOOT_VALUES = {
      scrap_metal:5, alien_chip:12, energy_cell:35, plasma_shard:55,
      dark_crystal:180, neutrino_core:240, quantum_matrix:600, void_essence:750,
      stellar_heart:2400, annihilium:3600, drone_relic:50000,
      prometium:8, endurium:10, terbium:14
    };
    Object.keys(cargo).forEach(id => { 
        const qty = Math.floor(cargo[id] || 0);
        if(qty > 0) {
            hasItems = true;
            total += qty * (LOOT_VALUES[id] || 1);
        }
    });
    if (!hasItems) return;
    if (typeof window.playSfx === 'function') window.playSfx('audio/sell_cargo.mp3', 0.8);
    player.credits += total;
    player.materials = {
        prometium: 0, endurium: 0, terbium: 0, prometid: 0, duranium: 0, promerium: 0, seprom: 0
    };
    Object.keys(cargo).forEach(id => player.materials[id] = 0);
    player.cargo = 0;
    if (typeof wsClient !== 'undefined') wsClient.sendSyncFullState?.();
    this.refreshCargo();
    this.update(player);
    if (typeof entityManager !== 'undefined') {
      entityManager.addEntity(new DamageText(player.x, player.y - 40,
        '+' + total.toLocaleString() + ' CR SOLD!', 'loot', '#facc15'));
    }
  }

  normalizeConfig(cfg) {
    ['lasers','shields','generators','cpus','missiles','drones','droneItems','pets','petItems']
      .forEach(k => { if (!cfg[k]) cfg[k] = []; });
    if (!cfg.shipType && typeof player !== 'undefined') cfg.shipType = player.shipType || 'phoenix';
  }

  getCategoryClass(type) {
    return ({ lasers:'laser', shields:'shield', generators:'generator', cpus:'cpu',
               missiles:'missile', drones:'drone', pets:'pet' })[type] || '';
  }

  pixel(ctx, x, y, c, u = 4) { ctx.fillStyle = c; ctx.fillRect(x*u, y*u, u, u); }

  drawPattern(ctx, pattern, palette, u = 4) {
    for (let y = 0; y < pattern.length; y++)
      for (let x = 0; x < pattern[y].length; x++) {
        const key = pattern[y][x];
        if (key !== '.' && palette[key]) this.pixel(ctx, x, y, palette[key], u);
      }
  }

  drawItemIcon(canvas, itemType, itemId) {
    canvas.width = canvas.height = 36;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 36, 36);
    
    if (itemType === 'drones' || itemType === 'pets') {
      ctx.save();
      ctx.translate(18, 18);
      ctx.rotate(-Math.PI/2);
      const s = 1.2;
      ctx.scale(s, s);
      if (itemId === 'iris') {
          ctx.fillStyle = '#10B981'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8); ctx.fill();
          ctx.fillStyle = '#6EE7B7'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-5, 3); ctx.lineTo(-3, 0); ctx.lineTo(-5, -3); ctx.fill();
          ctx.fillStyle = '#065F46'; ctx.beginPath(); ctx.arc(-4, 0, 2, 0, Math.PI*2); ctx.fill();
      } else if (itemId === 'apis') {
          ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
          ctx.fillStyle = '#FBBF24'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
          ctx.fillStyle = '#92400E'; ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
      } else if (itemId === 'zeus') {
          ctx.fillStyle = '#EAB308'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.fill();
          ctx.fillStyle = '#FEF08A'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-6, 4); ctx.lineTo(-4, 0); ctx.lineTo(-6, -4); ctx.fill();
          ctx.fillStyle = '#854D0E'; ctx.beginPath(); ctx.arc(-5, 0, 3, 0, Math.PI*2); ctx.fill();
      } else if (itemId === 'flax') {
          ctx.fillStyle = '#64748B'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.fill();
          ctx.fillStyle = '#94A3B8'; ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(-4, 2); ctx.lineTo(-2, 0); ctx.lineTo(-4, -2); ctx.fill();
          ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(-3, 0, 1.5, 0, Math.PI*2); ctx.fill();
      } else if (itemType === 'pets') {
          let c1='#10B981', c2='#059669', c3='#6EE7B7', c4='#34D399';
          if(itemId==='pet-20'){ c1='#3B82F6'; c2='#1D4ED8'; c3='#93C5FD'; c4='#60A5FA'; }
          if(itemId==='pet-30'){ c1='#F97316'; c2='#C2410C'; c3='#FDBA74'; c4='#FB923C'; }
          ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.lineTo(0, -8); ctx.fill();
          ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.fill();
          ctx.fillStyle = c3; ctx.fillRect(-4, -12, 6, 4); ctx.fillRect(-4, 8, 6, 4);
          ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(2, 0, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = c4; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-12, -4); ctx.lineTo(-10, 0); ctx.lineTo(-12, 4); ctx.fill();
      }
      ctx.restore();
      return;
    }

    const definitions = {
      'ships:phoenix':   { p: ['...AA...','..AABA..','.AABBBA.','..ABBA..','..A..A..','..A..A..','........','........'], c: { A:'#475569', B:'#94A3B8' } },
      'ships:nostromo':  { p: ['...AA...','..AABA..','.AABBBA.','AABBBBAA','AABBBBAA','.AABBBA.','..ABBA..','........'], c: { A:'#1E293B', B:'#475569' } },
      'ships:vengeance': { p: ['...AA...','..AABA..','.AABBBA.','.AABBBA.','AABBBBAA','AABBBBAA','A......A','........'], c: { A:'#713F12', B:'#EAB308' } },
      'ships:goliath':   { p: ['...AA...','..AABA..','.AABBBA.','AABBBBAA','AABBBBAA','AABBBBAA','A.A..A.A','........'], c: { A:'#450A0A', B:'#991B1B' } },
      'ships:liberator': { p: ['...AA...','..AABA..','.AABBBA.','..ABBA..','..ABBA..','........','........','........'], c: { A:'#334155', B:'#64748B' } },
      'ships:bigboy':    { p: ['...AA...','..AAAA..','.AABBBA.','AABBBBAA','AABBBBAA','AABBBBAA','..A..A..','........'], c: { A:'#311302', B:'#78350F' } },
      'ships:leonov':    { p: ['...AA...','..AABA..','.AABBBA.','AABBBBAA','AABBBBAA','..ABBA..','........','........'], c: { A:'#3B0764', B:'#7E22CE' } },
      'ships:aegis':     { p: ['........','...AA...','..AABA..','.AABBBA.','AABBBBAA','AABBBBAA','.AABBBA.','........'], c: { A:'#064E3B', B:'#14532D' } },
      'ships:spearhead': { p: ['...AA...','..AABA..','..ABBA..','.AABBBA.','..ABBA..','..ABBA..','..A..A..','........'], c: { A:'#083344', B:'#164E63' } },
      'ships:citadel':   { p: ['..AAAA..','.AABBBA.','AABBBBAA','AABBBBAA','AABBBBAA','AABBBBAA','AABBBBAA','.A....A.'], c: { A:'#7C2D12', B:'#9A3412' } },
      'lasers:lf2':      { p: ['...AA...','...BA...','..ABBA..','..ABBA..','.AAAAAA.','.AABBAA.','..AAAA..','........'], c: { A:'#94a3b8', B:'#e5e7eb' } },
      'lasers:lf3':      { p: ['...AA...','...CA...','..ABBA..','..ACCA..','.AAAAAA.','.AACCAA.','..AAAA..','........'], c: { A:'#16a34a', B:'#86efac', C:'#dcfce7' } },
      'lasers:lf4':      { p: ['...AA...','..ABBA..','..ACCA..','.AABBAA.','.AACCAA.','AABBBBAA','..AAAA..','...AA...'], c: { A:'#991b1b', B:'#ef4444', C:'#ffffff' } },
      'shields:sg3n-b01':{ p: ['...AA...','..ABBA..','.ABCCBA.','.ABDDBA.','.ABCCBA.','.ABCCBA.','..ABBA..','...AA...'], c: { A:'#1e3a8a', B:'#3b82f6', C:'#93c5fd', D:'#dbeafe' } },
      'shields:sg3n-b02':{ p: ['...AA...','..ABBA..','.ABCCBA.','ABCDDCBA','ABCDDCBA','.ABCCBA.','..ABBA..','...AA...'], c: { A:'#0c4a6e', B:'#0284c7', C:'#38bdf8', D:'#e0f2fe' } },
      'shields:sg3n-b03':{ p: ['..AAAA..','..ABBA..','.ABCCBA.','ABCDDCBA','ABCDDCBA','.ABCCBA.','..ABBA..','..AAAA..'], c: { A:'#164e63', B:'#06b6d4', C:'#22d3ee', D:'#ffffff' } },
      'generators:g3n-3500': { p: ['.AAAAAA.','ABBBBBBA','ABCCDCBA','ABCDDCBA','ABCCDCBA','ABBBBBBA','.AAAAAA.','...AA...'], c: { A:'#1e3a8a', B:'#3b82f6', C:'#93c5fd', D:'#ffffff' } },
      'generators:g3n-7900': { p: ['.AAAAAA.','ABBBBBBA','ABCCDCBA','ABCDDCBA','ABCCDCBA','ABBBBBBA','.AAAAAA.','...AA...'], c: { A:'#78350f', B:'#f59e0b', C:'#fcd34d', D:'#ffffff' } },
      'generators:g3n-10x':  { p: ['.AAAAAA.','ABBBBBBA','ABCCDCBA','ABCDDCBA','ABCCDCBA','ABBBBBBA','.AAAAAA.','...AA...'], c: { A:'#7c2d12', B:'#ef4444', C:'#fca5a5', D:'#ffffff' } },
      'missiles:plt-2026':   { p: ['...AA...','..ABBA..','..ABBA..','..ACCA..','..ACCA..','..ABBA..','...DD...','...DD...'], c: { A:'#9a3412', B:'#fb923c', C:'#fdba74', D:'#fef3c7' } },
      'missiles:plt-2021':   { p: ['...AA...','..ABBA..','..ACCA..','..ADDA..','..ADDA..','..ACCA..','...EE...','...EE...'], c: { A:'#7f1d1d', B:'#dc2626', C:'#f97316', D:'#fca5a5', E:'#fff7ed' } },
      'drones:flax':  { p: ['........','...AA...','..ABA...','AAABBA..','AAABBBA.','AAABBA..','..ABA...','...AA...'], c: { A:'#475569', B:'#94a3b8' } },
      'drones:iris':  { p: ['........','...AA...','..ABBA..','AAABBBA.','AAABCBA.','AAABBBA.','..ABBA..','...AA...'], c: { A:'#065f46', B:'#10b981', C:'#6ee7b7' } },
      'drones:apis':  { p: ['........','....AA..','..AABBA.','AAABCBA.','AAABDBA.','AAABCBA.','..AABBA.','....AA..'], c: { A:'#92400e', B:'#f59e0b', C:'#fbbf24', D:'#fef3c7' } },
      'drones:zeus':  { p: ['...AA...','..ABBA..','AAABBBA.','AAABCBA.','AAABDBA.','AAABCBA.','..ABBA..','...AA...'], c: { A:'#854d0e', B:'#eab308', C:'#fde047', D:'#ffffff' } },
      'cpus:auto-rocket': { p: ['.AAAAAA.','ABBBBBBA','ABCCDCBA','ABCDDCBA','ABCCDCBA','ABBBBBBA','ABEEEEBA','.AAAAAA.'], c: { A:'#312e81', B:'#4f46e5', C:'#818cf8', D:'#e0e7ff', E:'#f97316' } },
      'cpus:auto-jump':   { p: ['.AAAAAA.','ABBBBBBA','ABCCDCBA','ABCDDCBA','ABCEECBA','ABCCCCBA','ABBBBBBA','.AAAAAA.'], c: { A:'#1d4ed8', B:'#3b82f6', C:'#93c5fd', D:'#ffffff', E:'#22d3ee' } },
      'pets:pet-10':  { p: ['........','..AAAA..','.ABCCBA.','ABCDDCBA','ABCDDCBA','.ABCCBA.','..AAAA..','...EE...'], c: { A:'#065f46', B:'#10b981', C:'#6ee7b7', D:'#ffffff', E:'#a7f3d0' } },
      'pets:pet-20':  { p: ['...AA...','..ABBA..','.ABCCBA.','ABCDDCBA','ABCDDCBA','.ABCCBA.','..ABBA..','...EE...'], c: { A:'#1e3a8a', B:'#3b82f6', C:'#93c5fd', D:'#ffffff', E:'#facc15' } },
      'pets:pet-30':  { p: ['..AAAA..','..ABBA..','.ABCCBA.','ABCDDCBA','ABCDDCBA','.ABCCBA.','..ABBA..','..EEEE..'], c: { A:'#7c2d12', B:'#f97316', C:'#fed7aa', D:'#ffffff', E:'#fbbf24' } }
    };
    const def = definitions[itemType + ':' + itemId];
    if (def) { this.drawPattern(ctx, def.p, def.c, 4); }
    else {
      const colors = { ships:'#5eead4', lasers:'#ef4444', shields:'#3b82f6', generators:'#f59e0b', cpus:'#818cf8', missiles:'#fb923c', drones:'#10b981', pets:'#86efac' };
      ctx.fillStyle = colors[itemType] || '#334155'; ctx.fillRect(2,2,32,32);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(5,5,26,26);
    }
  }

  createSlotVisual(itemType, itemId, label) {
    const wrap = document.createElement('div');
    wrap.className = 'slot-item-visual';
    const itemDef = ITEMS[itemType] ? ITEMS[itemType][itemId] : null;
    const descText = itemDef?.desc || '';
    wrap.title = label ? (descText ? label + '\n' + descText : label) : (itemId || '');
    const icon = document.createElement('canvas');
    icon.className = 'slot-icon';
    this.drawItemIcon(icon, itemType, itemId);
    wrap.appendChild(icon);
    if (label) {
      const lbl = document.createElement('span');
      lbl.className = 'slot-name-label';
      lbl.textContent = label;
      wrap.appendChild(lbl);
    }
    if (descText) {
      wrap.addEventListener('mouseenter', (e) => this._showTooltip(e, label, descText));
      wrap.addEventListener('mouseleave', () => this._hideTooltip());
      wrap.addEventListener('mousemove', (e) => this._moveTooltip(e));
    }
    return wrap;
  }

  _showTooltip(e, name, desc) {
    let tip = document.getElementById('hangar-tooltip');
    if (!tip) {
      tip = document.createElement('div'); tip.id = 'hangar-tooltip';
      tip.style.cssText = `position:fixed;z-index:9998;pointer-events:none;background:rgba(8,15,28,0.97);
        border:1px solid #0D9488;border-radius:6px;padding:8px 12px;max-width:220px;
        font-family:'Courier New',monospace;font-size:11px;color:#cbd5e1;
        box-shadow:0 4px 16px rgba(0,0,0,0.6);line-height:1.5;`;
      document.body.appendChild(tip);
    }
    tip.innerHTML = `<div style="color:#5eead4;font-weight:bold;margin-bottom:4px;">${name||''}</div>${desc}`;
    tip.style.display = 'block'; this._moveTooltip(e);
  }
  _moveTooltip(e) {
    const tip = document.getElementById('hangar-tooltip'); if (!tip) return;
    let x = e.clientX+14, y = e.clientY+14;
    if (x+240 > window.innerWidth) x = e.clientX-240;
    if (y+tip.offsetHeight+10 > window.innerHeight) y = e.clientY-tip.offsetHeight-10;
    tip.style.left = x+'px'; tip.style.top = y+'px';
  }
  _hideTooltip() { const t = document.getElementById('hangar-tooltip'); if (t) t.style.display='none'; }

  syncLoadout() {
    if (typeof wsClient !== 'undefined') {
      wsClient.sendUpdateStats?.(player.hp, player.maxHp, player.shipType, player.equipped.drones);
      wsClient.sendSyncFullState?.();
    }
  }

  selectConfig(cfg) {
    this.viewingConfig = cfg;
    if (typeof player !== 'undefined') {
        player.activeConfig = cfg;
        player.recalculateStats();
        player.hp = player.maxHp;
        this.syncLoadout();
    }
    document.getElementById('btn-config-1').classList.toggle('active-config', cfg === 1);
    document.getElementById('btn-config-2').classList.toggle('active-config', cfg === 2);
    this.refreshHangar();
  }

  startDrag(type, itemId, sourceSlot, sourceIdx, event) {
    this._didDrag = false;
    this._dragStartX = event.clientX; this._dragStartY = event.clientY;
    this._dragStartTime = Date.now();
    this.dragState = { type, itemId, sourceSlot, sourceIdx };
    const ghost = document.createElement('div');
    ghost.id = 'drag-ghost';
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.85;
      background:rgba(13,148,136,0.25);border:2px solid #0D9488;border-radius:6px;
      width:70px;height:70px;display:flex;align-items:center;justify-content:center;`;
    const icon = document.createElement('canvas');
    this.drawItemIcon(icon, type, itemId);
    ghost.appendChild(icon);
    document.body.appendChild(ghost);
    this._moveGhost(event);
    document.addEventListener('mousemove', this._onDragMove = (e) => {
      if (Math.hypot(e.clientX - this._dragStartX, e.clientY - this._dragStartY) > 5) this._didDrag = true;
      this._moveGhost(e);
    });
    document.addEventListener('mouseup', this._onDragEnd = (e) => this._endDrag(e), { once: true });
  }

  _wasDrag() { return this._didDrag || (Date.now() - this._dragStartTime > 300); }

  _moveGhost(e) {
    const g = document.getElementById('drag-ghost');
    if (g) { g.style.left = (e.clientX-35)+'px'; g.style.top = (e.clientY-35)+'px'; }
  }

  _endDrag() {
    document.removeEventListener('mousemove', this._onDragMove);
    document.getElementById('drag-ghost')?.remove();
    this.dragState = null;
  }

  _dropOnSlot(targetType, targetIdx, droneIdx) {
    if (!this.dragState) return;
    const { type, itemId, sourceSlot, sourceIdx } = this.dragState;
    const cfg = player.configs[this.viewingConfig];
    this.normalizeConfig(cfg);
    if (sourceSlot === 'ship')      cfg[type].splice(sourceIdx, 1);
    else if (sourceSlot === 'droneItem') cfg.droneItems[sourceIdx[0]].splice(sourceIdx[1], 1);
    else if (sourceSlot === 'petItem')   cfg.petItems.splice(sourceIdx, 1);
    if (targetType === 'ship')      cfg[type][targetIdx] = itemId;
    else if (targetType === 'drone') { if (!cfg.droneItems[droneIdx]) cfg.droneItems[droneIdx]=[]; cfg.droneItems[droneIdx][targetIdx] = itemId; }
    else if (targetType === 'pet')  { if (!cfg.petItems) cfg.petItems=[]; cfg.petItems[targetIdx] = itemId; }
    this.dragState = null;
    player.recalculateStats(); this.refreshHangar(); this.syncLoadout();
  }

  refreshHangar() {
    if (!player) return;
    const p = player;
    const cfg = p.configs[this.viewingConfig];
    this.normalizeConfig(cfg);
    const shipDef = ITEMS.ships[p.shipType];

    const shipVisual = document.getElementById('ship-visual');
    shipVisual.innerHTML = '<canvas id="hangar-ship-canvas" width="140" height="140"></canvas>';
    const hCtx = document.getElementById('hangar-ship-canvas').getContext('2d');
    hCtx.translate(70,70); hCtx.rotate(-Math.PI/2);
    const s = 6;
    const drawPix = (x, y, w, h, c) => { hCtx.fillStyle = c; hCtx.fillRect(x*s, y*s, w*s, h*s); };
    const drawSymH = (x, y, w, h, c) => { drawPix(x, y, w, h, c); if (y !== 0) drawPix(x, -y - h, w, h, c); };
    const neon = '#5EEAD4';
    
    switch (p.shipType) {
        case 'phoenix': drawPix(-3,-1.5,6,3,'#94A3B8'); drawSymH(-4,1.5,3,1,'#475569'); drawPix(1,-0.5,3,1,neon); drawSymH(-2,2.5,1,1,'#F59E0B'); break;
        case 'liberator': drawPix(-2,-1,5,2,'#94A3B8'); drawSymH(-4,1,3,1,'#475569'); drawSymH(-1,2,2,1,'#334155'); drawPix(3,-0.5,3,1,neon); break;
        case 'nostromo': drawPix(-4,-2,8,4,'#475569'); drawSymH(-2,2,6,1.5,'#334155'); drawSymH(2,3.5,4,1,'#1E293B'); drawPix(-1,-1,4,2,neon); break;
        case 'bigboy': drawPix(-5,-3.5,10,7,'#78350F'); drawSymH(-3,3.5,8,2,'#451A03'); drawSymH(0,5.5,3,1.5,'#D97706'); drawPix(2,-2,4,4,neon); break;
        case 'leonov': drawPix(-3,-1.5,7,3,'#7E22CE'); drawSymH(-2,1.5,3,1,'#581C87'); drawSymH(1,2.5,3,1.5,'#3B0764'); drawPix(2,-1,3,2,neon); break;
        case 'vengeance': drawPix(-4,-1.5,8,3,'#EAB308'); drawSymH(-5,1.5,4,2,'#A16207'); drawSymH(-2,3.5,3,1.5,'#713F12'); drawPix(4,-0.5,2,1,neon); break;
        case 'goliath': drawPix(-5,-3,10,6,'#991B1B'); drawSymH(-4,3,8,2,'#7F1D1D'); drawSymH(-2,5,6,1.5,'#450A0A'); drawSymH(2,6.5,2,1,'#F87171'); drawPix(1,-1.5,4,3,neon); break;
        case 'spearhead': drawPix(-2,-1,10,2,'#0891B2'); drawSymH(-4,1,4,1,'#164E63'); drawSymH(-1,2,2,0.5,'#083344'); drawPix(5,-0.5,4,1,neon); break;
        case 'citadel': drawPix(-6,-5,12,10,'#C2410C'); drawSymH(-4,5,10,3,'#7C2D12'); drawSymH(-2,8,8,2,'#431407'); drawPix(4,-2,3,4,neon); break;
        default: drawPix(-2,-2,4,4,'#FFFFFF'); break;
    }

    document.getElementById('hangar-ship-stats')?.remove();
    const statsBox = document.createElement('div');
    statsBox.id = 'hangar-ship-stats';
    statsBox.style.cssText = `
      padding:8px;background:rgba(8,15,28,0.9);
      border:1px solid #1e3a5f;border-radius:6px;
      font-family:'Courier New',monospace;font-size:10px;color:#94a3b8;
      width:100%;box-sizing:border-box;`;

    const totalLasers  = (cfg.lasers||[]).length + (cfg.droneItems||[]).reduce((a,d)=>(d||[]).filter(i=>ITEMS.lasers?.[i]).length+a,0) + (cfg.petItems||[]).filter(i=>ITEMS.lasers?.[i]).length;
    const totalShields = (cfg.shields||[]).length + (cfg.droneItems||[]).reduce((a,d)=>(d||[]).filter(i=>ITEMS.shields?.[i]).length+a,0) + (cfg.petItems||[]).filter(i=>ITEMS.shields?.[i]).length;

    // Calcolo DPS base
    let baseLaserDmg = 0;
    (cfg.lasers||[]).forEach(l => { if (l && ITEMS.lasers?.[l]) baseLaserDmg += ITEMS.lasers[l].damage; });
    (cfg.droneItems||[]).forEach(d => d.forEach(l => { if (l && ITEMS.lasers?.[l]) baseLaserDmg += ITEMS.lasers[l].damage; }));
    (cfg.petItems||[]).forEach(l => { if (l && ITEMS.lasers?.[l]) baseLaserDmg += ITEMS.lasers[l].damage; });
    if(cfg.pets && cfg.pets[0] && ITEMS.pets?.[cfg.pets[0]]) baseLaserDmg += ITEMS.pets[cfg.pets[0]].damage || 0;
    
    // Moltiplicatori
    let dmgMult = 1.0;
    let shdMult = 1.0;
    (cfg.drones||[]).forEach(d => {
        if(d && ITEMS.drones?.[d]) {
            if(ITEMS.drones[d].damageBonus) dmgMult += ITEMS.drones[d].damageBonus;
            if(ITEMS.drones[d].shieldBonus) shdMult += ITEMS.drones[d].shieldBonus;
        }
    });

    const finalDps = Math.floor(baseLaserDmg * dmgMult);
    const finalMaxShield = Math.floor(p.maxShield); // P.maxShield è già stato ricalcolato in Player.js


    const row = (label, val, col='#5eead4') =>
      `<div style="display:flex;justify-content:space-between;align-items:center;
         padding:3px 0;border-bottom:1px solid #0f1e30;">
         <span style="color:#94a3b8;">${label}</span>
         <span style="color:${col};font-weight:bold;">${val}</span>
       </div>`;

    const hpCol = p.hp/p.maxHp > 0.6 ? '#4ade80' : p.hp/p.maxHp > 0.3 ? '#facc15' : '#ef4444';

    statsBox.innerHTML = `
      <div style="font-size:10px;color:#0d9488;text-transform:uppercase;letter-spacing:1px;
        margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #1e3a5f;font-weight:bold;">STATS</div>
      ${row('HP', `${Math.floor(p.hp)} / ${p.maxHp}`, hpCol)}
      ${row('SHIELD', `${Math.floor(p.shield)} / ${p.maxShield}`, '#38bdf8')}
      ${row('SPEED', p.speed || shipDef.speed || '—', '#e2e8f0')}
      ${row('LASERS EQ.', totalLasers, '#ef4444')}
      ${row('DPS', finalDps+'/s', '#fb923c')}
      ${row('SHIELDS EQ.', totalShields, '#3b82f6')}
      ${row('DRONES', (cfg.drones||[]).length+' / 8', '#10b981')}
      ${row('CARGO', `${Math.floor(p.cargo)} / ${p.maxCargo}`, '#f59e0b')}
      ${row('SPRINT', p.maxSprint || shipDef.sprintBase || '—', '#22d3ee')}`;

    let shipLeftCol = document.getElementById('hangar-ship-left-col');
    if (!shipLeftCol) {
      shipLeftCol = document.createElement('div');
      shipLeftCol.id = 'hangar-ship-left-col';
      shipLeftCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;width:160px;';
      const sda = document.querySelector('.ship-display-area');
      if (sda) sda.insertBefore(shipLeftCol, sda.firstChild);
    }
    if (shipLeftCol && !shipLeftCol.contains(shipVisual)) {
      shipLeftCol.appendChild(shipVisual);
    }
    statsBox.id = 'hangar-ship-stats';
    shipLeftCol.appendChild(statsBox);

    // ── OWNED FLEET ─────────────────────────────────────────────────────
    if (!p.inventory.ships) p.inventory.ships = [p.shipType];
    if (!p.inventory.ships.includes(p.shipType)) p.inventory.ships.unshift(p.shipType);

    document.getElementById('hangar-fleet')?.remove();
    const fleetContainer = document.createElement('div');
    fleetContainer.id = 'hangar-fleet';
    fleetContainer.style.cssText = `
      background:rgba(8,15,28,0.7);border:1px solid #1e293b;border-radius:8px;
      padding:10px 14px;flex-shrink:0;`;
    fleetContainer.innerHTML = `
      <div style="font-size:9px;color:#0d9488;text-transform:uppercase;letter-spacing:1px;
        margin-bottom:8px;">✦ OWNED FLEET</div>
      <div id="hangar-fleet-row" style="display:flex;flex-wrap:nowrap;gap:8px;align-items:center;overflow-x:auto;"></div>`;

    p.inventory.ships.forEach(shipId => {
      const sDef = ITEMS.ships[shipId]; if (!sDef) return;
      const isActive = shipId === p.shipType;
      const btn = document.createElement('div');
      btn.className = 'item-slot' + (isActive ? ' occupied ship-active' : '');
      btn.style.cssText = `width:56px;height:66px;cursor:${isActive?'default':'pointer'};position:relative;flex-shrink:0;`
        + (isActive ? 'border-color:#5eead4;box-shadow:0 0 8px rgba(94,234,212,0.5);' : '');
      btn.title = sDef.name + (isActive ? ' ✓ ACTIVE' : ' — Click to select');
      const ic = document.createElement('canvas');
      this.drawItemIcon(ic, 'ships', shipId); btn.appendChild(ic);
      const lbl = document.createElement('span');
      lbl.className = 'slot-name-label'; lbl.textContent = sDef.name; btn.appendChild(lbl);
      if (isActive) {
        const dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:50%;background:#5eead4;box-shadow:0 0 4px #5eead4;';
        btn.appendChild(dot);
      } else {
        btn.addEventListener('click', () => {
          const cfg = p.configs[this.viewingConfig];
          cfg.shipType = shipId;
          cfg.lasers = [];
          cfg.shields = [];
          cfg.generators = [];
          p.recalculateStats();
          p.hp = p.maxHp;
          this.refreshHangar();
          this.syncLoadout();
        });
      }
      fleetContainer.querySelector('#hangar-fleet-row').appendChild(btn);
    });

    const leftColF = document.getElementById('hangar-ship-left-col');
    if (leftColF) leftColF.appendChild(fleetContainer);
    else {
      const sda = document.querySelector('.ship-display-area');
      if (sda?.parentNode) sda.parentNode.insertBefore(fleetContainer, sda.nextSibling);
    }

    const shipShieldSlots    = shipDef.shieldSlots    ?? shipDef.generatorSlots ?? 0;
    const shipGeneratorSlots = shipDef.generatorSlots ?? 0;

    const renderSlots = (containerId, listType, maxSlots, equippedArr, targetType, droneIdx) => {
      const container = document.getElementById(containerId); if (!container) return;
      container.innerHTML = '';
      for (let i = 0; i < maxSlots; i++) {
        const div = document.createElement('div');
        div.className = 'item-slot ' + this.getCategoryClass(listType);
        if (equippedArr[i]) {
          const itemId = equippedArr[i];
          const itemDef = ITEMS[listType]?.[itemId];
          if (itemDef) div.appendChild(this.createSlotVisual(listType, itemId, itemDef.name));
          div.classList.add('occupied');
          div.title = (itemDef?.name || itemId) + ' — Click to remove, drag to move';
          div.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startDrag(listType, itemId, 'ship', i, e); });
          div.addEventListener('mouseup', () => { if (!this._wasDrag()) this.unequipItem(listType, i, 'ship'); });
        } else {
          div.innerHTML = '<span class="empty-slot-label">EMPTY</span>';
        }
        div.addEventListener('mouseup', () => {
          if (this.dragState && this.dragState.type === listType && this._wasDrag())
            this._dropOnSlot(targetType, i, droneIdx);
        });
        container.appendChild(div);
      }
    };

    renderSlots('grid-ship-lasers',     'lasers',     shipDef.laserSlots,    cfg.lasers,     'ship');
    renderSlots('grid-ship-shields',    'shields',    shipShieldSlots,        cfg.shields,    'ship');
    renderSlots('grid-ship-generators', 'generators', shipGeneratorSlots,     cfg.generators, 'ship');
    renderSlots('grid-ship-cpus',       'cpus',       2,                      cfg.cpus,       'ship');
    renderSlots('grid-ship-missiles',   'missiles',   1,                      cfg.missiles,   'ship');

    const petContainer = document.getElementById('grid-ship-pets');
    if (petContainer) {
      petContainer.innerHTML = '';
      const hasPet = cfg.pets?.length > 0;
      const petMainSlot = document.createElement('div');
      petMainSlot.className = 'item-slot pet';
      if (hasPet) {
        const petDef = ITEMS.pets[cfg.pets[0]];
        petMainSlot.appendChild(this.createSlotVisual('pets', cfg.pets[0], petDef?.name || cfg.pets[0]));
        petMainSlot.classList.add('occupied');
        petMainSlot.title = (petDef?.name || cfg.pets[0]) + ' — Click to remove, drag to move';
        petMainSlot.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startDrag('pets', cfg.pets[0], 'ship', 0, e); });
        petMainSlot.addEventListener('mouseup', () => { if (!this._wasDrag()) this.unequipItem('pets',0,'ship'); });
      } else { petMainSlot.innerHTML = '<span class="empty-slot-label">P.E.T.</span>'; }
      petMainSlot.addEventListener('mouseup', () => { if (this.dragState && this.dragState.type === 'pets' && this._wasDrag()) this._dropOnSlot('ship', 0); });
      petContainer.appendChild(petMainSlot);
      petContainer.nextElementSibling?.classList.contains('pet-weapon-slots') && petContainer.nextElementSibling.remove();
      if (hasPet) {
        if (!cfg.petItems) cfg.petItems = [];
        const petSlotWrap = document.createElement('div');
        petSlotWrap.className = 'pet-weapon-slots';
        petSlotWrap.innerHTML = '<span class="pet-slots-label">PET Weapon</span>';
        const petSlotsCount = ITEMS.pets[cfg.pets[0]]?.slots || 1;
        for (let pi=0; pi<petSlotsCount; pi++) {
          const pSlot = document.createElement('div');
          const petItemId = cfg.petItems[pi];
          const isPetLaser = petItemId && ITEMS.lasers?.[petItemId];
          const isPetShield = petItemId && ITEMS.shields?.[petItemId];
          const petItemType = isPetLaser ? 'lasers' : isPetShield ? 'shields' : null;
          pSlot.className = 'item-slot ' + (petItemType ? this.getCategoryClass(petItemType) : 'pet');
          if (petItemId && petItemType) {
            pSlot.appendChild(this.createSlotVisual(petItemType, petItemId, ITEMS[petItemType][petItemId]?.name || petItemId));
            pSlot.classList.add('occupied');
            pSlot.title = (ITEMS[petItemType][petItemId]?.name || petItemId) + ' — Click to remove';
            pSlot.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startDrag(petItemType, petItemId, 'petItem', pi, e); });
            pSlot.addEventListener('mouseup', () => { if (!this._wasDrag()) { cfg.petItems.splice(pi,1); player.recalculateStats(); this.refreshHangar(); this.syncLoadout(); } });
          } else { pSlot.innerHTML = `<span class="empty-slot-label">L/S ${pi+1}</span>`; }
          pSlot.addEventListener('mouseup', () => { if (this.dragState && ['lasers','shields'].includes(this.dragState.type) && this._wasDrag()) this._dropOnSlot('pet',pi); });
          petSlotWrap.appendChild(pSlot);
        }
        petContainer.after(petSlotWrap);
      }
    }

    const dronesContainer = document.getElementById('drones-container');
    dronesContainer.innerHTML = '';
    cfg.drones.forEach((droneId, dIdx) => {
      if (!droneId) return;
      const droneDef = ITEMS.drones[droneId];
      const div = document.createElement('div'); div.className = 'drone-card';
      const topDiv = document.createElement('div'); topDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
      const tw = document.createElement('div'); tw.style.cssText = 'display:flex;align-items:center;gap:8px;';
      tw.appendChild(this.createSlotVisual('drones', droneId, droneDef.name));
      const tt = document.createElement('strong'); tt.textContent = droneDef.name; tw.appendChild(tt); topDiv.appendChild(tw);
      const remBtn = document.createElement('span'); remBtn.textContent='✕'; remBtn.style.cssText='cursor:pointer;color:#ef4444;font-size:16px;'; remBtn.onclick=()=>this.unequipItem('drones',dIdx); topDiv.appendChild(remBtn);
      div.appendChild(topDiv);
      const slotsDiv = document.createElement('div'); slotsDiv.className = 'drone-slots';
      if (!cfg.droneItems[dIdx]) cfg.droneItems[dIdx] = [];
      for (let i=0; i<droneDef.slots; i++) {
        const sdiv = document.createElement('div');
        const itemId = cfg.droneItems[dIdx][i];
        const isLaser = itemId && ITEMS.lasers?.[itemId]; const isShield = itemId && ITEMS.shields?.[itemId];
        const listType = isLaser ? 'lasers' : isShield ? 'shields' : null;
        sdiv.className = 'item-slot ' + (listType ? this.getCategoryClass(listType) : '');
        if (itemId && listType) {
          sdiv.appendChild(this.createSlotVisual(listType, itemId, ITEMS[listType][itemId]?.name || itemId));
          sdiv.classList.add('occupied');
          sdiv.title = (ITEMS[listType][itemId]?.name || itemId) + ' — Click to remove';
          sdiv.addEventListener('mousedown', (e) => { e.stopPropagation(); this.startDrag(listType, itemId, 'droneItem', [dIdx,i], e); });
          sdiv.addEventListener('mouseup', () => { if (!this._wasDrag()) this.unequipItem('droneItems', i, dIdx); });
        } else { sdiv.innerHTML = '<span class="empty-slot-label">EMPTY</span>'; }
        sdiv.addEventListener('mouseup', () => { if (this.dragState && ['lasers','shields'].includes(this.dragState.type) && this._wasDrag()) this._dropOnSlot('drone', i, dIdx); });
        slotsDiv.appendChild(sdiv);
      }
      div.appendChild(slotsDiv); dronesContainer.appendChild(div);
    });

    const invContainer = document.getElementById('inventory-list'); invContainer.innerHTML = '';
    const countEquipped = (type, itemId) => {
      let c=0;
      if (type==='lasers'||type==='shields') {
        (cfg[type]||[]).forEach(id=>{if(id===itemId)c++;});
        (cfg.droneItems||[]).forEach(arr=>(arr||[]).forEach(id=>{if(id===itemId)c++;}));
        (cfg.petItems||[]).forEach(id=>{if(id===itemId)c++;});
      } else { (cfg[type]||[]).forEach(id=>{if(id===itemId)c++;}); }
      return c;
    };
    const renderInvType = (type) => {
      const itemMap = ITEMS[type]; if (!itemMap || !p.inventory[type]?.length) return;
      const counts = {}; p.inventory[type].forEach(id=>counts[id]=(counts[id]||0)+1);
      Object.keys(counts).forEach(itemId => {
        const avail = counts[itemId] - countEquipped(type, itemId);
        for (let i=0; i<avail; i++) {
          const div = document.createElement('div');
          div.className = 'item-slot ' + this.getCategoryClass(type);
          const itemDef = itemMap[itemId];
          div.appendChild(this.createSlotVisual(type, itemId, itemDef.name));
          div.title = itemDef.name + ' — Click to equip';
          div.addEventListener('mouseup', () => { if (!this._wasDrag()) this.equipItem(type, itemId); });
          div.addEventListener('mousedown', (e) => { e.preventDefault(); this.startDrag(type, itemId, 'inventory', null, e); });
          invContainer.appendChild(div);
        }
      });
    };
    ['lasers','shields','generators','cpus','missiles','drones','pets'].forEach(t => renderInvType(t));
  }

  equipItem(type, itemId) {
    const cfg = player.configs[this.viewingConfig]; this.normalizeConfig(cfg);
    const shipDef = ITEMS.ships[player.shipType];
    const shipShieldSlots = shipDef.shieldSlots ?? shipDef.generatorSlots ?? 0;
    if (type==='lasers') {
      if (cfg.lasers.length < shipDef.laserSlots) { cfg.lasers.push(itemId); }
      else {
        let done=false;
        for (let d=0;d<cfg.drones.length;d++) {
          if (!cfg.drones[d]) continue; if (!cfg.droneItems[d]) cfg.droneItems[d]=[];
          if (cfg.droneItems[d].length < ITEMS.drones[cfg.drones[d]].slots) { cfg.droneItems[d].push(itemId); done=true; break; }
        }
        if (!done && cfg.pets.length>0) { if (!cfg.petItems) cfg.petItems=[]; const pSlots=ITEMS.pets[cfg.pets[0]]?.slots||1; if (cfg.petItems.length<pSlots) { cfg.petItems.push(itemId); done=true; } }
        if (!done) alert('No free laser slots!');
      }
    } else if (type==='shields') {
      if (cfg.shields.length < shipShieldSlots) { cfg.shields.push(itemId); }
      else {
        let done=false;
        for (let d=0;d<cfg.drones.length;d++) {
          if (!cfg.drones[d]) continue; if (!cfg.droneItems[d]) cfg.droneItems[d]=[];
          if (cfg.droneItems[d].length < ITEMS.drones[cfg.drones[d]].slots) { cfg.droneItems[d].push(itemId); done=true; break; }
        }
        if (!done && cfg.pets.length>0) { if (!cfg.petItems) cfg.petItems=[]; const pSlots=ITEMS.pets[cfg.pets[0]]?.slots||1; if (cfg.petItems.length<pSlots) { cfg.petItems.push(itemId); done=true; } }
        if (!done) alert('No free shield slots!');
      }
    } else if (type==='generators') {
      if (cfg.generators.length < (shipDef.generatorSlots||0)) cfg.generators.push(itemId);
      else alert('No free generator slots!');
    } else if (type==='cpus') {
      if (cfg.cpus.length<2) cfg.cpus.push(itemId); else alert('Max 2 CPUs!');
    } else if (type==='missiles') {
      cfg.missiles.length<1 ? cfg.missiles.push(itemId) : cfg.missiles[0]=itemId;
      if (player.inventory?.missiles) player.inventory.missiles[0]=itemId;
    } else if (type==='drones') {
      if (cfg.drones.length<8) { cfg.drones.push(itemId); cfg.droneItems.push([]); } else alert('Max 8 drones!');
    } else if (type==='pets') {
      if (cfg.pets.length<1) { cfg.pets.push(itemId); if (!cfg.petItems) cfg.petItems=[]; } else alert('Max 1 P.E.T.!');
    }
    player.recalculateStats(); this.refreshHangar(); this.syncLoadout();
  }

  unequipItem(listType, index, targetIdx) {
    const cfg = player.configs[this.viewingConfig]; this.normalizeConfig(cfg);
    if (['lasers','shields','generators','cpus','missiles'].includes(listType)) cfg[listType].splice(index,1);
    else if (listType==='droneItems') { if (cfg.droneItems[targetIdx]) cfg.droneItems[targetIdx].splice(index,1); }
    else if (listType==='drones')  { cfg.drones.splice(index,1); cfg.droneItems.splice(index,1); }
    else if (listType==='pets')    { cfg.pets.splice(index,1); cfg.petItems=[]; }
    else if (listType==='petItems') { if (cfg.petItems) cfg.petItems.splice(index,1); }
    player.recalculateStats(); this.refreshHangar(); this.syncLoadout();
  }

  buildShop() {
    this.shopCatalog = [];
    const add = (type, map) => Object.keys(map).forEach(id => this.shopCatalog.push({ type, id, def: map[id] }));
    add('ships', ITEMS.ships); add('lasers', ITEMS.lasers); add('shields', ITEMS.shields);
    add('generators', ITEMS.generators); add('cpus', ITEMS.cpus); add('missiles', ITEMS.missiles);
    add('drones', ITEMS.drones); add('pets', ITEMS.pets);
    add('laserAmmo', ITEMS.laserAmmo); add('mines', ITEMS.mines); add('emp', ITEMS.emp);
  }

  _buildStatsList(d) {
    const s = [];
    if (d.hp)           s.push({ icon:'❤', label:'HP', val:d.hp });
    if (d.speed)        s.push({ icon:'⚡', label:'Speed', val:d.speed });
    if (d.sprintBase)   s.push({ icon:'💨', label:'Base Sprint', val:d.sprintBase });
    if (d.sprintBonus)  s.push({ icon:'💨', label:'Sprint Bonus', val:'+'+d.sprintBonus });
    if (d.damage)       s.push({ icon:'🔥', label:'Damage', val:d.damage });
    if (d.shield)       s.push({ icon:'🛡', label:'Shield', val:d.shield });
    if (d.cooldown)     s.push({ icon:'⏱', label:'Cooldown', val:d.cooldown+'s' });
    if (d.slots)        s.push({ icon:'🔩', label:'Slots', val:d.slots });
    if (d.laserSlots)      s.push({ icon:'🔫', label:'Laser Slots',      val:d.laserSlots });
    if (d.shieldSlots)     s.push({ icon:'🛡', label:'Shield Slots',      val:d.shieldSlots });
    if (d.generatorSlots)  s.push({ icon:'⚙', label:'Generator Slots', val:d.generatorSlots });
    if (d.cargo)           s.push({ icon:'📦', label:'Cargo',           val:d.cargo });
    if (d.multiplier)   s.push({ icon:'✖', label:'Mult.', val:'x'+d.multiplier });
    if (d.stackMax)     s.push({ icon:'📚', label:'Stack', val:d.stackMax.toLocaleString() });
    if (d.stealPct)     s.push({ icon:'💠', label:'Shield Siphon', val:Math.round(d.stealPct*100)+'%' });
    if (d.aoeRadius)    s.push({ icon:'💥', label:'Area', val:d.aoeRadius });
    if (d.slowPct)      s.push({ icon:'🐢', label:'Slow', val:Math.round(d.slowPct*100)+'%' });
    if (d.range)        s.push({ icon:'📡', label:'Range', val:d.range });
    if (d.costCredits)  s.push({ icon:'💶', label:'CR/u', val:d.costCredits });
    return s;
  }

  buyShopItem(entry, qty=100) {
    const d = entry.def;
    if (['laserAmmo','mines','emp'].includes(entry.type)) {
      const tc = (d.costCredits||0) * qty;
      if (player.credits < tc) { alert(`Requires ${tc} CR.`); return; }
      player.credits -= tc;
      if (entry.type==='laserAmmo') { if (!player.ammo) player.ammo={laserAmmo:'x1',counts:{}}; player.ammo.counts[entry.id]=(player.ammo.counts[entry.id]||0)+qty; }
      else if (entry.type==='mines') { if (!player.mineAmmo) player.mineAmmo={selected:entry.id,counts:{}}; player.mineAmmo.counts[entry.id]=(player.mineAmmo.counts[entry.id]||0)+qty; }
      else { if (!player.empAmmo) player.empAmmo={counts:{}}; player.empAmmo.counts[entry.id]=(player.empAmmo.counts[entry.id]||0)+qty; }
      if (typeof window.playSfx === 'function') window.playSfx('audio/aquisto_itemshop.mp3', 0.8);
      player.recalculateStats(); this.refreshShop(); this.syncLoadout(); return;
    }
    if (entry.type==='missiles') {
      const tc = (d.costCredits||0) * qty;
      if (player.credits<tc) { alert('Insufficient CR!'); return; }
      player.credits-=tc;
      if (!player.missileAmmo) player.missileAmmo={selected:entry.id,counts:{}};
      player.missileAmmo.counts[entry.id]=(player.missileAmmo.counts[entry.id]||0)+qty;
      if (typeof window.playSfx === 'function') window.playSfx('audio/aquisto_itemshop.mp3', 0.8);
      player.recalculateStats(); this.refreshShop(); this.syncLoadout(); return;
    }
    const cost=d.cost||0;
    if (player.credits<cost) { alert('Insufficient credits!'); return; }
    player.credits-=cost;
    if (entry.type==='ships') {
      if (!player.inventory.ships) player.inventory.ships=[player.shipType];
      if (!player.inventory.ships.includes(entry.id)) player.inventory.ships.push(entry.id);
      const cfg = player.configs[this.viewingConfig];
      if (cfg) cfg.shipType = entry.id;
      player.recalculateStats();
      player.hp = player.maxHp;
    } else {
      if (!player.inventory[entry.type]) player.inventory[entry.type]=[];
      player.inventory[entry.type].push(entry.id);
    }
    if (typeof window.playSfx === 'function') window.playSfx('audio/aquisto_itemshop.mp3', 0.8);
    player.recalculateStats(); this.refreshHangar(); this.refreshShop(); this.syncLoadout();
  }

  renderShopCatalog() {
    const container = document.getElementById('shop-items-list'); if (!container) return;
    container.innerHTML='';
    const filtered = this.shopCatalog.filter(e => !this.shopFilter||this.shopFilter==='all'?true:e.type===this.shopFilter);
    if (!filtered.length) { container.innerHTML='<div style="color:#475569;padding:30px;text-align:center;font-size:13px;">No items.</div>'; return; }
    filtered.forEach(entry => {
      if (entry.type === 'laserAmmo' && entry.id === 'x1') return;
      const d=entry.def; const stats=this._buildStatsList(d);
      const card=document.createElement('div'); card.className='shop-item-card';
      const icon=document.createElement('canvas'); icon.className='slot-icon shop-item-icon'; icon.width=icon.height=48;
      const ictx=icon.getContext('2d'); ictx.clearRect(0,0,48,48);
      const tmp=document.createElement('canvas'); this.drawItemIcon(tmp,entry.type,entry.id); ictx.drawImage(tmp,6,6,36,36);
      const header=document.createElement('div'); header.className='shop-card-header';
      const tb=document.createElement('div'); tb.className='shop-card-title';
      
      const isCons=['laserAmmo','missiles','mines','emp'].includes(entry.type);
      const costPer = isCons ? (d.costCredits||0) : (d.cost||0);
      
      tb.innerHTML=`<div class="shop-item-name">${d.name}</div><div class="shop-item-cost" id="cost-${entry.id}">${costPer.toLocaleString()} CR</div>`;
      header.appendChild(icon); header.appendChild(tb); card.appendChild(header);
      if (d.desc) { const dd=document.createElement('div'); dd.className='shop-item-desc'; dd.textContent=d.desc; card.appendChild(dd); }
      if (stats.length) { const sd=document.createElement('div'); sd.className='shop-item-stats'; sd.innerHTML=stats.map(s=>`<span class="shop-stat-pill">${s.icon} ${s.label}: <b>${s.val}</b></span>`).join(''); card.appendChild(sd); }
      const buyBtn=document.createElement('button'); buyBtn.className='ui-button shop-buy-btn';
      
      if (isCons) {
        const isMineOrEmp = ['mines','emp'].includes(entry.type);
        const qOptions = isMineOrEmp ? [1,5,10,50] : [50,100,500,1000];
        const qRow = document.createElement('div'); qRow.className='shop-qty-row';
        const qSel = document.createElement('select'); qSel.className='shop-qty-select';
        qOptions.forEach(q => {
          const o = document.createElement('option'); o.value = q;
          o.textContent = `x${q}`;
          qSel.appendChild(o);
        });
        qSel.value = qOptions[0];
        qRow.appendChild(qSel); card.appendChild(qRow);
        
        const updateBuyBtn = () => {
          const q   = parseInt(qSel.value);
          const tot = costPer * q;
          buyBtn.textContent = `PURCHASE — ${tot.toLocaleString()} CR`;
          const costLabel = tb.querySelector(`#cost-${entry.id}`);
          if (costLabel) costLabel.textContent = `${tot.toLocaleString()} CR`;
        };
        qSel.addEventListener('change', updateBuyBtn);
        buyBtn.onclick = () => this.buyShopItem(entry, parseInt(qSel.value));
        updateBuyBtn();
      } else {
        buyBtn.textContent = `PURCHASE — ${costPer.toLocaleString()} CR`;
        buyBtn.onclick = () => this.buyShopItem(entry);
      }
      card.appendChild(buyBtn); container.appendChild(card);
    });
  }

  refreshShop() {
    this.buildShop();
    const sc=document.getElementById('shop-credits'); if (sc && typeof player!=='undefined') sc.textContent=player.credits;
    this.renderShopCatalog();
  }

  showScreen(state) {
    this.uiLayer.classList.add('hidden'); this.menuScreen.classList.add('hidden');
    this.hangarScreen.classList.add('hidden'); this.shopScreen.classList.add('hidden');
    if (state==='menu') {
      this.menuScreen.classList.remove('hidden');
      const authContainer    = document.getElementById('auth-container');
      const respawnContainer = document.getElementById('respawn-container');
      if (player?.isDead) {
        authContainer?.classList.add('hidden');
        respawnContainer?.classList.remove('hidden');
      } else {
        authContainer?.classList.remove('hidden');
        respawnContainer?.classList.add('hidden');
      }
    } else if (state==='playing') {
      this.uiLayer.classList.remove('hidden');
    } else if (state==='hangar') {
      this.hangarScreen.classList.remove('hidden');
      this.switchBaseTab('hangar');
      const hc = document.getElementById('hangar-credits');
      if (hc) hc.textContent = player.credits;
    } else if (state==='shop') {
      this.hangarScreen.classList.remove('hidden');
      this.switchBaseTab('shop');
      const hc = document.getElementById('hangar-credits');
      if (hc) hc.textContent = player.credits;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PILOT SKILLS PANEL
  // ══════════════════════════════════════════════════════════════════════

  openPilotSkillsPanel() {
    const panel = document.getElementById('pilot-skills-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    this.updatePilotSkillsUI(player);
  }

  closePilotSkillsPanel() {
    const panel = document.getElementById('pilot-skills-panel');
    if (panel) panel.classList.add('hidden');
  }

  updatePilotSkillsUI(p) {
    if (!p) return;
    const panel = document.getElementById('pilot-skills-panel');
    if (!panel) return;

    // Header info
    const lvlEl   = document.getElementById('ps-level');
    const expEl   = document.getElementById('ps-exp-bar-fill');
    const expTxt  = document.getElementById('ps-exp-text');
    const spEl    = document.getElementById('ps-skill-points');
    if (lvlEl)  lvlEl.textContent  = p.pilotLevel || 1;
    if (spEl)   spEl.textContent   = p.skillPoints || 0;
    const exp     = p.pilotExp    || 0;
    const needed  = p.expNeeded   || 1000;
    const pct     = Math.min(100, Math.floor((exp / needed) * 100));
    if (expEl)  expEl.style.width = pct + '%';
    if (expTxt) expTxt.textContent = exp.toLocaleString() + ' / ' + needed.toLocaleString() + ' EXP';

    // Skill rows
    const SKILL_DEFS = [
      { key:'hp',      icon:'❤️',  label:'HP Boost',             desc:'Increases the maximum HP of your ship' },
      { key:'speed',   icon:'🚀',  label:'Speed Boost',          desc:'Increases base movement speed' },
      { key:'sprint',  icon:'⚡',  label:'Sprint Boost',         desc:'Increases maximum sprint duration' },
      { key:'shield',  icon:'🛡️',  label:'Shield Boost',         desc:'Increases maximum shield capacity' },
      { key:'damage',  icon:'🔥',  label:'Damage Boost',         desc:'Increases global damage for all weapons' },
      { key:'laser',   icon:'🔫',  label:'Laser Specialization', desc:'Additional buff for laser weapons only' },
      { key:'missile', icon:'🚀💥', label:'Missile Damage',      desc:'Increases missile and rocket damage' },
      { key:'coins',   icon:'💰',  label:'Extra Coins',          desc:'Increases credits earned from aliens' },
      { key:'loot',    icon:'📦',  label:'Extra Loot Drop',      desc:'Increases loot drop probability from aliens' },
      { key:'exp',     icon:'📘',  label:'Extra EXP',            desc:'Increases EXP gained from alien kills' },
    ];

    const container = document.getElementById('ps-skills-container');
    if (!container) return;
    container.innerHTML = '';

    const skills = p.pilotSkills || {};
    const sp     = p.skillPoints || 0;

    SKILL_DEFS.forEach(def => {
      const val = skills[def.key] || 0;
      const row = document.createElement('div');
      row.className = 'ps-skill-row';
      row.innerHTML = `
        <div class="ps-skill-icon">${def.icon}</div>
        <div class="ps-skill-info">
          <div class="ps-skill-name">${def.label} <span class="ps-skill-bonus">(+${val}%)</span></div>
          <div class="ps-skill-desc">${def.desc}</div>
          <div class="ps-skill-bar-wrap"><div class="ps-skill-bar-fill" style="width:${(val/25)*100}%"></div></div>
        </div>
        <div class="ps-skill-controls">
          <button class="ps-btn ps-btn-minus" data-skill="${def.key}" ${val <= 0 ? 'disabled' : ''}>−</button>
          <span class="ps-skill-val">${val} / 25</span>
          <button class="ps-btn ps-btn-plus"  data-skill="${def.key}" ${val >= 25 || sp <= 0 ? 'disabled' : ''}>+</button>
        </div>`;
      container.appendChild(row);
    });

    // +/− buttons
    container.querySelectorAll('.ps-btn-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.skill;
        const cur  = p.pilotSkills[key] || 0;
        const totSp = p.skillPoints || 0;
        if (cur >= 25 || totSp <= 0) return;
        p.pilotSkills[key] = cur + 1;
        p.skillPoints = totSp - 1;
        if (typeof wsClient !== 'undefined') wsClient.sendUpdatePilotSkills(p.pilotSkills);
        this.updatePilotSkillsUI(p);
      });
    });
    container.querySelectorAll('.ps-btn-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.skill;
        const cur  = p.pilotSkills[key] || 0;
        if (cur <= 0) return;
        p.pilotSkills[key] = cur - 1;
        p.skillPoints = (p.skillPoints || 0) + 1;
        if (typeof wsClient !== 'undefined') wsClient.sendUpdatePilotSkills(p.pilotSkills);
        this.updatePilotSkillsUI(p);
      });
    });
  }

  resetPilotSkills(p) {
    if (!p || !p.pilotSkills) return;
    const earned = Math.max(0, (p.pilotLevel || 1) - 1);
    Object.keys(p.pilotSkills).forEach(k => { p.pilotSkills[k] = 0; });
    p.skillPoints = earned;
    if (typeof wsClient !== 'undefined') wsClient.sendUpdatePilotSkills(p.pilotSkills);
    this.updatePilotSkillsUI(p);
  }
}  // end class UIManager
