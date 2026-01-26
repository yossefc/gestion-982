/**
 * Script pour remplacer la terminologie dans tout le projet
 * - "אפנאות" → "אפנאות"
 * - "נשקייה" → "נשקייה"
 */

import * as fs from 'fs';
import * as path from 'path';

interface Replacement {
  from: string;
  to: string;
}

const replacements: Replacement[] = [
  { from: 'אפנאות', to: 'אפנאות' },
  { from: 'נשקייה', to: 'נשקייה' },
];

// Extensions de fichiers à traiter
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

// Dossiers à ignorer
const ignoreDirs = ['node_modules', '.git', '.expo', 'dist', 'build', 'coverage'];

function shouldProcessFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return extensions.includes(ext);
}

function shouldProcessDir(dirName: string): boolean {
  return !ignoreDirs.includes(dirName);
}

function replaceInFile(filePath: string): { modified: boolean; changes: number } {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let changes = 0;

    replacements.forEach(({ from, to }) => {
      const regex = new RegExp(from, 'g');
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, to);
        modified = true;
        changes += matches.length;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
    }

    return { modified, changes };
  } catch (error) {
    console.error(`Erreur lors du traitement de ${filePath}:`, error);
    return { modified: false, changes: 0 };
  }
}

function processDirectory(dirPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (shouldProcessDir(entry.name)) {
        processDirectory(fullPath);
      }
    } else if (entry.isFile() && shouldProcessFile(fullPath)) {
      const { modified, changes } = replaceInFile(fullPath);
      if (modified) {
        console.log(`✅ ${fullPath.replace(process.cwd(), '.')}: ${changes} remplacement(s)`);
      }
    }
  }
}

console.log('🔄 Remplacement de la terminologie...\n');
console.log('Remplacements:');
replacements.forEach(({ from, to }) => {
  console.log(`  "${from}" → "${to}"`);
});
console.log('\n');

const projectRoot = path.resolve(__dirname, '..');
processDirectory(projectRoot);

console.log('\n✅ Remplacement terminé !');
