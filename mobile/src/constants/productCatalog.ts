// ── Product Catalog (from garage_scholars_pricing_v2.xlsx) ──
// Single source of truth for all product data used in lead conversion.

export type BoldSeriesSet = {
  id: string;
  name: string;
  dims: string;
  model: string;
  retail: number;
};

export type ShelvingItem = {
  id: string;
  name: string;
  dims: string;
  cost: number;
};

export type OverheadItem = {
  id: string;
  name: string;
  dims: string;
  cost: number;
};

export type FlooringOption = {
  id: string;
  name: string;
  price: number;
};

export type PackageDefault = {
  clientPrice: number;
  scholarPayout: number;
  estimatedHours: number;
};

export type ProductSelections = {
  boldSeriesId: string;
  standardShelving: { id: string; qty: number }[];
  overheadStorage: { id: string; qty: number }[];
  extraHaulAways: number;
  flooringId: string;
  extraBinPacks: number;
  notes: string;
};

export const EMPTY_SELECTIONS: ProductSelections = {
  boldSeriesId: "",
  standardShelving: [],
  overheadStorage: [],
  extraHaulAways: 0,
  flooringId: "none",
  extraBinPacks: 0,
  notes: "",
};

export const BOLD_SERIES_SETS: BoldSeriesSet[] = [
  { id: "bold-3pc-wall", name: "3-Pc Wall Cabinets", dims: '96"W x 20"H x 12"D', model: "50653", retail: 380 },
  { id: "bold-6pc-wall", name: "6-Pc Wall Cabinets", dims: '192"W x 19.58"H x 12"D', model: "50659", retail: 600 },
  { id: "bold-2pc-system", name: "2-Piece System", dims: '104"W x 77"H x 18"D', model: "50500", retail: 1400 },
  { id: "bold-3pc-system", name: "3-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50670", retail: 1280 },
  { id: "bold-4pc-bamboo", name: "4-Pc Bamboo Top", dims: '92"W x 76.75"H x 18"D', model: "73501", retail: 1340 },
  { id: "bold-4pc-stainless", name: "4-Pc Stainless Top", dims: '92"W x 76.75"H x 18"D', model: "73505", retail: 1430 },
  { id: "bold-5pc-bamboo", name: "5-Pc Bamboo Top", dims: '120"W x 76.75"H x 18"D', model: "73509", retail: 1987 },
  { id: "bold-5pc-stainless", name: "5-Pc Stainless Top", dims: '120"W x 76.75"H x 18"D', model: "73513", retail: 2140 },
  { id: "bold-6pc-system", name: "6-Piece System", dims: '144"W x 76.75"H x 18"D', model: "50502", retail: 2150 },
  { id: "bold-7pc-system", name: "7-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50421", retail: 1680 },
  { id: "bold-7pc-extended", name: "7-Piece Extended", dims: '174"W x 77"H x 18"D', model: "50506", retail: 2530 },
  { id: "bold-8pc-system-a", name: "8-Piece System (A)", dims: '132"W x 77"H x 18"D', model: "50405", retail: 1850 },
  { id: "bold-8pc-system-b", name: "8-Piece System (B)", dims: '132"W x 76.75"H x 18"D', model: "50462", retail: 2200 },
  { id: "bold-9pc-system", name: "9-Piece System", dims: '132"W x 77"H x 18"D', model: "50408", retail: 1950 },
  { id: "bold-9pc-platinum", name: "9-Piece Platinum", dims: '132"W x 76.75"H x 18"D', model: "54992", retail: 1950 },
];

export const STANDARD_SHELVING: ShelvingItem[] = [
  { id: "shelf-5tier-48w", name: "5-Tier Metal Shelving", dims: '72"H x 48"W x 24"D', cost: 122 },
  { id: "shelf-4tier-60w", name: "4-Tier Metal Shelving", dims: '72"H x 60"W x 18"D', cost: 175 },
];

export const OVERHEAD_STORAGE: OverheadItem[] = [
  { id: "overhead-32d", name: 'Overhead Rack -- 32"D', dims: '97.5"W x 43.75"H x 32"D', cost: 169 },
  { id: "overhead-48d", name: 'Overhead Rack -- 48"D', dims: '97.5"W x 43.75"H x 48"D', cost: 219 },
  { id: "overhead-bin-rack", name: "Six Bin Rack (Ceiling Mounted)", dims: '3"W x 2"H x 26"D', cost: 168 },
];

export const FLOORING_OPTIONS: FlooringOption[] = [
  { id: "none", name: "None", price: 0 },
  { id: "click-in-1car", name: "Click-In Plate Flooring -- 1-Car (~200 sq ft)", price: 1497 },
  { id: "click-in-2car", name: "Click-In Plate Flooring -- 2-Car (~400 sq ft)", price: 2897 },
  { id: "click-in-3car", name: "Click-In Plate Flooring -- 3-Car (~600 sq ft)", price: 4297 },
  { id: "polyaspartic-1car", name: "Polyaspartic Floor Coating -- 1-Car (~200 sq ft)", price: 0 },
  { id: "polyaspartic-2car", name: "Polyaspartic Floor Coating -- 2-Car (~400 sq ft)", price: 0 },
  { id: "polyaspartic-3car", name: "Polyaspartic Floor Coating -- 3-Car (~600 sq ft)", price: 0 },
];

export const PACKAGE_DEFAULTS: Record<string, PackageDefault> = {
  undergraduate: { clientPrice: 1197, scholarPayout: 350, estimatedHours: 5 },
  graduate:      { clientPrice: 2197, scholarPayout: 600, estimatedHours: 7 },
  doctorate:     { clientPrice: 3797, scholarPayout: 875, estimatedHours: 8 },
};

export const PACKAGE_DESCRIPTIONS: Record<string, string> = {
  undergraduate: "The Undergrad ($1,197) -- Surface Reset & De-Clutter. 2 Scholars, 4-5 hours. Up to 1 truck bed haul-away. Broad sorting (Keep/Donate/Trash). 1 zone / 1 shelf included. Sweep & blow clean.",
  graduate: "The Graduate ($2,197) -- Full Organization Logic & Install. 2 Scholars, 6-8 hours. Up to 1 truck bed haul-away. Micro-sorting (Sports/Tools/Holiday). $300 credit towards storage & shelving. 8 standard bins included. Deep degrease & floor powerwash.",
  doctorate: "The Doctorate ($3,797) -- White-Glove Detail. 3 Scholars, 1 full day. Up to 2 truck bed haul-away. $500 credit towards storage & shelving. 16 premium bins included. Deep degrease & floor powerwash. Seasonal swap (1 return visit).",
};

export const PACKAGE_LABELS: Record<string, string> = {
  undergraduate: "Undergraduate",
  graduate: "Graduate",
  doctorate: "Doctorate",
  warmup: "Warm Up",
  superset: "Super Set",
  "1repmax": "1 Rep Max",
  "deans-list": "The Dean's List",
  valedictorian: "The Valedictorian",
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  "get-clean": "Get Clean",
  "get-organized": "Get Organized",
  "get-strong": "Get Strong",
  resale: "Resale Concierge",
  cleaning: "Garage Cleaning",
  organization: "Organization",
  gym: "Gym Setup",
  full: "Full Transformation",
};
