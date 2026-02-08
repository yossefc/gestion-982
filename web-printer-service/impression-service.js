#!/usr/bin/env node

/**
 * SERVICE D'IMPRESSION AUTOMATIQUE - GESTION 982
 *
 * Ce script Node.js écoute Firebase directement et imprime automatiquement
 * les PDFs sans navigateur - VRAIE SOLUTION PROFESSIONNELLE!
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

// Couleurs pour console
const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

console.log(colors.cyan + '========================================');
console.log('  SERVICE D\'IMPRESSION AUTOMATIQUE');
console.log('  GESTION-982');
console.log('========================================' + colors.reset);
console.log('');

// Vérifier que serviceAccountKey.json existe
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error(colors.red + '❌ ERREUR: serviceAccountKey.json introuvable!' + colors.reset);
    console.log(colors.yellow + 'Placez le fichier à la racine du projet' + colors.reset);
    process.exit(1);
}

// Initialiser Firebase Admin
console.log(colors.yellow + '[1/3] Initialisation Firebase...' + colors.reset);
try {
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'gestion-982'
    });

    const db = admin.firestore();
    console.log(colors.green + '  ✓ Firebase initialisé' + colors.reset);
    console.log('');
} catch (error) {
    console.error(colors.red + '❌ Erreur Firebase:', error.message + colors.reset);
    process.exit(1);
}

// Dossier temporaire pour les PDFs
const tempDir = path.join(__dirname, 'temp_pdfs');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Vérifier l'imprimante par défaut
console.log(colors.yellow + '[2/3] Vérification de l\'imprimante...' + colors.reset);
exec('powershell -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object -ExpandProperty Name"', (error, stdout) => {
    if (error || !stdout.trim()) {
        console.log(colors.red + '  ⚠ Aucune imprimante par défaut détectée' + colors.reset);
        console.log(colors.yellow + '  Définissez une imprimante par défaut dans Windows' + colors.reset);
    } else {
        console.log(colors.green + '  ✓ Imprimante: ' + stdout.trim() + colors.reset);
    }
    console.log('');
});

// Fonction pour télécharger un PDF depuis une URL
function downloadPDF(url, filePath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
        });
    });
}

// Fonction pour convertir base64 en fichier PDF
function base64ToPDF(base64Data, filePath) {
    return new Promise((resolve, reject) => {
        try {
            // Enlever le préfixe "data:application/pdf;base64," si présent
            const base64Content = base64Data.replace(/^data:application\/pdf;base64,/, '');

            // Convertir en buffer et écrire
            const buffer = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(filePath, buffer);

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// Fonction pour imprimer un PDF
function printPDF(filePath) {
    return new Promise((resolve, reject) => {
        // Utiliser l'imprimante par défaut Windows
        const command = `powershell -Command "Start-Process -FilePath '${filePath}' -Verb Print"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

// Fonction pour traiter une tâche d'impression
async function processPrintJob(jobId, jobData) {
    console.log(colors.magenta + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
    console.log(colors.green + '📄 NOUVELLE TÂCHE D\'IMPRESSION' + colors.reset);
    console.log(colors.white + '   ID: ' + jobId + colors.reset);
    console.log(colors.white + '   Soldat: ' + jobData.soldierName + ' (' + jobData.soldierPersonalNumber + ')' + colors.reset);
    console.log(colors.white + '   Type: ' + jobData.documentType + colors.reset);

    try {
        // Marquer comme "en cours"
        await db.collection('print_queue').doc(jobId).update({
            status: 'printing',
            printStartedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(colors.yellow + '⬇ Téléchargement du PDF...' + colors.reset);

        // Préparer le chemin du fichier temporaire
        const fileName = `${jobData.soldierName}_${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        // Télécharger ou convertir le PDF
        if (jobData.pdfUrl.startsWith('http')) {
            // URL Firebase Storage
            await downloadPDF(jobData.pdfUrl, filePath);
        } else if (jobData.pdfUrl.startsWith('data:application/pdf;base64,')) {
            // Base64
            await base64ToPDF(jobData.pdfUrl, filePath);
        } else {
            throw new Error('Format PDF non reconnu');
        }

        console.log(colors.green + '  ✓ PDF téléchargé' + colors.reset);
        console.log(colors.yellow + '🖨️  Envoi à l\'imprimante...' + colors.reset);

        // Imprimer
        await printPDF(filePath);

        console.log(colors.green + '✅ IMPRIMÉ AVEC SUCCÈS!' + colors.reset);

        // Marquer comme terminé
        await db.collection('print_queue').doc(jobId).update({
            status: 'completed',
            printedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Nettoyer le fichier temporaire après 10 secondes
        setTimeout(() => {
            try {
                fs.unlinkSync(filePath);
                console.log(colors.gray + '  🗑️  Fichier temporaire supprimé' + colors.reset);
            } catch (err) {
                // Pas grave
            }
        }, 10000);

        console.log(colors.magenta + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
        console.log('');

    } catch (error) {
        console.error(colors.red + '❌ ERREUR:', error.message + colors.reset);

        // Marquer comme échoué
        await db.collection('print_queue').doc(jobId).update({
            status: 'failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(colors.magenta + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + colors.reset);
        console.log('');
    }
}

// Démarrer l'écoute de Firebase
console.log(colors.yellow + '[3/3] Démarrage de l\'écoute Firebase...' + colors.reset);
console.log('');
console.log(colors.green + '========================================');
console.log('  SERVICE ACTIF!');
console.log('========================================' + colors.reset);
console.log('');
console.log(colors.cyan + '📡 En attente de tâches d\'impression...' + colors.reset);
console.log(colors.gray + 'Appuyez sur Ctrl+C pour arrêter' + colors.reset);
console.log('');

const db = admin.firestore();

// Écouter les nouveaux documents avec status "pending"
const unsubscribe = db.collection('print_queue')
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const jobData = change.doc.data();
                processPrintJob(change.doc.id, jobData);
            }
        });
    }, (error) => {
        console.error(colors.red + '❌ Erreur Firebase:', error.message + colors.reset);
    });

// Gérer l'arrêt propre
process.on('SIGINT', () => {
    console.log('');
    console.log(colors.yellow + 'Arrêt du service...' + colors.reset);
    unsubscribe();
    process.exit(0);
});
