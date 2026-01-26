import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function simulateStockCalculation() {
  try {
    console.log('=== Simulation du calcul de stock ===\n');

    // Charger les données exactement comme le fait le service
    const [soldiersSnapshot, weaponsSnapshot, gearSnapshot, holdingsSnapshot] = await Promise.all([
      db.collection('soldiers').get(),
      db.collection('weapon_inventory').get(),
      db.collection('combat_equipment').get(),
      db.collection('soldier_holdings').where('type', '==', 'combat').get()
    ]);

    console.log(`Soldats: ${soldiersSnapshot.size}`);
    console.log(`Armes: ${weaponsSnapshot.size}`);
    console.log(`Équipements: ${gearSnapshot.size}`);
    console.log(`Holdings: ${holdingsSnapshot.size}\n`);

    const soldierMap = new Map();
    soldiersSnapshot.docs.forEach(doc => {
      soldierMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const stockMap = new Map();

    // --- TRAITEMENT DES ARMES (comme dans le code) ---
    console.log('=== Traitement des armes ===\n');
    weaponsSnapshot.docs.forEach(doc => {
      const weapon = doc.data();
      const equipmentId = `WEAPON_${weapon.category}`;

      console.log(`Arme: ${weapon.serialNumber}, catégorie: "${weapon.category}", ID généré: ${equipmentId}`);

      if (!stockMap.has(equipmentId)) {
        stockMap.set(equipmentId, {
          equipmentId,
          equipmentName: weapon.category,
          category: 'נשק',
          total: 0
        });
      }

      const stock = stockMap.get(equipmentId);
      stock.total += 1;
    });

    // --- TRAITEMENT DES GEAR (comme dans le code) ---
    console.log('\n=== Traitement des holdings ===\n');

    holdingsSnapshot.docs.forEach(doc => {
      const holding = doc.data();
      const items = holding.items || [];

      console.log(`Holding pour soldat ${holding.soldierId}: ${items.length} items`);

      items.forEach((item: any) => {
        const eId = item.equipmentId;
        console.log(`  - equipmentId: "${eId}", equipmentName: "${item.equipmentName}", qty: ${item.quantity}`);

        if (!stockMap.has(eId)) {
          // Chercher l'info du gear
          const gearDoc = gearSnapshot.docs.find(g => g.id === eId);
          const gearData = gearDoc?.data();

          console.log(`    Nouveau stock créé pour "${item.equipmentName}"`);
          console.log(`    Gear trouvé dans combat_equipment: ${gearDoc ? 'OUI' : 'NON'}`);

          stockMap.set(eId, {
            equipmentId: eId,
            equipmentName: gearData?.name || item.equipmentName || 'ציוד לא ידוע',
            category: gearData?.category || 'ציוד כללי',
            total: 0
          });
        }

        const stock = stockMap.get(eId);
        stock.total += item.quantity;
      });
    });

    console.log('\n=== Résultat final ===\n');
    console.log(`Nombre total d'entrées dans stockMap: ${stockMap.size}\n`);

    Array.from(stockMap.values()).forEach(stock => {
      console.log(`${stock.equipmentName} (${stock.category})`);
      console.log(`  ID: ${stock.equipmentId}`);
      console.log(`  Total: ${stock.total}`);
      console.log('');
    });

    // Chercher les doublons par nom
    const nameMap = new Map();
    Array.from(stockMap.values()).forEach(stock => {
      const name = stock.equipmentName;
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name).push(stock);
    });

    console.log('=== Vérification des doublons ===\n');
    let foundDuplicates = false;
    nameMap.forEach((stocks, name) => {
      if (stocks.length > 1) {
        foundDuplicates = true;
        console.log(`⚠️ DOUBLON: "${name}" apparaît ${stocks.length} fois:`);
        stocks.forEach((s: any, i: number) => {
          console.log(`  ${i + 1}. ID: ${s.equipmentId}, Catégorie: ${s.category}, Total: ${s.total}`);
        });
        console.log('');
      }
    });

    if (!foundDuplicates) {
      console.log('✓ Aucun doublon détecté dans le calcul.\n');
    }

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

simulateStockCalculation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
