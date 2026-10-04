// Shared types for the Baseline UI (moved out of BaselineApp.tsx unchanged).

export type Offer = {
  id: string;
  modelKey: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  previousPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  gripSizes: string[];
  lastChecked: string;
  condition?: string;
  currency?: "CAD" | "USD";
  specs?: RacquetSpec | null;
  sourceState?: "fresh" | "stale";
};

export type StringOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  type: StringType;
  gauges: string[];
  format: StringFormat;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

export type AccessoryOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  category: AccessoryCategory;
  detail: string;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

export type BallOffer = {
  id: string;
  store: string;
  title: string;
  url: string;
  currentPrice: number | null;
  compareAtPrice: number | null;
  inStock: boolean;
  brand: string;
  type: BallType;
  package: string;
  lastChecked: string;
  sourceState?: "fresh" | "stale";
};

export type Dashboard = {
  publicPreview?: boolean;
  offers: Offer[];
  saleOffers: Offer[];
  specialOffers?: Offer[];
  stringOffers?: StringOffer[];
  stringSourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  accessoryOffers?: AccessoryOffer[];
  accessorySourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  ballOffers?: BallOffer[];
  ballSourceResults?: Array<{ store: string; ok: boolean; offers: number; durationMs?: number; error?: string | null }>;
  usedOffers: Offer[];
  targets: Record<string, number>;
  usedTargets: Record<string, number>;
  lastCheck: null | { checkedAt: string; storesChecked: number; offersFound: number; failures: number };
  dropsLast24Hours: number;
  history: Array<{ modelKey: string; price: number; checkedAt: string }>;
  modelNames: Record<string, string>;
  modelOptions: Array<{ key: string; name: string; topRated: boolean; releaseStatus?: "new" | "preorder" | "catalogue"; releaseLabel?: string | null }>;
  modelOrder: string[];
  brandPicks: Record<Exclude<BrandKey, "all">, string[]>;
  stores: string[];
  retailers: Array<{ key: string; name: string; enabled: boolean; kind: string; url: string }>;
  gripSize: GripSize;
  racquetSpecs?: Record<string, RacquetSpec>;
  specValidation?: Record<string, SpecValidation>;
  usedSourceResults?: Array<{ source: string; ok: boolean; offers: number; durationMs?: number; error?: string | null; configured?: boolean }>;
  sourceHealth?: { liveSources: number; totalSources: number; failures: number; freshOffers: number; staleOffers: number; averageDurationMs: number };
  modelRefresh?: null | { status: "running" | "complete" | "failed"; startedAt: string; checkedAt: string | null; scanned: number; verified: number; images: number };
  modelSelectionRefreshes?: Record<string, { ok: boolean; checkedAt: string; fields: number; image: boolean; retailerSources: number; error: string | null }>;
};

export type MarketTab = "retail" | "used";

export type GripSize = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export type BrandKey = "all" | "Wilson" | "Yonex" | "Babolat" | "Head" | "Tecnifibre" | "Dunlop" | "Prince" | "Volkl";

export type BrandViewKey = BrandKey | "catalogue" | "special" | "strings" | "balls" | "accessories" | "guide" | "string-guide";

export type HeadSizeFilter = string;

export type WeightFilter = "all" | "light" | "medium" | "standard" | "heavy";

export type PatternFilter = "all" | "16x19" | "16x20" | "18x20" | "other";

export type CatalogueSort = "featured" | "name-asc" | "name-desc" | "head-asc" | "head-desc" | "weight-asc" | "weight-desc" | "stiffness-asc" | "stiffness-desc" | "price-asc" | "price-desc" | "availability" | "discount" | "tour-presence" | "style-distinctive" | "style-understated";

export type CatalogueMetric = { price: number; retailers: number; discount: number; tourPresence: number };

export type StringType = "Polyester" | "Multifilament" | "Synthetic gut" | "Natural gut" | "Hybrid" | "Monofilament" | "Other";

export type StringTypeFilter = "all" | StringType;

export type StringFormat = "Reel" | "Set" | "Half set" | "Single package";

export type StringFormatFilter = "all" | StringFormat;

export type AccessoryCategory = "Replacement grips" | "Overgrips" | "Grommets & bumpers" | "Dampeners" | "Racquet bags" | "Customization" | "Racquet care";

export type AccessoryCategoryFilter = "all" | AccessoryCategory;

export type AccessorySort = "featured" | "price-asc" | "price-desc" | "discount";

export type BallType = "Extra duty" | "Regular duty" | "All court" | "Clay court" | "Pressureless" | "Junior" | "Other";

export type BallTypeFilter = "all" | BallType;

export type BallSort = "featured" | "price-asc" | "price-desc" | "discount";

export type PublicPreferences = {
  gripSize?: GripSize;
  modelOrder?: string[];
  targets?: Record<string, number>;
  usedTargets?: Record<string, number>;
};

export type AnalyticsSummary = {
  startedAt: string;
  windowDays: number;
  totals: { pageViews: number; dealOpens: number; retailerOpens: number; comparisons: number; coachOpens: number; usedMarket: number };
  daily: Array<{ date: string; pageViews: number; dealOpens: number }>;
  sections: Array<{ section: string; count: number }>;
  operations: { freshOffers: number; liveSources: number; totalSources: number; dropsLast24Hours: number; lastChecked: string | null };
};

export type UsedSort = "watchlist" | "price-asc" | "listings-desc" | "name-asc";

export type UsedAvailability = "all" | "live" | "empty";

export type OpportunityMode = "target" | "availability" | "tour";

export type SpecialGripFilter = "all" | GripSize | "multiple";

export type SpecialAvailabilityFilter = "all" | "multi";

export type SpecialSort = "edition" | "name-asc" | "price-asc" | "price-desc" | "retailers-desc";

export type RacquetSpec = {
  head?: string;
  weight?: string;
  strungWeight?: string;
  balance?: string;
  strungBalance?: string;
  swingweight?: string;
  pattern?: string;
  beam?: string;
  length?: string;
  stiffness?: string;
  composition?: string;
  tension?: string;
  productCode?: string;
  imageUrl?: string;
  gripSizes?: string;
  color?: string;
  madeIn?: string;
  recommendedStrings?: string;
  notablePlayer?: string;
  profile?: string;
  source?: string;
  sourceUrl?: string;
};

export type SpecValidation = {
  status: "confirmed" | "conflict" | "retailer-consensus" | "insufficient";
  sources: Array<{ store: string; url: string }>;
  confirmedFields: number;
  conflictFields: number;
  consensusFields: number;
  fieldChecks: Record<string, { status: "confirmed" | "conflict" | "retailer-consensus"; official: string | null; consensus: string; retailers: string[] }>;
  consensus: RacquetSpec;
};

export type UsedMarketplace = {
  key: string;
  name: string;
  note: string;
  buildUrl: (query: string) => string;
};

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type SpecialEditionGroup = {
  key: string;
  modelKey: string;
  edition: string;
  title: string;
  offers: Offer[];
  grips: string[];
  bestOffer: Offer;
};

export type StringGroup = {
  key: string;
  title: string;
  brand: string;
  type: StringType;
  format: StringFormat;
  gauges: string[];
  offers: StringOffer[];
  bestOffer: StringOffer;
};

export type AccessoryGroup = {
  key: string;
  title: string;
  brand: string;
  category: AccessoryCategory;
  detail: string;
  offers: AccessoryOffer[];
  bestOffer: AccessoryOffer;
};

export type BallGroup = {
  key: string;
  title: string;
  brand: string;
  type: BallType;
  package: string;
  offers: BallOffer[];
  bestOffer: BallOffer;
};
