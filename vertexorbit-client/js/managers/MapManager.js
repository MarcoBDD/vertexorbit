class MapManager {
    constructor() {
        this.currentMap = 'Arena';
        this.mapSize = { width: 20000, height: 20000 }; // Mappa ingrandita del doppio
        this.maps = {
            'Arena': { 
                name: 'Global Arena', 
                type: 'pvpve', 
                enemies: ['lordakia', 'saimon', 'mordon', 'sibelon', 'kristallin', 'kristallon', 'cubikon', 'uber_lordakia', 'interceptor', 'barracuda', 'annihilator', 'phantom'], 
                connectedTo: [], 
                bgColor: '#0a0a14', 
                starColor: '#ffffff' 
            }
        };
        
        // Posizioni basi fazione (distanti dal centro)
        const dist = 8000;
        this.bases = {
            'MMO': { x: 0, y: -dist, color: '#ff3333' },
            'EIC': { x: Math.cos(Math.PI/6) * dist, y: Math.sin(Math.PI/6) * dist, color: '#3333ff' },
            'VRU': { x: -Math.cos(Math.PI/6) * dist, y: Math.sin(Math.PI/6) * dist, color: '#33ff33' }
        };
    }
    
    getFactionBase(faction) {
        return this.bases[faction] || { x: 0, y: 0, color: '#38bdf8' };
    }
    
    changeMap(newMap, options = {}) {
        if (!this.maps[newMap]) return;
        const preservePlayerPosition = !!options.preservePlayerPosition;
        this.currentMap = newMap;
        
        const kept = entityManager.entities.filter(e => e === player || (player.pet && e === player.pet));
        entityManager.entities = [];
        
        // Generiamo le 3 basi (per ora graficamente aggiungiamo BaseStation)
        Object.keys(this.bases).forEach(faction => {
            const b = this.bases[faction];
            let baseStation = new BaseStation(b.x, b.y);
            baseStation.faction = faction;
            baseStation.color = b.color; // Custom color if supported
            entityManager.addEntity(baseStation);
        });
        
        entityManager.entities.push(...kept);
        
        if (typeof uiManager !== 'undefined') uiManager.updateMapInfo(this.maps[this.currentMap].name, this.maps[this.currentMap].type);
        
        // Se richiesto, mantieni posizione ricevuta dal server (login/sync multiplayer).
        if (!preservePlayerPosition) {
            const spawn = this.getFactionBase(player.faction);
            player.x = spawn.x;
            player.y = spawn.y;
            player.targetX = player.x;
            player.targetY = player.y;
        }
    }
}
