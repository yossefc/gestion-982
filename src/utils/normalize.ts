// Utilitaires de normalisation pour la recherche

/**
 * Normalise un texte pour la recherche :
 * - lowercase
 * - supprime les espaces multiples
 * - trim
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Remplace espaces multiples par un seul
}

/**
 * Construit une clé de recherche pour un soldat
 * Format: "nom téléphone numéroPersonnel compagnie"
 */
export function buildSoldierSearchKey(soldier: {
  name: string;
  personalNumber: string;
  phone?: string;
  company?: string;
}): string {
  const parts = [
    soldier.name,
    soldier.personalNumber,
    soldier.phone || '',
    soldier.company || '',
  ];
  
  return normalizeText(parts.join(' '));
}

/**
 * Crée une version lowercase du nom pour le tri
 */
export function buildNameLower(name: string): string {
  return normalizeText(name);
}

