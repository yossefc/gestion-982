/**
 * Script de migration de l'équipement
 * Migre les données depuis l'ancien système (assignments) vers le nouveau (soldier_equipment)
 *
 * ⚠️  À exécuter UNE SEULE FOIS
 *
 * Usage: npm run migrate:equipment
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Fonction utilitaire pour fusionner les serials
function mergeSerials(existing, newSerial) {
  if (!existing && !newSerial) return undefined;
  if (!existing) return newSerial;
  if (!newSerial) return existing;

  const existingSerials = existing.split(',').map(s => s.trim());
  const newSerials = newSerial.split(',').map(s => s.trim());

  // Fusionner sans doublons
  const merged = [...new Set([...existingSerials, ...newSerials])];
  return merged.join(', ');
}

// Fonction principale de migration
async function migrateEquipment() {
  console.log('🚀 Démarrage de la migration de l\'équipement...\n');

  try {
    console.log('📥 Récupération des anciens assignments...');
    const oldAssignmentsSnapshot = await db.collection('assignments').get();

    console.log(`✅ ${oldAssignmentsSnapshot.size} assignments trouvés\n`);

    if (oldAssignmentsSnapshot.empty) {
      console.log('⚠️  Aucun assignment à migrer');
      return;
    }

    const soldierMap = new Map();

    // Phase 1: Collecter et grouper par soldat
    console.log('📊 Phase 1: Collecte et regroupement par soldat...\n');

    oldAssignmentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const soldierId = data.soldierId;

      if (!soldierId) {
        console.log(`⚠️  Assignment ${docSnap.id} sans soldierId - ignoré`);
        return;
      }

      // Créer ou récupérer l'entrée du soldat
      if (!soldierMap.has(soldierId)) {
        soldierMap.set(soldierId, {
          soldierId,
          soldierName: data.soldierName || '',
          soldierPersonalNumber: data.soldierPersonalNumber || '',
          soldierPhone: data.soldierPhone,
          soldierCompany: data.soldierCompany,
          items: [],
          lastUpdated: new Date(),
          createdAt: new Date(),
        });
      }

      const soldier = soldierMap.get(soldierId);

      // Ajouter les items de cet assignment
      const type = data.type || 'combat';
      const action = data.action || 'issue';

      (data.items || []).forEach(item => {
        const newItem = {
          equipmentId: item.equipmentId || '',
          equipmentName: item.equipmentName,
          quantity: action === 'credit' ? -item.quantity : item.quantity,
          serial: item.serial,
          type,
          category: item.category,
          subEquipments: item.subEquipments,
          issuedAt: data.timestamp ? data.timestamp.toDate() : new Date(),
          issuedBy: data.assignedBy || '',
        };

        soldier.items.push(newItem);
      });

      // Ajouter les signatures (garder la dernière)
      if (data.signature) {
        if (type === 'combat') {
          soldier.combatSignature = data.signature;
        } else {
          soldier.clothingSignature = data.signature;
        }
      }

      // Ajouter les PDFs (garder le dernier)
      if (data.pdfUrl) {
        if (type === 'combat') {
          soldier.combatPdfUrl = data.pdfUrl;
        } else {
          soldier.clothingPdfUrl = data.pdfUrl;
        }
      }
    });

    console.log(`✅ ${soldierMap.size} soldats identifiés\n`);

    // Phase 2: Consolider les items pour chaque soldat
    console.log('🔄 Phase 2: Consolidation des équipements...\n');

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [soldierId, soldier] of soldierMap) {
      try {
        // Regrouper par equipmentId + type et calculer le solde
        const consolidatedItems = new Map();

        soldier.items.forEach(item => {
          const key = `${item.equipmentId}_${item.type}`;

          if (consolidatedItems.has(key)) {
            const existing = consolidatedItems.get(key);
            existing.quantity += item.quantity;
            existing.serial = mergeSerials(existing.serial, item.serial);
            // Garder la date la plus récente
            if (item.issuedAt > existing.issuedAt) {
              existing.issuedAt = item.issuedAt;
              existing.issuedBy = item.issuedBy;
            }
          } else {
            consolidatedItems.set(key, { ...item });
          }
        });

        // Garder seulement les items avec quantité > 0
        soldier.items = Array.from(consolidatedItems.values())
          .filter(item => item.quantity > 0)
          .map(item => {
            // Nettoyer les valeurs undefined pour Firestore
            const cleanItem = { ...item };
            Object.keys(cleanItem).forEach(key => {
              if (cleanItem[key] === undefined) {
                delete cleanItem[key];
              }
            });
            return cleanItem;
          });

        // Nettoyer l'objet soldier des valeurs undefined
        const cleanSoldier = {
          soldierId: soldier.soldierId,
          soldierName: soldier.soldierName,
          soldierPersonalNumber: soldier.soldierPersonalNumber,
          items: soldier.items,
          lastUpdated: admin.firestore.Timestamp.now(),
          createdAt: admin.firestore.Timestamp.now(),
        };

        // Ajouter les champs optionnels uniquement s'ils sont définis
        if (soldier.soldierPhone) cleanSoldier.soldierPhone = soldier.soldierPhone;
        if (soldier.soldierCompany) cleanSoldier.soldierCompany = soldier.soldierCompany;
        if (soldier.combatSignature) cleanSoldier.combatSignature = soldier.combatSignature;
        if (soldier.clothingSignature) cleanSoldier.clothingSignature = soldier.clothingSignature;
        if (soldier.combatPdfUrl) cleanSoldier.combatPdfUrl = soldier.combatPdfUrl;
        if (soldier.clothingPdfUrl) cleanSoldier.clothingPdfUrl = soldier.clothingPdfUrl;

        // Sauvegarder dans la nouvelle collection si nécessaire
        if (cleanSoldier.items.length > 0 || cleanSoldier.combatSignature || cleanSoldier.clothingSignature) {
          await db.collection('soldier_equipment').doc(soldierId).set(cleanSoldier);

          const combatItems = soldier.items.filter(i => i.type === 'combat').length;
          const clothingItems = soldier.items.filter(i => i.type === 'clothing').length;

          console.log(`✅ Migré: ${soldier.soldierName} (${soldier.soldierPersonalNumber})`);
          console.log(`   Combat: ${combatItems} items | Clothing: ${clothingItems} items`);
          console.log(`   Total: ${soldier.items.length} items\n`);

          migratedCount++;
        } else {
          console.log(`⏭️  Ignoré (pas d'équipement): ${soldier.soldierName} (${soldierId})`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${soldier.soldierName}:`, error.message);
        errorCount++;
      }
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(60));
    console.log(`✅ Soldats migrés avec succès : ${migratedCount}`);
    console.log(`⏭️  Soldats ignorés (vides)    : ${skippedCount}`);
    console.log(`❌ Erreurs                     : ${errorCount}`);
    console.log(`📦 Total de soldats            : ${soldierMap.size}`);
    console.log(`📝 Total d'assignments source  : ${oldAssignmentsSnapshot.size}`);
    console.log('='.repeat(60) + '\n');

    if (migratedCount > 0) {
      console.log('🎉 Migration terminée avec succès !');
      console.log('\n⚠️  PROCHAINES ÉTAPES:');
      console.log('1. Vérifier les données migrées dans Firestore (collection soldier_equipment)');
      console.log('2. Tester l\'application avec le nouveau système');
      console.log('3. Une fois validé, vous pourrez archiver l\'ancienne collection "assignments"\n');
    }

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateEquipment()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Échec du script:', error.message);
    process.exit(1);
  });
