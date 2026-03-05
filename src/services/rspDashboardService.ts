/**
 * rspDashboardService.ts
 * Service pour le dashboard RSP - Accès LECTURE SEULE aux données de la compagnie
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Soldier, RspAssignment, HoldingItem } from '../types';

// Types pour le dashboard RSP
export interface RspSoldierWithHoldings {
  soldier: Soldier;
  combatHoldings: HoldingItem[];
  clothingHoldings: HoldingItem[];
  rspHoldings: RspAssignment[];
  totalCombatItems: number;
  totalClothingItems: number;
  totalRspItems: number;
  totalItems: number;
  hasSigned: boolean;
}

export interface RspCompanyStats {
  totalSoldiers: number;
  soldiersWithCombat: number;
  soldiersWithClothing: number;
  soldiersWithRsp: number;
}

// מפקדה existe sous deux noms dans la base de données
const getCompanyVariants = (company: string): string[] =>
  company === 'מפקדה' ? ['מפקדה', 'מפקדה/אגמ'] : [company];

/**
 * Service pour le dashboard RSP
 */
export const rspDashboardService = {
  /**
   * Récupère tous les soldats d'une compagnie
   */
  async getSoldiersByCompany(company: string): Promise<Soldier[]> {
    try {
      const q = query(
        collection(db, 'soldiers'),
        where('company', 'in', getCompanyVariants(company))
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Soldier[];
    } catch (error) {
      console.error('Erreur lors de la récupération des soldats:', error);
      throw error;
    }
  },

  /**
   * Récupère tous les holdings (équipements) des soldats d'une compagnie
   */
  async getCompanyHoldings(company: string): Promise<RspSoldierWithHoldings[]> {
    try {
      // 1. Récupérer les soldats de la compagnie
      const soldiers = await this.getSoldiersByCompany(company);
      const soldierIds = soldiers.map(s => s.id);

      if (soldierIds.length === 0) {
        return [];
      }

      // Helper : découpe en lots de 30 (limite Firestore 'in')
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const idChunks = chunkArray(soldierIds, 30);

      // 2. Holdings + assignments filtrés par soldierIds (plus de scan complet)
      const [holdingSnapsArr, assignmentSnapsArr] = await Promise.all([
        Promise.all(idChunks.map(chunk =>
          getDocs(query(collection(db, 'soldier_holdings'), where('soldierId', 'in', chunk)))
        )),
        Promise.all(idChunks.map(chunk =>
          getDocs(query(collection(db, 'assignments'), where('soldierId', 'in', chunk)))
        )),
      ]);

      // Aplatir et séparer par type côté client
      const allHoldingsDocs    = holdingSnapsArr.flatMap(s => s.docs);
      const allAssignmentsDocs = assignmentSnapsArr.flatMap(s => s.docs);

      const combatHoldingsSnap     = { docs: allHoldingsDocs.filter(d => d.data().type === 'combat') };
      const clothingHoldingsSnap   = { docs: allHoldingsDocs.filter(d => d.data().type === 'clothing') };
      const clothingAssignmentsSnap = { docs: allAssignmentsDocs.filter(d => d.data().type === 'clothing') };

      // 3. RSP assignments + armes (collections légères, filtres existants conservés)
      const [rspAssignmentsSnap, weaponsSnap] = await Promise.all([
        getDocs(query(collection(db, 'rsp_assignments'), where('company', 'in', getCompanyVariants(company)))),
        getDocs(query(collection(db, 'weapons_inventory'), where('status', 'in', ['assigned', 'stored', 'storage']))),
      ]);

      // 4. Mapper les holdings par soldat
      const combatMap = new Map<string, HoldingItem[]>();
      combatHoldingsSnap.docs.forEach(d => {
        const data = d.data();
        if (soldierIds.includes(data.soldierId)) {
          combatMap.set(data.soldierId, data.items || []);
        }
      });

      // Fusionner les armes de l'armurerie dans combatMap
      weaponsSnap.docs.forEach(d => {
        const weapon = d.data();
        // Vérifier si l'arme est assignée à un soldat de cette compagnie
        if (weapon.assignedTo?.soldierId && soldierIds.includes(weapon.assignedTo.soldierId)) {
          const soldierId = weapon.assignedTo.soldierId;
          const currentItems = combatMap.get(soldierId) || [];

          // Chercher si ce type d'arme existe déjà dans la liste
          const existingItemIndex = currentItems.findIndex(i => i.equipmentName === weapon.category);

          if (existingItemIndex >= 0) {
            // Mise à jour de l'existant
            const existingItem = currentItems[existingItemIndex];
            existingItem.quantity += 1;
            if (!existingItem.serials) existingItem.serials = [];
            existingItem.serials.push(weapon.serialNumber);
          } else {
            // Nouvel item
            currentItems.push({
              equipmentId: `weapon_${weapon.category}`, // ID virtuel pour l'affichage
              equipmentName: weapon.category,
              quantity: 1,
              serials: [weapon.serialNumber],
              status: weapon.status === 'stored' ? 'stored' : 'assigned'
            });
          }

          combatMap.set(soldierId, currentItems);
        }
      });

      const clothingMap = new Map<string, HoldingItem[]>();
      clothingHoldingsSnap.docs.forEach(d => {
        const data = d.data();
        if (soldierIds.includes(data.soldierId)) {
          clothingMap.set(data.soldierId, data.items || []);
        }
      });

      // Fallback clothing: dériver depuis assignments pour les soldats sans holdings
      const soldiersWithClothingHoldings = new Set(clothingMap.keys());
      clothingAssignmentsSnap.docs.forEach(d => {
        const data = d.data();
        if (!soldierIds.includes(data.soldierId)) return;
        if (soldiersWithClothingHoldings.has(data.soldierId)) return;
        if (!clothingMap.has(data.soldierId)) {
          clothingMap.set(data.soldierId, []);
        }
        const items = clothingMap.get(data.soldierId)!;
        (data.items || []).forEach((item: any) => {
          const isReturn = data.action === 'return';
          const qty = isReturn ? -(item.quantity || 1) : (item.quantity || 1);
          const existing = items.find((i: HoldingItem) => i.equipmentId === item.equipmentId);
          if (existing) {
            existing.quantity += qty;
          } else {
            items.push({
              equipmentId: item.equipmentId,
              equipmentName: item.equipmentName,
              quantity: qty,
              serials: [],
            });
          }
        });
      });
      // Nettoyer les soldats fallback sans items positifs
      clothingMap.forEach((items, soldierId) => {
        if (soldiersWithClothingHoldings.has(soldierId)) return;
        const filtered = items.filter((i: HoldingItem) => i.quantity > 0);
        if (filtered.length === 0) {
          clothingMap.delete(soldierId);
        } else {
          clothingMap.set(soldierId, filtered);
        }
      });

      const rspMap = new Map<string, RspAssignment[]>();
      rspAssignmentsSnap.docs.forEach(d => {
        const data = d.data() as RspAssignment;
        const existing = rspMap.get(data.soldierId) || [];
        existing.push({
          ...data,
          id: d.id,
          lastSignatureDate: data.lastSignatureDate instanceof Date
            ? data.lastSignatureDate
            : (data.lastSignatureDate as any)?.toDate?.() || new Date(),
          createdAt: (data.createdAt as any)?.toDate?.() || new Date(),
          updatedAt: (data.updatedAt as any)?.toDate?.() || new Date(),
        });
        rspMap.set(data.soldierId, existing);
      });

      // 5. Combiner les données
      return soldiers.map(soldier => {
        const combatHoldings = combatMap.get(soldier.id) || [];
        const clothingHoldings = clothingMap.get(soldier.id) || [];
        const rspHoldings = rspMap.get(soldier.id) || [];

        const totalCombatItems = combatHoldings.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const totalClothingItems = clothingHoldings.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const totalRspItems = rspHoldings.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const totalItems = totalCombatItems + totalClothingItems + totalRspItems;

        return {
          soldier,
          combatHoldings,
          clothingHoldings,
          rspHoldings,
          totalCombatItems,
          totalClothingItems,
          totalRspItems,
          totalItems,
          hasSigned: totalItems > 0,
        };
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des holdings:', error);
      throw error;
    }
  },

  /**
   * Récupère les statistiques de la compagnie
   */
  async getCompanyStats(company: string): Promise<RspCompanyStats> {
    try {
      const holdings = await this.getCompanyHoldings(company);

      return {
        totalSoldiers: holdings.length,
        soldiersWithCombat: holdings.filter(h => h.totalCombatItems > 0).length,
        soldiersWithClothing: holdings.filter(h => h.totalClothingItems > 0).length,
        soldiersWithRsp: holdings.filter(h => h.totalRspItems > 0).length,
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  },
};
