import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkDuplicateHoldings() {
  try {
    console.log('=== Vérification des holdings pour détecter les doublons ===\n');

    const holdingsSnapshot = await db.collection('soldier_holdings')
      .where('type', '==', 'combat')
      .get();

    console.log(`Total holdings de type combat: ${holdingsSnapshot.size}\n`);

    // Collecter tous les items de tous les holdings
    const allItems: any[] = [];

    holdingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const items = data.items || [];

      items.forEach((item: any) => {
        allItems.push({
          holdingDocId: doc.id,
          soldierId: data.soldierId,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          quantity: item.quantity,
          status: item.status
        });
      });
    });

    console.log(`Total items dans tous les holdings: ${allItems.length}\n`);

    // Grouper par equipmentName pour chercher les variations
    const byName = new Map<string, any[]>();

    allItems.forEach(item => {
      const name = item.equipmentName || 'Sans nom';
      if (!byName.has(name)) {
        byName.set(name, []);
      }
      byName.get(name)!.push(item);
    });

    console.log('=== Items groupés par nom ===\n');

    Array.from(byName.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([name, items]) => {
        console.log(`"${name}": ${items.length} occurrences`);

        // Vérifier s'il y a des equipmentId différents pour le même nom
        const uniqueIds = new Set(items.map(i => i.equipmentId));

        if (uniqueIds.size > 1) {
          console.log(`  ⚠️ PROBLÈME: ${uniqueIds.size} equipmentId différents pour le même nom!`);
          uniqueIds.forEach(id => {
            const count = items.filter(i => i.equipmentId === id).length;
            console.log(`    - ID "${id}": ${count} occurrences`);
          });
        }

        // Afficher quelques détails
        items.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i + 1}. Soldat: ${item.soldierId}, ID: ${item.equipmentId}, Qty: ${item.quantity}, Status: ${item.status}`);
        });

        if (items.length > 3) {
          console.log(`  ... et ${items.length - 3} autres`);
        }

        console.log('');
      });

    // Chercher spécifiquement M-16
    console.log('\n=== Recherche spécifique de M-16 ===\n');

    const m16Items = allItems.filter(item =>
      item.equipmentName && item.equipmentName.includes('M-16')
    );

    console.log(`Nombre d'items M-16: ${m16Items.length}\n`);

    m16Items.forEach((item, i) => {
      console.log(`${i + 1}. "${item.equipmentName}"`);
      console.log(`   ID: ${item.equipmentId}`);
      console.log(`   Soldat: ${item.soldierId}`);
      console.log(`   Qty: ${item.quantity}`);
      const chars = item.equipmentName.split('');
      console.log(`   Codes caractères du nom: [${chars.map((c: string) => c.charCodeAt(0)).join(', ')}]`);
      console.log('');
    });

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

checkDuplicateHoldings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
