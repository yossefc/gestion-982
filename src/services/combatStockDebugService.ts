/**
 * Service de debug pour identifier les doublons dans le stock
 */

import cacheService from './cacheService';
import { CombatEquipment, Soldier } from '../types';
import { transactionalAssignmentService } from './transactionalAssignmentService';
import { weaponInventoryService } from './weaponInventoryService';

export const debugStockDuplicates = async () => {
  console.log('🔍 [DEBUG] Analyse des doublons dans le stock...\n');

  try {
    // 1. Vérifier les doublons dans combatEquipment
    const gearResult = await cacheService.get<CombatEquipment>('combatEquipment');
    const allGear = gearResult.data;

    console.log(`📦 Total équipements: ${allGear.length}`);

    // Grouper par nom
    const nameGroups = new Map<string, CombatEquipment[]>();
    allGear.forEach(gear => {
      const name = gear.name || 'Sans nom';
      if (!nameGroups.has(name)) {
        nameGroups.set(name, []);
      }
      nameGroups.get(name)!.push(gear);
    });

    // Afficher les doublons
    const duplicates: Array<{ name: string; count: number; ids: string[] }> = [];
    nameGroups.forEach((items, name) => {
      if (items.length > 1) {
        duplicates.push({
          name,
          count: items.length,
          ids: items.map(i => i.id)
        });
      }
    });

    if (duplicates.length > 0) {
      console.log('\n⚠️ DOUBLONS DÉTECTÉS dans combatEquipment:');
      duplicates.forEach(dup => {
        console.log(`  • "${dup.name}" apparaît ${dup.count} fois`);
        console.log(`    IDs: ${dup.ids.join(', ')}`);
      });
    } else {
      console.log('\n✅ Aucun doublon dans combatEquipment (par nom)');
    }

    // 2. Vérifier les doublons dans holdings
    const allHoldings = await transactionalAssignmentService.getAllHoldings('combat');
    console.log(`\n📋 Total holdings: ${allHoldings.length}`);

    // Grouper par soldierId + equipmentId
    const holdingKeys = new Map<string, number>();
    allHoldings.forEach(holding => {
      (holding.items || []).forEach((item: any) => {
        const key = `${holding.soldierId}|${item.equipmentId}`;
        holdingKeys.set(key, (holdingKeys.get(key) || 0) + 1);
      });
    });

    const holdingDuplicates: Array<{ key: string; count: number }> = [];
    holdingKeys.forEach((count, key) => {
      if (count > 1) {
        holdingDuplicates.push({ key, count });
      }
    });

    if (holdingDuplicates.length > 0) {
      console.log('\n⚠️ DOUBLONS DÉTECTÉS dans soldier_holdings:');
      holdingDuplicates.slice(0, 10).forEach(dup => {
        const [soldierId, equipmentId] = dup.key.split('|');
        const gear = allGear.find(g => g.id === equipmentId);
        console.log(`  • Soldat ${soldierId.substring(0, 8)}... / ${gear?.name || equipmentId} : ${dup.count} entrées`);
      });
      if (holdingDuplicates.length > 10) {
        console.log(`  ... et ${holdingDuplicates.length - 10} autres`);
      }
    } else {
      console.log('\n✅ Aucun doublon dans soldier_holdings');
    }

    // 3. Résumé
    console.log('\n📊 RÉSUMÉ:');
    console.log(`  - Équipements uniques (par nom): ${nameGroups.size}`);
    console.log(`  - Équipements avec doublons: ${duplicates.length}`);
    console.log(`  - Holdings avec doublons: ${holdingDuplicates.length}`);

    return {
      equipmentDuplicates: duplicates,
      holdingDuplicates: holdingDuplicates,
      summary: {
        totalEquipment: allGear.length,
        uniqueNames: nameGroups.size,
        duplicateNames: duplicates.length,
        duplicateHoldings: holdingDuplicates.length
      }
    };

  } catch (error) {
    console.error('❌ Erreur lors du debug:', error);
    throw error;
  }
};

export const fixEquipmentDuplicates = async () => {
  console.log('🔧 [FIX] Correction des doublons...\n');

  const gearResult = await cacheService.get<CombatEquipment>('combatEquipment');
  const allGear = gearResult.data;

  // Grouper par nom exact
  const nameGroups = new Map<string, CombatEquipment[]>();
  allGear.forEach(gear => {
    const name = gear.name || 'Sans nom';
    if (!nameGroups.has(name)) {
      nameGroups.set(name, []);
    }
    nameGroups.get(name)!.push(gear);
  });

  const toMerge: Array<{ name: string; keepId: string; deleteIds: string[] }> = [];

  nameGroups.forEach((items, name) => {
    if (items.length > 1) {
      // Garder le premier (ou celui avec le plus de catégorie/info)
      const sorted = items.sort((a, b) => {
        // Préférer celui avec une catégorie définie
        if (a.category && !b.category) return -1;
        if (!a.category && b.category) return 1;
        // Sinon, garder le plus ancien (selon l'ordre de création)
        return 0;
      });

      const keep = sorted[0];
      const deleteList = sorted.slice(1);

      toMerge.push({
        name,
        keepId: keep.id,
        deleteIds: deleteList.map(d => d.id)
      });
    }
  });

  console.log(`📋 ${toMerge.length} doublons à fusionner`);
  toMerge.forEach(m => {
    console.log(`  • "${m.name}": garder ${m.keepId.substring(0, 8)}..., supprimer ${m.deleteIds.length} autres`);
  });

  console.log('\n⚠️ ATTENTION: Cette opération nécessite:');
  console.log('  1. Mise à jour de tous les assignments référençant les IDs à supprimer');
  console.log('  2. Mise à jour de tous les holdings référençant les IDs à supprimer');
  console.log('  3. Suppression des équipements en double');
  console.log('\n💡 Pour exécuter la correction, implémentez la logique de fusion dans firebaseService');

  return toMerge;
};

export const combatStockDebugService = {
  debugStockDuplicates,
  fixEquipmentDuplicates,
};
