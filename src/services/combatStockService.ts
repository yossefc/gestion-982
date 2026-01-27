import { db } from '../config/firebase';
import { Assignment, AssignmentItem, CombatEquipment, Soldier, WeaponInventoryItem } from '../types';
import { assignmentService } from './assignmentService';
import { combatEquipmentService } from './firebaseService';
import { soldierService } from './soldierService';
import { transactionalAssignmentService } from './transactionalAssignmentService';
import { weaponInventoryService } from './weaponInventoryService';

export interface CompanyDistribution {
  company: string;
  issued: number;
  stored: number;
  soldiers: number;
}

export interface EquipmentStock {
  equipmentId: string;
  equipmentName: string;
  category: string;
  available: number; // En stock magasin (non assigné)
  stored: number;    // En stock magasin mais assigné à un soldat (Afson)
  issued: number;    // Chez le soldat (Signed)
  defective: number; // Arme défectueuse (תקול)
  total: number;     // Somme de tout
  byCompany: CompanyDistribution[];
}

/**
 * Calcule les stocks pour tous les équipements de combat
 */
export const getAllEquipmentStocks = async (): Promise<EquipmentStock[]> => {
  try {

    // 1. Charger toutes les données nécessaires en parallèle
    const [allSoldiers, allWeapons, allGear, allHoldings] = await Promise.all([
      soldierService.getAll(),
      weaponInventoryService.getAllWeapons(),
      combatEquipmentService.getAll(),
      transactionalAssignmentService.getAllHoldings('combat')
    ]);

    const soldierMap = new Map<string, Soldier>(allSoldiers.map((s: Soldier) => [s.id, s]));

    // Structure pour accumuler les résultats
    // key: equipmentId ou serialNumber (pour les armes)
    const stockMap = new Map<string, EquipmentStock>();

    // --- A. TRAITEMENT DES ARMES (Serial-controlled) ---
    allWeapons.forEach((weapon: WeaponInventoryItem) => {
      const equipmentId = `WEAPON_${weapon.category}`;
      let stock = stockMap.get(equipmentId);

      if (!stock) {
        stock = {
          equipmentId,
          equipmentName: weapon.category,
          category: 'נשק',
          available: 0,
          stored: 0,
          issued: 0,
          defective: 0,
          total: 0,
          byCompany: []
        };
        stockMap.set(equipmentId, stock);
      }

      stock.total += 1;

      if (weapon.status === 'available') {
        stock.available += 1;
      } else if (weapon.status === 'defective') {
        stock.defective += 1;
      } else {
        const soldier = weapon.assignedTo ? soldierMap.get(weapon.assignedTo.soldierId) : null;
        const companyName = soldier?.company || 'לא ידוע';

        // Trouver ou créer la distrib par compagnie
        let companyDist = stock.byCompany.find(c => c.company === companyName);
        if (!companyDist) {
          companyDist = { company: companyName, issued: 0, stored: 0, soldiers: 0 };
          stock.byCompany.push(companyDist);
        }

        if (weapon.status === 'stored') {
          stock.stored += 1;
          companyDist.stored += 1;
        } else if (weapon.status === 'assigned') {
          stock.issued += 1;
          companyDist.issued += 1;
        }
      }
    });

    // --- B. TRAITEMENT DU MATÉRIEL (Quantity-based) ---
    // On va utiliser les holdings pré-calculés dans soldier_holdings

    // Groupement des holdings par [soldierId][equipmentId]
    const soldierGearStatus = new Map<string, Map<string, { issued: number; stored: number }>>();

    allHoldings.forEach(holding => {
      const sId = holding.soldierId;
      if (!soldierGearStatus.has(sId)) soldierGearStatus.set(sId, new Map());
      const gearMap = soldierGearStatus.get(sId)!;

      (holding.items || []).forEach((item: any) => {
        if (!gearMap.has(item.equipmentId)) gearMap.set(item.equipmentId, { issued: 0, stored: 0 });
        const counts = gearMap.get(item.equipmentId)!;

        if (item.status === 'stored') {
          counts.stored += item.quantity;
        } else {
          counts.issued += item.quantity;
        }
      });
    });

    // Maintenant on agrége les données Gear par équipement
    for (const [sId, gearMap] of soldierGearStatus.entries()) {
      const soldier = soldierMap.get(sId);
      const companyName = soldier?.company || 'לא ידוע';

      for (const [eId, counts] of gearMap.entries()) {
        if (counts.issued <= 0 && counts.stored <= 0) continue;

        let stock = stockMap.get(eId);
        if (!stock) {
          const gearInfo = allGear.find((g: CombatEquipment) => g.id === eId);
          stock = {
            equipmentId: eId,
            equipmentName: gearInfo?.name || 'ציוד לא ידוע',
            category: gearInfo?.category || 'ציוד כללי',
            available: 0,
            stored: 0,
            issued: 0,
            defective: 0,
            total: 0,
            byCompany: []
          };
          stockMap.set(eId, stock);
        }

        stock.issued += counts.issued;
        stock.stored += counts.stored;
        stock.total += (counts.issued + counts.stored);

        let companyDist = stock.byCompany.find(c => c.company === companyName);
        if (!companyDist) {
          companyDist = { company: companyName, issued: 0, stored: 0, soldiers: 0 };
          stock.byCompany.push(companyDist);
        }
        companyDist.issued += counts.issued;
        companyDist.stored += counts.stored;
        companyDist.soldiers += 1;
      }
    }

    // Convertir en tableau, appliquer Math.max(0) pour éviter les négatifs, et trier
    return Array.from(stockMap.values()).map(stock => ({
      ...stock,
      available: Math.max(0, stock.available),
      stored: Math.max(0, stock.stored),
      issued: Math.max(0, stock.issued),
      defective: Math.max(0, stock.defective),
      total: Math.max(0, stock.total),
      byCompany: stock.byCompany.map(company => ({
        ...company,
        issued: Math.max(0, company.issued),
        stored: Math.max(0, company.stored),
        soldiers: Math.max(0, company.soldiers),
      }))
    })).sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category, 'he');
      if (catCompare !== 0) return catCompare;
      return a.equipmentName.localeCompare(b.equipmentName, 'he');
    });

  } catch (error) {
    throw error;
  }
};

export const combatStockService = {
  getAllEquipmentStocks,
};
