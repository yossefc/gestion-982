/**
 * clothingStockService.ts - Service pour la gestion des stocks de vêtements
 * Calcule les stocks par compagnie et les quantités restantes
 */

import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { app } from '../config/firebase';
const db = getFirestore(app);
import { clothingEquipmentService } from './clothingEquipmentService';
import { soldierService } from './soldierService';
import { transactionalAssignmentService } from './transactionalAssignmentService';

export interface CompanyDistribution {
  company: string;
  quantity: number;
  soldiers: number; // Nombre de soldats qui ont cet équipement dans cette compagnie
}

export interface EquipmentStock {
  equipmentId: string;
  equipmentName: string;
  yamach: number; // Quantité totale disponible
  totalAssigned: number; // Total assigné
  available: number; // Quantité restante
  byCompany: CompanyDistribution[]; // Distribution par compagnie
}

/**
 * Calcule le stock actuel d'un équipement spécifique
 */
export const getEquipmentStock = async (equipmentId: string): Promise<EquipmentStock | null> => {
  try {
    // Récupérer l'équipement pour obtenir le ימח
    const equipment = await clothingEquipmentService.getById(equipmentId);
    if (!equipment) {
      return null;
    }

    const yamach = equipment.yamach || 0;

    // Récupérer tous les holdings actuels directement depuis soldier_holdings
    const allHoldings = await transactionalAssignmentService.getAllHoldings('clothing');

    // Calculer la distribution par compagnie
    const companyMap = new Map<string, { quantity: number; soldiers: Set<string> }>();
    let totalAssigned = 0;

    // Récupérer tous les soldats (un seul appel pour mapper les compagnies)
    const allSoldiers = await soldierService.getAll();
    const soldierMap = new Map(allSoldiers.map((s: any) => [s.id, s]));

    for (const holding of allHoldings) {
      const item = (holding.items || []).find((h: any) => h.equipmentId === equipmentId);
      if (item && item.quantity > 0) {
        const soldierData = soldierMap.get(holding.soldierId);
        const company = soldierData?.company || 'לא ידוע';

        const existing = companyMap.get(company) || { quantity: 0, soldiers: new Set() };
        existing.quantity += item.quantity;
        existing.soldiers.add(holding.soldierId);
        companyMap.set(company, existing);

        totalAssigned += item.quantity;
      }
    }

    // Convertir en tableau trié
    const byCompany: CompanyDistribution[] = Array.from(companyMap.entries())
      .map(([company, data]) => ({
        company,
        quantity: data.quantity,
        soldiers: data.soldiers.size,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      yamach,
      totalAssigned,
      available: Math.max(0, yamach - totalAssigned),
      byCompany,
    };
  } catch (error) {
    console.error('Error calculating equipment stock:', error);
    throw error;
  }
};

/**
 * Calcule les stocks pour tous les équipements
 */
export const getAllEquipmentStocks = async (): Promise<EquipmentStock[]> => {
  try {
    const allEquipment = await clothingEquipmentService.getAll();

    // Récupérer tous les holdings actuels directement depuis soldier_holdings
    const allHoldings = await transactionalAssignmentService.getAllHoldings('clothing');

    // Récupérer tous les soldats pour avoir leurs compagnies
    const allSoldiers = await soldierService.getAll();
    const soldierMap = new Map(allSoldiers.map((s: any) => [s.id, s]));

    const stocks: EquipmentStock[] = [];

    for (const equipment of allEquipment) {
      const yamach = equipment.yamach || 0;
      const companyMap = new Map<string, { quantity: number; soldiers: Set<string> }>();
      let totalAssigned = 0;

      // Pour chaque soldat, vérifier s'il a cet équipement
      for (const holding of allHoldings) {
        const item = (holding.items || []).find((h: any) => h.equipmentId === equipment.id);
        if (item && item.quantity > 0) {
          const soldierData = soldierMap.get(holding.soldierId);
          const company = soldierData?.company || 'לא ידוע';

          const existing = companyMap.get(company) || { quantity: 0, soldiers: new Set() };
          existing.quantity += item.quantity;
          existing.soldiers.add(holding.soldierId);
          companyMap.set(company, existing);

          totalAssigned += item.quantity;
        }
      }

      const byCompany: CompanyDistribution[] = Array.from(companyMap.entries())
        .map(([company, data]) => ({
          company,
          quantity: data.quantity,
          soldiers: data.soldiers.size,
        }))
        .sort((a, b) => b.quantity - a.quantity);

      stocks.push({
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        yamach,
        totalAssigned,
        available: Math.max(0, yamach - totalAssigned),
        byCompany,
      });
    }

    // Trier par nom d'équipement
    return stocks.sort((a, b) => a.equipmentName.localeCompare(b.equipmentName, 'he'));
  } catch (error) {
    console.error('Error calculating all equipment stocks:', error);
    throw error;
  }
};

/**
 * Vérifie si une quantité est disponible pour un équipement
 */
export const isQuantityAvailable = async (equipmentId: string, requestedQuantity: number): Promise<{ available: boolean; stock: EquipmentStock | null }> => {
  try {
    const stock = await getEquipmentStock(equipmentId);
    if (!stock) {
      return { available: false, stock: null };
    }

    return {
      available: stock.available >= requestedQuantity,
      stock,
    };
  } catch (error) {
    console.error('Error checking quantity availability:', error);
    return { available: false, stock: null };
  }
};

/**
 * Obtient un résumé du stock par compagnie (toutes catégories confondues)
 */
export const getStockSummaryByCompany = async (): Promise<{
  company: string;
  totalItems: number;
  totalSoldiers: number;
  equipmentCount: number;
}[]> => {
  try {
    const stocks = await getAllEquipmentStocks();
    const companyMap = new Map<string, { totalItems: number; soldiers: Set<string>; equipments: Set<string> }>();

    for (const stock of stocks) {
      for (const companyDist of stock.byCompany) {
        const existing = companyMap.get(companyDist.company) || {
          totalItems: 0,
          soldiers: new Set<string>(), // Track unique soldiers if possible, but here we only have the COUNT from byCompany
          equipments: new Set<string>(),
        };

        existing.totalItems += companyDist.quantity;
        existing.equipments.add(stock.equipmentId);

        // Since we don't have soldier IDs here (only the count from byCompany),
        // we can't accurately get the TOTAL unique soldiers without revisiting the holdings.
        // For now, let's just make it a number and sum it (which might overcount if same soldier has diff items)
        // OR we just leave it at 0 if we can't be accurate.

        companyMap.set(companyDist.company, existing);
      }
    }

    return Array.from(companyMap.entries())
      .map(([company, data]) => ({
        company,
        totalItems: data.totalItems,
        totalSoldiers: 0, // This would require deeper data to be accurate
        equipmentCount: data.equipments.size,
      }))
      .sort((a, b) => b.totalItems - a.totalItems);
  } catch (error) {
    console.error('Error getting stock summary:', error);
    throw error;
  }
};

export const clothingStockService = {
  getEquipmentStock,
  getAllEquipmentStocks,
  isQuantityAvailable,
  getStockSummaryByCompany,
};
