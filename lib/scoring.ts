const LOW_WEIGHT = new Set(["salt","pepper","oil","water","flour","sugar","butter","vinegar","soy sauce"]);

export function computeMatchScore(detected: Set<string>, recipeIngredients: string[]): number {
  const rec = recipeIngredients.map(s => s.toLowerCase());
  const union = new Set([...rec, ...detected]);
  let inter = 0, uni = 0;
  for (const i of union) {
    const w = LOW_WEIGHT.has(i) ? 0.25 : 1;
    uni += w;
    if (detected.has(i) && rec.includes(i)) inter += w;
  }
  const raw = uni ? inter / uni : 0;
  return Math.max(1, Math.min(10, Math.round(1 + 9 * raw)));
}
