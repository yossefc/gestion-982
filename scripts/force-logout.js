// Script pour forcer la déconnexion de tous les utilisateurs
// Utile pour forcer le rafraîchissement des tokens Firebase

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function revokeAllTokens() {
  try {
    console.log('🔐 RÉVOCATION DE TOUS LES TOKENS UTILISATEURS\n');
    console.log('='.repeat(60));
    
    const listUsersResult = await admin.auth().listUsers();
    
    if (listUsersResult.users.length === 0) {
      console.log('❌ Aucun utilisateur trouvé\n');
      process.exit(0);
    }
    
    console.log(`📊 ${listUsersResult.users.length} utilisateur(s) trouvé(s)\n`);
    
    for (const user of listUsersResult.users) {
      console.log(`🔄 Révocation des tokens pour: ${user.email || user.uid}`);
      await admin.auth().revokeRefreshTokens(user.uid);
      console.log('   ✅ Tokens révoqués');
      
      // Vérifier les claims actuels
      const userRecord = await admin.auth().getUser(user.uid);
      const role = userRecord.customClaims?.role || 'aucun';
      console.log(`   📋 Rôle actuel: ${role}`);
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('✅ Tous les tokens ont été révoqués!\n');
    console.log('⚠️  IMPORTANT:');
    console.log('   Les utilisateurs doivent maintenant se reconnecter');
    console.log('   pour obtenir leurs nouveaux tokens avec les rôles mis à jour.\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    process.exit(0);
  }
}

revokeAllTokens();




