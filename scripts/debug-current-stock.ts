import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function debugCurrentStock() {
  try {
    console.log('=== Debug du stock actuel ===\n');

    // Charger les données comme le fait le service
    const [weaponsSnapshot, holdingsSnapshot] = await Promise.all([
      db.collection('weapon_inventory').get(),
      db.collection('soldier_holdings').where('type', '==', 'combat').get()
    ]);

    console.log(`Armes trouvées: ${weaponsSnapshot.size}`);
    console.log(`Holdings trouvés: ${holdingsSnapshot.size}\n`);

    if (weaponsSnapshot.size > 0) {
      console.log('=== ARMES ===\n');

      // Grouper par catégorie
      const weaponsByCategory = new Map<string, any[]>();

      weaponsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const category = data.category || 'Sans catégorie';

        if (!weaponsByCategory.has(category)) {
          weaponsByCategory.set(category, []);
        }

        weaponsByCategory.get(category)!.push({
          id: doc.id,
          serialNumber: data.serialNumber,
          status: data.status
        });
      });

      // Afficher chaque catégorie
      Array.from(weaponsByCategory.keys()).sort().forEach(category => {
        const weapons = weaponsByCategory.get(category)!;
        console.log(`Catégorie: "${category}" (${weapons.length} armes)`);
        console.log(`  Codes caractères: [${Array.from(category).map(c => c.charCodeAt(0)).join(', ')}]`);

        weapons.slice(0, 3).forEach(w => {
          console.log(`    - ${w.serialNumber} (${w.status})`);
        });
        if (weapons.length > 3) {
          console.log(`    ... et ${weapons.length - 3} autres`);
        }
        console.log('');
      });

      // Chercher spécifiquement les doublons de catégorie
      const categories = Array.from(weaponsByCategory.keys());
      const duplicates = categories.filter((cat, i) =>
        categories.some((otherCat, j) =>
          i !== j && (cat.trim() === otherCat.trim() || cat.includes('M-16') && otherCat.includes('M-16'))
        )
      );

      if (duplicates.length > 0) {
        console.log('⚠️ DOUBLONS POTENTIELS DÉTECTÉS:\n');
        duplicates.forEach(cat => {
          console.log(`  "${cat}"`);
          console.log(`    Codes: [${Array.from(cat).map(c => c.charCodeAt(0)).join(', ')}]`);
        });
      }
    }

    if (holdingsSnapshot.size > 0) {
      console.log('\n=== HOLDINGS ===\n');

      const equipmentCounts = new Map<string, number>();

      holdingsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const items = data.items || [];

        items.forEach((item: any) => {
          const eqId = item.equipmentId || 'unknown';
          const eqName = item.equipmentName || 'unknown';
          const key = `${eqId}|||${eqName}`;

          equipmentCounts.set(key, (equipmentCounts.get(key) || 0) + item.quantity);
        });
      });

      console.log(`${equipmentCounts.size} types d'équipement différents dans les holdings:\n`);

      Array.from(equipmentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([key, count]) => {
          const [id, name] = key.split('|||');
          console.log(`  ${name} (${id}): ${count} unités`);
        });
    }

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

debugCurrentStock()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
