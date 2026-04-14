class AssemblyManager {
    constructor() {
        this.recipes = {
            'lf4': { credits: 1000000, uridium: 50000, seprom: 1000, promerium: 5000 },
            'iris': { credits: 5000000, uridium: 15000, duranium: 2000 },
            'goliath': { credits: 50000000, uridium: 100000, seprom: 5000 }
        };
    }
    
    craft(player, itemId) {
        const recipe = this.recipes[itemId];
        if (!recipe) return { success: false, message: 'Recipe not found' };
        
        // Check credits e uridium
        if (recipe.credits && player.credits < recipe.credits) return { success: false, message: 'Insufficient credits' };
        if (recipe.uridium && player.uridium < recipe.uridium) return { success: false, message: 'Insufficient uridium' };
        
        // Check materiali
        for (let res in recipe) {
            if (res !== 'credits' && res !== 'uridium') {
                if ((player.materials[res] || 0) < recipe[res]) return { success: false, message: `Insufficient materials: ${res}` };
            }
        }
        
        // Deduct
        if (recipe.credits) player.credits -= recipe.credits;
        if (recipe.uridium) player.uridium -= recipe.uridium;
        for (let res in recipe) {
            if (res !== 'credits' && res !== 'uridium') {
                player.materials[res] -= recipe[res];
            }
        }
        
        // Add item
        if (ITEMS.ships[itemId]) player.shipType = itemId;
        else if (ITEMS.lasers[itemId]) player.inventory.lasers.push(itemId);
        else if (ITEMS.drones[itemId]) player.inventory.drones.push(itemId);
        
        return { success: true, message: `${itemId} crafted successfully!` };
    }
}