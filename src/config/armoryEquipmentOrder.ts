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
    .replace(/[-\u05BE]/g, '')
    .replace(/\s+/g, '');
}

const PRIORITY_ORDER_INDEX = new Map(
  ARMORY_PRIORITY_EQUIPMENT_ORDER.map((name, index) => [normalizeEquipmentName(name), index])
);

export function sortByArmoryEquipmentPriority<T extends { equipmentName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aRank = PRIORITY_ORDER_INDEX.get(normalizeEquipmentName(a.equipmentName));
    const bRank = PRIORITY_ORDER_INDEX.get(normalizeEquipmentName(b.equipmentName));
    const aHasPriority = aRank !== undefined;
    const bHasPriority = bRank !== undefined;

    if (aHasPriority && bHasPriority) return (aRank as number) - (bRank as number);
    if (aHasPriority) return -1;
    if (bHasPriority) return 1;

    return a.equipmentName.localeCompare(b.equipmentName, 'he');
  });
}
