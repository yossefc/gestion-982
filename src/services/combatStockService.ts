import { CombatEquipment, Soldier, WeaponInventoryItem } from '../types';
import { getCombatCategorySortRank } from '../config/combatCategories';
import { transactionalAssignmentService } from './transactionalAssignmentService';
import { weaponInventoryService } from './weaponInventoryService';
import cacheService from './cacheService';

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
  available: number; // In armory and not assigned
  stored: number; // In storage (assigned but stored)
  issued: number; // Issued to soldier
  defective: number;
  total: number;
  byCompany: CompanyDistribution[];
}

const HEB_WEAPON_CATEGORY = '\u05e0\u05e9\u05e7'; // נשק
const HEB_UNKNOWN_COMPANY = '\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2'; // לא ידוע
const HEB_UNKNOWN_EQUIPMENT = '\u05e6\u05d9\u05d5\u05d3 \u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2'; // ציוד לא ידוע
const HEB_GENERAL_EQUIPMENT = '\u05e6\u05d9\u05d5\u05d3 \u05db\u05dc\u05dc\u05d9'; // ציוד כללי

function normalizeKey(value: string | undefined): string {
  return (value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildWeaponKey(category: string): string {
  return `WEAPON::${normalizeKey(category)}`;
}

function buildGearKey(category: string, name: string): string {
  return `GEAR::${normalizeKey(category)}::${normalizeKey(name)}`;
}

function getCompanyDistribution(
  stock: EquipmentStock,
  companyName: string
): CompanyDistribution {
  let companyDist = stock.byCompany.find(c => c.company === companyName);
  if (!companyDist) {
    companyDist = { company: companyName, issued: 0, stored: 0, soldiers: 0 };
    stock.byCompany.push(companyDist);
  }
  return companyDist;
}

/**
 * Compute combat stock table.
 * Merges duplicate display rows (same category+name) and avoids weapon double counting.
 */
export const getAllEquipmentStocks = async (): Promise<EquipmentStock[]> => {
  const [soldiersResult, gearResult, allWeapons, allHoldings] = await Promise.all([
    cacheService.get<Soldier>('soldiers'),
    cacheService.get<CombatEquipment>('combatEquipment'),
    weaponInventoryService.getAllWeapons(),
    transactionalAssignmentService.getAllHoldings('combat'),
  ]);

  const allSoldiers = soldiersResult.data;
  const allGear = gearResult.data;

  const soldierMap = new Map<string, Soldier>(allSoldiers.map((s: Soldier) => [s.id, s]));
  const gearById = new Map<string, CombatEquipment>(allGear.map((g: CombatEquipment) => [g.id, g]));
  const weaponCategoryKeySet = new Set<string>(
    allWeapons.map((w: WeaponInventoryItem) => normalizeKey(w.category))
  );

  // Canonical key map for output rows.
  const stockMap = new Map<string, EquipmentStock>();

  // A. Weapons: source of truth is weapons_inventory.
  allWeapons.forEach((weapon: WeaponInventoryItem) => {
    const originalGear = allGear.find(g => normalizeKey(g.name) === normalizeKey(weapon.category));
    const realCategory = originalGear?.category || HEB_WEAPON_CATEGORY;
    const isRealWeapon = realCategory === HEB_WEAPON_CATEGORY;

    // For real weapons, keep using WEAPON_ prefix. For gear tracked by serials, use GEAR_ prefix to merge correctly
    const stockKey = isRealWeapon ? buildWeaponKey(weapon.category) : buildGearKey(realCategory, weapon.category);

    let stock = stockMap.get(stockKey);

    if (!stock) {
      stock = {
        equipmentId: `WEAPON_${weapon.category}`,
        equipmentName: weapon.category,
        category: realCategory,
        available: 0,
        stored: 0,
        issued: 0,
        defective: 0,
        total: 0,
        byCompany: [],
      };
      stockMap.set(stockKey, stock);
    }

    stock.total += 1;

    if (weapon.status === 'available') {
      stock.available += 1;
      return;
    }

    if (weapon.status === 'defective') {
      stock.defective += 1;
      return;
    }

    const soldier = weapon.assignedTo ? soldierMap.get(weapon.assignedTo.soldierId) : null;
    const companyName = soldier?.company || HEB_UNKNOWN_COMPANY;
    const companyDist = getCompanyDistribution(stock, companyName);

    if ((weapon.status as any) === 'stored' || (weapon.status as any) === 'storage') {
      stock.stored += 1;
      companyDist.stored += 1;
    } else if (weapon.status === 'assigned') {
      stock.issued += 1;
      companyDist.issued += 1;
    }
  });

  // B. Quantity-based holdings.
  const soldierGearStatus = new Map<string, Map<string, { issued: number; stored: number }>>();

  allHoldings.forEach(holding => {
    const sId = holding.soldierId;
    if (!soldierGearStatus.has(sId)) soldierGearStatus.set(sId, new Map());
    const gearMap = soldierGearStatus.get(sId)!;

    (holding.items || []).forEach((item: any) => {
      if (!gearMap.has(item.equipmentId)) gearMap.set(item.equipmentId, { issued: 0, stored: 0 });
      const counts = gearMap.get(item.equipmentId)!;

      if ((item.status as any) === 'stored' || (item.status as any) === 'storage') {
        counts.stored += item.quantity;
      } else {
        counts.issued += item.quantity;
      }
    });
  });

  for (const [sId, gearMap] of soldierGearStatus.entries()) {
    const soldier = soldierMap.get(sId);
    const companyName = soldier?.company || HEB_UNKNOWN_COMPANY;

    for (const [eId, counts] of gearMap.entries()) {
      if (counts.issued <= 0 && counts.stored <= 0) continue;

      const gearInfo = gearById.get(eId);
      const equipmentName = gearInfo?.name || HEB_UNKNOWN_EQUIPMENT;
      const category = gearInfo?.category || HEB_GENERAL_EQUIPMENT;

      // Avoid duplicate/double-count rows for weapons already computed from inventory.
      if (eId.startsWith('WEAPON_') || weaponCategoryKeySet.has(normalizeKey(equipmentName))) {
        continue;
      }

      const stockKey = buildGearKey(category, equipmentName);
      let stock = stockMap.get(stockKey);
      if (!stock) {
        stock = {
          equipmentId: eId,
          equipmentName,
          category,
          available: 0,
          stored: 0,
          issued: 0,
          defective: 0,
          total: 0,
          byCompany: [],
        };
        stockMap.set(stockKey, stock);
      }

      stock.issued += counts.issued;
      stock.stored += counts.stored;

      const companyDist = getCompanyDistribution(stock, companyName);
      companyDist.issued += counts.issued;
      companyDist.stored += counts.stored;
      companyDist.soldiers += 1;
    }
  }

  // C. Add unassigned / unused gear that implies a total quantity (like manual serial)
  for (const gear of allGear) {
    if (gear.requiresManualSerial || gear.requiresSerial) {
      if (gear.id.startsWith('WEAPON_') || weaponCategoryKeySet.has(normalizeKey(gear.name))) {
        continue;
      }

      const stockKey = buildGearKey(gear.category, gear.name);
      let stock = stockMap.get(stockKey);

      if (!stock) {
        stock = {
          equipmentId: gear.id,
          equipmentName: gear.name,
          category: gear.category,
          available: 0,
          stored: 0,
          issued: 0,
          defective: 0,
          total: 0,
          byCompany: [],
        };
        stockMap.set(stockKey, stock);
      }

      if (gear.requiresManualSerial) {
        // Compute correct values dynamically for manual serial equipment
        stock.total = gear.totalQuantity || 0;
        // Note: issued and stored are already aggregated from holdings loops above
        stock.available = stock.total - stock.issued - stock.stored - stock.defective;
      }
    }
  }

  // D. Compute total and available for standard (non-serial) gear only.
  // Weapons (Section A) and manual-serial gear (Section C) must NOT be touched here.
  for (const stock of stockMap.values()) {
    // Weapons: fully computed in Section A — skip.
    if (stock.equipmentId.startsWith('WEAPON_')) continue;

    const gearInfo = gearById.get(stock.equipmentId);
    // Manual-serial gear: total = totalQuantity, available already set in Section C — skip.
    if (gearInfo?.requiresManualSerial) continue;

    // Standard gear: no predefined total, everything in circulation.
    stock.total = stock.issued + stock.stored + stock.defective;
    stock.available = 0;
  }

  return Array.from(stockMap.values())
    .map(stock => ({
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
      })),
    }))
    .sort((a, b) => {
      // Weapons always at the top
      const aIsWeapon = a.equipmentId.startsWith('WEAPON_');
      const bIsWeapon = b.equipmentId.startsWith('WEAPON_');
      if (aIsWeapon && !bIsWeapon) return -1;
      if (!aIsWeapon && bIsWeapon) return 1;

      const orderCompare = getCombatCategorySortRank(a.category) - getCombatCategorySortRank(b.category);
      if (orderCompare !== 0) return orderCompare;
      const catCompare = a.category.localeCompare(b.category, 'he');
      if (catCompare !== 0) return catCompare;
      return a.equipmentName.localeCompare(b.equipmentName, 'he');
    });
};

export const combatStockService = {
  getAllEquipmentStocks,
};
