export type ProfilePrefs = {
  vegetarian?: boolean;
  vegan?: boolean;
  allergens?: string[];
  dislikedIngredients?: string[];
  defaultSort?: "match"|"health"|"time";
};

const LS = {
  profile: "ff.prefs.profile",
  lastFilters: "ff.prefs.filters.lastUsed",
  saved: "ff.recipes.saved",
  cooked: "ff.recipes.cooked",
  feedback: "ff.recipes.feedback"
};

export function getProfile(): ProfilePrefs {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS.profile) || "{}") } catch { return {} }
}
export function setProfile(p: ProfilePrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.profile, JSON.stringify(p));
}

export function getLastFilters(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS.lastFilters) || "{}") } catch { return {} }
}
export function setLastFilters(f: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.lastFilters, JSON.stringify(f));
}

export type SavedEntry = { id: string; name: string; at: number; };
export function getSaved(): SavedEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS.saved) || "[]") } catch { return [] }
}
export function setSaved(list: SavedEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.saved, JSON.stringify(list.slice(-200)));
}

export type CookedEntry = { id: string; name: string; at: number; };
export function getCooked(): CookedEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS.cooked) || "[]") } catch { return [] }
}
export function setCooked(list: CookedEntry[]) {
  if (typeof window === "undefined") return;
  const ninetyDays = Date.now() - 90*24*60*60*1000;
  const pruned = list.filter(x => x.at >= ninetyDays).slice(-200);
  localStorage.setItem(LS.cooked, JSON.stringify(pruned));
}

export type FeedbackMap = Record<string, "like"|"dislike">;
export function getFeedback(): FeedbackMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS.feedback) || "{}") } catch { return {} }
}
export function setFeedback(m: FeedbackMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.feedback, JSON.stringify(m));
}
