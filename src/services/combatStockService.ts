import { db } from '../config/firebase';
import { Assignment, AssignmentItem, CombatEquipment, Soldier, WeaponInventoryItem } from '../types';
import { assignmentService } from './assignmentService';
import { combatEquipmentService } from './firebaseService';
import { soldierService } from './soldierService';
import { weaponInventoryService } from './weaponInventoryService';

export interface CompanyDistribution {
  company: string;
  issued: number;
  storage: number;
  soldiers: number;
}

export interface EquipmentStock {
  equipmentId: string;
  equipmentName: string;
  category: string;
  available: number; // En stock magasin (non assigné)
  storage: number;   // En stock magasin mais assigné à un soldat (Afson)
  issued: number;    // Chez le soldat (Signed)
  total: number;     // Somme de tout
  byCompany: CompanyDistribution[];
}

/**
 * Calcule les stocks pour tous les équipements de combat
 */
export const getAllEquipmentStocks = async (): Promise<EquipmentStock[]> => {
  try {
    console.log('[getAllEquipmentStocks] Début du calcul global...');

    // 1. Charger toutes les données nécessaires en parallèle
    const [allSoldiers, allWeapons, allGear, allAssignments] = await Promise.all([
      soldierService.getAll(),
      weaponInventoryService.getAllWeapons(),
      combatEquipmentService.getAll(),
      assignmentService.getAssignmentsByType('combat')
    ]);

    const soldierMap = new Map<string, Soldier>(allSoldiers.map((s: Soldier) => [s.id, s]));

    // Structure pour accumuler les résultats
    // key: equipmentId ou serialNumber (pour les armes)
    const stockMap = new Map<string, EquipmentStock>();

    // --- A. TRAITEMENT DES ARMES (Serial-controlled) ---
    allWeapons.forEach((weapon: WeaponInventoryItem) => {
      // Pour les armes, on groupe par Catégorie (ex: M16) ou Nom? 
      // Généralement on veut voir "M16 : X dispo, Y en storage, Z chez soldats"
      const equipmentId = `WEAPON_${weapon.category}`; // On groupe par catégorie d'arme
      let stock = stockMap.get(equipmentId);

      if (!stock) {
        stock = {
          equipmentId,
          equipmentName: weapon.category,
          category: 'נשק',
          available: 0,
          storage: 0,
          issued: 0,
          total: 0,
          byCompany: []
        };
        stockMap.set(equipmentId, stock);
      }

      stock.total += 1;

      if (weapon.status === 'available') {
        stock.available += 1;
      } else {
        const soldier = weapon.assignedTo ? soldierMap.get(weapon.assignedTo.soldierId) : null;
        const companyName = soldier?.company || 'לא ידוע';

        // Trouver ou créer la distrib par compagnie
        let companyDist = stock.byCompany.find(c => c.company === companyName);
        if (!companyDist) {
          companyDist = { company: companyName, issued: 0, storage: 0, soldiers: 0 };
          stock.byCompany.push(companyDist);
        }

        if (weapon.status === 'storage') {
          stock.storage += 1;
          companyDist.storage += 1;
        } else if (weapon.status === 'assigned') {
          stock.issued += 1;
          companyDist.issued += 1;
        }

        // On compte les soldats uniques par compagnie qui ont cette catégorie d'arme
        // (Approximation: on incrémente si c'est la première fois qu'on voit ce soldat pour cet équipement/compagnie)
        // Pour être exact, il faudrait un Set par equipmentId-company
      }
    });

    // --- B. TRAITEMENT DU MATÉRIEL (Quantity-based) ---
    // On va utiliser les assignments pour déterminer ce qui est 'issued' vs 'storage'
    // Pour chaque soldat, on calcule son solde actuel PAR ÉQUIPEMENT ET PAR STATUT

    // Groupement des assignments par [soldierId][equipmentId] pour trouver le dernier statut
    const soldierGearStatus = new Map<string, Map<string, { issued: number; storage: number }>>();

    // Trier les assignments par date (ancien -> récent)
    const sortedAssignments = [...allAssignments].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    sortedAssignments.forEach(asm => {
      const sId = asm.soldierId;
      if (!soldierGearStatus.has(sId)) soldierGearStatus.set(sId, new Map());
      const gearMap = soldierGearStatus.get(sId)!;

      asm.items.forEach(item => {
        // Ignorer les armes déjà traitées via weapons_inventory si on peut les identifier (souvent via serial)
        // Mais ici on traite tout le matériel de combat générique
        if (!gearMap.has(item.equipmentId)) gearMap.set(item.equipmentId, { issued: 0, storage: 0 });
        const counts = gearMap.get(item.equipmentId)!;

        const action = asm.action || (asm.status === 'נופק לחייל' ? 'issue' : 'return');

        if (action === 'issue' || action === 'add') {
          counts.issued += item.quantity;
        } else if (action === 'return' || action === 'credit') {
          // On retire d'abord du storage (priorité au retour de ce qui est stocké?) 
          // ou proportionnellement? Généralement on retire de 'issued'.
          if (counts.storage >= item.quantity) {
            counts.storage -= item.quantity;
          } else {
            const remaining = item.quantity - counts.storage;
            counts.storage = 0;
            counts.issued = Math.max(0, counts.issued - remaining);
          }
        } else if (action === 'storage') {
          // Transfert Issued -> Storage
          const toStore = Math.min(counts.issued, item.quantity);
          counts.issued -= toStore;
          counts.storage += toStore;
        } else if (action === 'retrieve') {
          // Transfert Storage -> Issued
          const toRetrieve = Math.min(counts.storage, item.quantity);
          counts.storage -= toRetrieve;
          counts.issued += toRetrieve;
        }
      });
    });

    // Maintenant on agrége les données Gear par équipement
    for (const [sId, gearMap] of soldierGearStatus.entries()) {
      const soldier = soldierMap.get(sId);
      const companyName = soldier?.company || 'לא ידוע';

      for (const [eId, counts] of gearMap.entries()) {
        if (counts.issued <= 0 && counts.storage <= 0) continue;

        let stock = stockMap.get(eId);
        if (!stock) {
          const gearInfo = allGear.find((g: CombatEquipment) => g.id === eId);
          stock = {
            equipmentId: eId,
            equipmentName: gearInfo?.name || 'ציוד לא ידוע',
            category: gearInfo?.category || 'ציוד כללי',
            available: 0, // On ne connaît pas le stock magasin pour le gear générique sans champ Yamach
            storage: 0,
            issued: 0,
            total: 0,
            byCompany: []
          };
          stockMap.set(eId, stock);
        }

        stock.issued += counts.issued;
        stock.storage += counts.storage;
        stock.total += (counts.issued + counts.storage);

        let companyDist = stock.byCompany.find(c => c.company === companyName);
        if (!companyDist) {
          companyDist = { company: companyName, issued: 0, storage: 0, soldiers: 0 };
          stock.byCompany.push(companyDist);
        }
        companyDist.issued += counts.issued;
        companyDist.storage += counts.storage;
        companyDist.soldiers += 1;
      }
    }

    // Convertir en tableau et trier
    return Array.from(stockMap.values()).sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category, 'he');
      if (catCompare !== 0) return catCompare;
      return a.equipmentName.localeCompare(b.equipmentName, 'he');
    });

  } catch (error) {
    console.error('Error in getAllEquipmentStocks:', error);
    throw error;
  }
};

export const combatStockService = {
  getAllEquipmentStocks,
};

