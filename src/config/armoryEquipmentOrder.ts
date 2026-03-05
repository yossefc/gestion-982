export const ARMORY_PRIORITY_EQUIPMENT_ORDER = [
  'רוס"ק M-16',
  'מטול M-203',
  'קלע A-3',
  'טלסקופ טריגיקון',
  'אקילע X4',
  'אמרל עכבר',
  'משקפת 8X30',
  'משקפת 7X50',
  'מצפן',
  'רינגו M-203',
  'מטול עצמאי',
  'מקלע מאג',
  'רוס"ר M-16',
];

function normalizeEquipmentName(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/["'`\u05F3\u05F4]/g, '')
    .replace(/[-\u05BE/_.,*]/g, '')
    .replace(/\s+/g, '');
}

const PRIORITY_ORDER_INDEX = new Map(
  ARMORY_PRIORITY_EQUIPMENT_ORDER.map((name, index) => [normalizeEquipmentName(name), index])
);

// Each rank can match by exact name OR by one of these keyword sets.
// A keyword set matches when ALL keywords are found in the normalized equipment name.
const PRIORITY_MATCH_RULES: Array<Array<string[]>> = [
  [['רוסק', 'm16']],
  [['מטול', 'm203'], ['מטול', '203']],
  [['קלע', 'a3']],
  [['טלסקופ', 'טריגיקון'], ['טלסקופ', 'trijicon']],
  [['אקילע', 'x4'], ['אקילה', 'x4'], ['אקלע', 'x4'], ['אקיל', 'x4']],
  [['אמרל', 'עכבר']],
  [['משקפת', '8x30'], ['משקפת', '830']],
  [['משקפת', '7x50'], ['משקפת', '750']],
  [['מצפן']],
  [['רינגו', 'm203'], ['רינגו', '203']],
  [['מטול', 'עצמאי']],
  [['מקלע', 'מאג'], ['מאג']],
  [['רוסר', 'm16']],
];

function getPriorityRank(equipmentName: string): number | undefined {
  const normalizedName = normalizeEquipmentName(equipmentName);
  const exactRank = PRIORITY_ORDER_INDEX.get(normalizedName);
  if (exactRank !== undefined) return exactRank;

  for (let rank = 0; rank < PRIORITY_MATCH_RULES.length; rank += 1) {
    const ruleAlternatives = PRIORITY_MATCH_RULES[rank];
    const matchesRule = ruleAlternatives.some((keywordSet) =>
      keywordSet.every((keyword) => normalizedName.includes(normalizeEquipmentName(keyword)))
    );
    if (matchesRule) return rank;
  }

  return undefined;
}

export function sortByArmoryEquipmentPriority<T extends { equipmentName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aRank = getPriorityRank(a.equipmentName);
    const bRank = getPriorityRank(b.equipmentName);
    const aHasPriority = aRank !== undefined;
    const bHasPriority = bRank !== undefined;

    if (aHasPriority && bHasPriority) return (aRank as number) - (bRank as number);
    if (aHasPriority) return -1;
    if (bHasPriority) return 1;

    return a.equipmentName.localeCompare(b.equipmentName, 'he');
  });
}
