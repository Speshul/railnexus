// Journey-time bands for the explore map. Colours run green (near) to red (far); the legend and list always say the time too.
export const BUCKETS = [
  { max: 3 * 60, color: "#15803d", key: "explore.b0" },
  { max: 6 * 60, color: "#65a30d", key: "explore.b1" },
  { max: 12 * 60, color: "#ca8a04", key: "explore.b2" },
  { max: 24 * 60, color: "#ea580c", key: "explore.b3" },
  { max: Infinity, color: "#b91c1c", key: "explore.b4" },
] as const;

// Filter settings shared by the page (reads them from the URL) and the client view.
export const BUDGETS = [0, 300, 500, 750, 1000, 1500, 2000, 3000, 5000]; // 0 = any
export const SIZES = { all: 0, medium: 20, major: 50 } as const;
export type Size = keyof typeof SIZES;
export type Sort = "popular" | "fastest" | "cheapest";
export type ExploreFilters = { hours: number; budget: number; night: boolean; size: Size; sort: Sort };

export const bucketOf = (minutes: number) => BUCKETS.findIndex((b) => minutes <= b.max);
