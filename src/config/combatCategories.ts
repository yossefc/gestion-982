export interface CombatCategoryDefinition {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const COMBAT_CATEGORY_ALL = '\u05d4\u05db\u05dc'; // הכל
export const COMBAT_CATEGORY_OTHER = '\u05d0\u05d7\u05e8'; // אחר

// Edit this list to change available combat equipment categories and display order.
export const COMBAT_CATEGORY_DEFINITIONS: CombatCategoryDefinition[] = [
  { id: '\u05e0\u05e9\u05e7', label: '\u05e0\u05e9\u05e7', icon: '🔫', color: '#E53935' }, // נשק
  { id: '\u05d0\u05d5\u05e4\u05d8\u05d9\u05e7\u05d4', label: '\u05d0\u05d5\u05e4\u05d8\u05d9\u05e7\u05d4', icon: '🔭', color: '#8E24AA' }, // אופטיקה
  { id: '\u05d0\u05de\u05e8"\u05dc', label: '\u05d0\u05de\u05e8"\u05dc', icon: '🛡️', color: '#43A047' }, // אמר"ל
  { id: '\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9\u05dd', label: '\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9\u05dd', icon: '🔧', color: '#FB8C00' }, // אביזרים
  { id: '\u05e6\u05d9\u05d5\u05d3 \u05dc\u05d5\u05d7\u05dd', label: '\u05e6\u05d9\u05d5\u05d3 \u05dc\u05d5\u05d7\u05dd', icon: '🎒', color: '#1E88E5' }, // ציוד לוחם
  { id: COMBAT_CATEGORY_OTHER, label: COMBAT_CATEGORY_OTHER, icon: '📦', color: '#757575' },
];

const categoryById = new Map<string, CombatCategoryDefinition>(
  COMBAT_CATEGORY_DEFINITIONS.map((category) => [category.id, category])
);

const categoryOrder = new Map<string, number>(
  COMBAT_CATEGORY_DEFINITIONS.map((category, index) => [category.id, index])
);

export const DEFAULT_COMBAT_CATEGORY =
  COMBAT_CATEGORY_DEFINITIONS[0]?.id || COMBAT_CATEGORY_OTHER;

export const UNKNOWN_COMBAT_CATEGORY_CONFIG: CombatCategoryDefinition = {
  id: COMBAT_CATEGORY_OTHER,
  label: COMBAT_CATEGORY_OTHER,
  icon: '📦',
  color: '#757575',
};

export function getCombatCategoryConfig(category: string): CombatCategoryDefinition {
  if (categoryById.has(category)) {
    return categoryById.get(category)!;
  }

  if (!category) {
    return UNKNOWN_COMBAT_CATEGORY_CONFIG;
  }

  return {
    ...UNKNOWN_COMBAT_CATEGORY_CONFIG,
    id: category,
    label: category,
  };
}

export function getCombatCategorySortRank(category: string): number {
  return categoryOrder.has(category) ? categoryOrder.get(category)! : Number.MAX_SAFE_INTEGER;
}

export function getCombatCategoryFilters(existingCategories: string[] = []): string[] {
  const known = COMBAT_CATEGORY_DEFINITIONS.map((category) => category.id);
  const knownSet = new Set(known);
  const extras = Array.from(
    new Set(
      existingCategories
        .filter(Boolean)
        .map((category) => category.trim())
        .filter((category) => category.length > 0 && !knownSet.has(category))
    )
  ).sort((a, b) => a.localeCompare(b, 'he'));

  return [COMBAT_CATEGORY_ALL, ...known, ...extras];
}
