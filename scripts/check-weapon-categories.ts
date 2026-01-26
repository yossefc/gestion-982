import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkWeaponCategories() {
  try {
    console.log('=== Vérification des catégories d\'armes ===\n');

    // Récupérer toutes les armes
    const weaponsSnapshot = await db.collection('weapon_inventory').get();

    console.log(`Total d'armes: ${weaponsSnapshot.size}\n`);

    // Regrouper par catégorie (exactement comme le code le fait)
    const byCategory: { [key: string]: any[] } = {};

    weaponsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'Sans catégorie';

      if (!byCategory[category]) {
        byCategory[category] = [];
      }

      byCategory[category].push({
        id: doc.id,
        serialNumber: data.serialNumber,
        status: data.status,
        category: data.category
      });
    });

    // Afficher toutes les catégories avec leur nombre
    console.log('Catégories trouvées:\n');
    const categories = Object.keys(byCategory).sort();

    categories.forEach(cat => {
      const count = byCategory[cat].length;
      console.log(`  "${cat}": ${count} armes`);

      // Afficher les détails pour détecter les variations
      const uniqueVariations = new Set(byCategory[cat].map(w => w.category));
      if (uniqueVariations.size > 1) {
        console.log('    ⚠️ Variations détectées:');
        uniqueVariations.forEach(v => {
          console.log(`      - "${v}"`);
        });
      }
    });

    // Rechercher spécifiquement les M-16
    console.log('\n=== Recherche des M-16 ===\n');
    const m16Variations: { [key: string]: number } = {};

    weaponsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || '';

      if (category.includes('M-16') || category.includes('M16')) {
        if (!m16Variations[category]) {
          m16Variations[category] = 0;
        }
        m16Variations[category]++;
      }
    });

    if (Object.keys(m16Variations).length > 0) {
      console.log('Variations de M-16 trouvées:');
      Object.keys(m16Variations).forEach(cat => {
        console.log(`  "${cat}": ${m16Variations[cat]} armes`);

        // Afficher les codes des caractères pour détecter les différences
        console.log(`    Codes: [${Array.from(cat).map(c => c.charCodeAt(0)).join(', ')}]`);
      });

      if (Object.keys(m16Variations).length > 1) {
        console.log('\n⚠️ PROBLÈME: Plusieurs variations de M-16 détectées!');
        console.log('Cela explique pourquoi M-16 apparaît plusieurs fois dans le tableau.');
      }
    } else {
      console.log('Aucune arme M-16 trouvée.');
    }

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

checkWeaponCategories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
