class SkylabManager {
    constructor() {
        // Produzione oraria base
        this.productionRates = {
            prometium: 100,
            endurium: 100,
            terbium: 100
        };
        
        // Costi di raffinazione
        this.refiningCosts = {
            prometid: { prometium: 20, endurium: 10 },
            duranium: { endurium: 10, terbium: 20 },
            promerium: { prometid: 10, duranium: 10, xenomit: 1 },
            seprom: { promerium: 10 }
        };
        
        this.lastUpdate = Date.now();
    }
    
    update(player) {
        const now = Date.now();
        const deltaHours = (now - this.lastUpdate) / (1000 * 60 * 60); // In ore
        this.lastUpdate = now;
        
        if (deltaHours > 0) {
            // Produzione passiva (da espandere con livelli collettori)
            // Usa una proprietà temporanea per accumulare i resti decimali ed evitare float in inventario
            if (!player._skylabFractions) player._skylabFractions = { prometium: 0, endurium: 0, terbium: 0 };
            
            player._skylabFractions.prometium += this.productionRates.prometium * deltaHours;
            const promInt = Math.floor(player._skylabFractions.prometium);
            player.materials.prometium += promInt;
            player._skylabFractions.prometium -= promInt;
            
            player._skylabFractions.endurium += this.productionRates.endurium * deltaHours;
            const endInt = Math.floor(player._skylabFractions.endurium);
            player.materials.endurium += endInt;
            player._skylabFractions.endurium -= endInt;
            
            player._skylabFractions.terbium += this.productionRates.terbium * deltaHours;
            const terInt = Math.floor(player._skylabFractions.terbium);
            player.materials.terbium += terInt;
            player._skylabFractions.terbium -= terInt;
        }
    }
    
    refine(player, targetRes, amount) {
        const cost = this.refiningCosts[targetRes];
        if (!cost) return false;
        
        // Verifica disponibilità
        for (let res in cost) {
            if (player.materials[res] < cost[res] * amount) return false;
        }
        
        // Sottrai
        for (let res in cost) {
            player.materials[res] -= cost[res] * amount;
        }
        
        // Aggiungi
        if (!player.materials[targetRes]) player.materials[targetRes] = 0;
        player.materials[targetRes] += amount;
        
        return true;
    }
}