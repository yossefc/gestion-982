/**
 * Script de configuration des Custom Claims (rôles utilisateurs)
 * Nécessite Firebase Admin SDK
 * 
 * Installation: npm install --save-dev firebase-admin
 * Usage: npx ts-node scripts/setup-custom-claims.ts
 */

// @ts-ignore
import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Initialiser Firebase Admin
// Option 1: Via variable d'environnement GOOGLE_APPLICATION_CREDENTIALS
// Option 2: Via serviceAccountKey.json
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} catch (error) {
  console.error('❌ Erreur initialisation Firebase Admin:', error);
  console.log('\n💡 Assurez-vous que:');
  console.log('1. Vous avez téléchargé le fichier serviceAccountKey.json depuis Firebase Console');
  console.log('2. Variable d\'environnement: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function setUserRole(email: string, role: 'admin' | 'arme' | 'vetement' | 'both') {
  try {
    // Récupérer l'utilisateur par email
    const user = await admin.auth().getUserByEmail(email);
    
    // Définir les custom claims
    await admin.auth().setCustomUserClaims(user.uid, { role });
    
    console.log(`✅ Rôle "${role}" attribué à ${email} (UID: ${user.uid})`);
    
    // Afficher les claims actuels
    const updatedUser = await admin.auth().getUser(user.uid);
    console.log('📋 Custom claims:', updatedUser.customClaims);
    
    return true;
  } catch (error: any) {
    console.error(`❌ Erreur:`, error.message);
    return false;
  }
}

async function listUsers() {
  try {
    console.log('\n👥 LISTE DES UTILISATEURS:\n');
    
    const listUsersResult = await admin.auth().listUsers(100);
    
    if (listUsersResult.users.length === 0) {
      console.log('Aucun utilisateur trouvé');
      return;
    }

    listUsersResult.users.forEach((user: any, index: number) => {
      const role = user.customClaims?.role || 'aucun';
      console.log(`${index + 1}. ${user.email || 'No email'}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Rôle: ${role}`);
      console.log(`   Créé: ${user.metadata.creationTime}\n`);
    });
  } catch (error) {
    console.error('❌ Erreur lors de la liste:', error);
  }
}

async function main() {
  console.log('🔐 CONFIGURATION DES RÔLES UTILISATEURS - Gestion-982\n');
  console.log('Rôles disponibles:');
  console.log('  - admin    : Accès complet (users, arme, vetement)');
  console.log('  - arme     : Module arme uniquement');
  console.log('  - vetement : Module vêtement uniquement');
  console.log('  - both     : Modules arme + vêtement (pas admin)\n');

  while (true) {
    console.log('\nOptions:');
    console.log('1. Lister les utilisateurs');
    console.log('2. Attribuer un rôle');
    console.log('3. Quitter\n');

    const choice = await question('Votre choix (1/2/3): ');

    switch (choice.trim()) {
      case '1':
        await listUsers();
        break;

      case '2':
        const email = await question('Email de l\'utilisateur: ');
        if (!email.trim()) {
          console.log('❌ Email invalide');
          break;
        }

        console.log('\nRôles:');
        console.log('1. admin');
        console.log('2. arme');
        console.log('3. vetement');
        console.log('4. both');
        
        const roleChoice = await question('\nChoisir un rôle (1/2/3/4): ');
        
        let role: 'admin' | 'arme' | 'vetement' | 'both';
        switch (roleChoice.trim()) {
          case '1': role = 'admin'; break;
          case '2': role = 'arme'; break;
          case '3': role = 'vetement'; break;
          case '4': role = 'both'; break;
          default:
            console.log('❌ Choix invalide');
            continue;
        }

        console.log(`\n⚙️  Attribution du rôle "${role}" à ${email}...`);
        await setUserRole(email.trim(), role);
        break;

      case '3':
        console.log('\n👋 Au revoir!\n');
        rl.close();
        process.exit(0);

      default:
        console.log('❌ Choix invalide');
    }
  }
}

// Exécuter
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  rl.close();
  process.exit(1);
});

