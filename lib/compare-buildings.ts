const STORAGE_KEY = "spill_compare_buildings";
const MAX_COMPARE = 3;

export type CompareEntry = {
  id: string;
  name: string;
  address: string | null;
};

export function loadCompareList(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompareEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function saveCompareList(entries: CompareEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_COMPARE)));
}

export function addToCompare(entry: CompareEntry): CompareEntry[] {
  const list = loadCompareList().filter((e) => e.id !== entry.id);
  list.push(entry);
  const trimmed = list.slice(-MAX_COMPARE);
  saveCompareList(trimmed);
  return trimmed;
}

export function removeFromCompare(id: string): CompareEntry[] {
  const list = loadCompareList().filter((e) => e.id !== id);
  saveCompareList(list);
  return list;
}

export function isInCompare(id: string): boolean {
  return loadCompareList().some((e) => e.id === id);
}

export const MAX_COMPARE_BUILDINGS = MAX_COMPARE;
