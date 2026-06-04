import type { Complex } from "@/lib/complexes";
import { hasValidMapCoordinates } from "@/lib/map-bounds";

export function filterValidMapComplexes(complexes: Complex[]): Complex[] {
  return complexes.filter(hasValidMapCoordinates);
}
