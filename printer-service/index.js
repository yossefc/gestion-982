/**
 * Service d'impression centralisé pour Gestion 982
 *
 * Ce service écoute la collection Firebase "print_queue"
 * et imprime automatiquement les documents sur l'imprimante locale
 */

const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const printer = require('pdf-to-printer');
require('dotenv').config();

// Configuration
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || '../serviceAccountKey.json';
const PRINTER_NAME = process.env.PRINTER_NAME || undefined; // undefined = imprimante par défaut
const TEMP_DIR = path.join(__dirname, 'temp');
const PRINTER_ID = process.env.PRINTER_ID || require('os').hostname();

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}[${new Date().toLocaleTimeString('he-IL')}] ${message}${colors.reset}`);
}

// Initialiser Firebase Admin
try {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + '.appspot.com',
  });
  log('✓ Firebase Admin initialisé', 'green');
} catch (error) {
  log(`✗ Erreur d'initialisation Firebase: ${error.message}`, 'red');
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Créer le dossier temporaire
fs.ensureDirSync(TEMP_DIR);
log(`✓ Dossier temporaire créé: ${TEMP_DIR}`, 'green');

/**
 * Télécharge un PDF depuis Firebase Storage
 */
async function downloadPDF(pdfUrl, jobId) {
  try {
    log(`⬇ Téléchargement du PDF pour le job ${jobId}...`, 'blue');

    const response = await axios({
      method: 'GET',
      url: pdfUrl,
      responseType: 'arraybuffer',
    });

    const filePath = path.join(TEMP_DIR, `${jobId}.pdf`);
    await fs.writeFile(filePath, response.data);

    log(`✓ PDF téléchargé: ${filePath}`, 'green');
    return filePath;
  } catch (error) {
    log(`✗ Erreur de téléchargement: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Imprime un fichier PDF
 */
async function printPDF(filePath, soldierName) {
  try {
    log(`🖨️  Impression en cours: ${soldierName}...`, 'cyan');

    const options = {
      printer: PRINTER_NAME, // undefined = imprimante par défaut
    };

    await printer.print(filePath, options);

    log(`✓ Document imprimé avec succès!`, 'green');
  } catch (error) {
    log(`✗ Erreur d'impression: ${error.message}`, 'red');
    throw error;
  }
}

/**
 * Nettoie les fichiers temporaires
 */
async function cleanupTempFile(filePath) {
  try {
    await fs.remove(filePath);
    log(`✓ Fichier temporaire supprimé: ${path.basename(filePath)}`, 'green');
  } catch (error) {
    log(`⚠ Erreur de nettoyage: ${error.message}`, 'yellow');
  }
}

/**
 * Traite un job d'impression
 */
async function processPrintJob(job) {
  const jobId = job.id;
  const data = job.data();

  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`🆕 Nouveau job d'impression: ${jobId}`, 'cyan');
  log(`   Soldat: ${data.soldierName} (${data.soldierPersonalNumber})`, 'blue');
  log(`   Type: ${data.documentType}`, 'blue');
  log(`   Créé par: ${data.createdByName}`, 'blue');

  let filePath = null;

  try {
    // Marquer comme "printing"
    await db.collection('print_queue').doc(jobId).update({
      status: 'printing',
      printedBy: PRINTER_ID,
      printStartedAt: admin.firestore.Timestamp.now(),
    });
    log(`✓ Job marqué comme "en cours d'impression"`, 'green');

    // Télécharger le PDF
    filePath = await downloadPDF(data.pdfUrl, jobId);

    // Imprimer
    await printPDF(filePath, data.soldierName);

    // Marquer comme completed
    await db.collection('print_queue').doc(jobId).update({
      status: 'completed',
      printedAt: admin.firestore.Timestamp.now(),
    });
    log(`✓ Job marqué comme "complété"`, 'green');
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'green');

  } catch (error) {
    log(`✗ Erreur lors du traitement du job: ${error.message}`, 'red');

    // Marquer comme failed
    try {
      await db.collection('print_queue').doc(jobId).update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.Timestamp.now(),
      });
      log(`✓ Job marqué comme "échoué"`, 'yellow');
    } catch (updateError) {
      log(`✗ Impossible de mettre à jour le statut: ${updateError.message}`, 'red');
    }

    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'red');
  } finally {
    // Nettoyer le fichier temporaire
    if (filePath) {
      await cleanupTempFile(filePath);
    }
  }
}

/**
 * Écoute les nouveaux jobs dans la file d'attente
 */
function startListening() {
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`🖨️  SERVICE D'IMPRESSION GESTION 982 - DÉMARRÉ`, 'cyan');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`   ID Imprimante: ${PRINTER_ID}`, 'blue');
  log(`   Imprimante cible: ${PRINTER_NAME || 'Par défaut'}`, 'blue');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`👂 En écoute des nouveaux jobs...`, 'yellow');

  const query = db.collection('print_queue')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc');

  const unsubscribe = query.onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          processPrintJob(change.doc);
        }
      });
    },
    (error) => {
      log(`✗ Erreur d'écoute Firebase: ${error.message}`, 'red');
      log(`⚠ Tentative de reconnexion dans 5 secondes...`, 'yellow');
      setTimeout(() => {
        log(`🔄 Reconnexion...`, 'cyan');
        startListening();
      }, 5000);
    }
  );

  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
    log(`🛑 Arrêt du service...`, 'yellow');
    unsubscribe();
    log(`✓ Service arrêté proprement`, 'green');
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
    process.exit(0);
  });
}

// Nettoyer les anciens fichiers temporaires au démarrage
async function cleanupOldTempFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    for (const file of files) {
      await fs.remove(path.join(TEMP_DIR, file));
    }
    log(`✓ Anciens fichiers temporaires nettoyés (${files.length})`, 'green');
  } catch (error) {
    log(`⚠ Erreur de nettoyage initial: ${error.message}`, 'yellow');
  }
}

// Démarrer le service
(async () => {
  await cleanupOldTempFiles();
  startListening();
})();
