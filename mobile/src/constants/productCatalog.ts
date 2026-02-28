// ── Product Catalog (from garage_scholars_pricing_v2.xlsx) ──
// Single source of truth for all product data used in lead conversion.

export type BoldSeriesSet = {
  id: string;
  name: string;
  dims: string;
  model: string;
  retail: number;
  manualUrl?: string;
  productUrl?: string;
};

export type ShelvingItem = {
  id: string;
  name: string;
  dims: string;
  cost: number;
  manualUrl?: string;
  productUrl?: string;
};

export type OverheadItem = {
  id: string;
  name: string;
  dims: string;
  cost: number;
  manualUrl?: string;
  productUrl?: string;
};

export type FlooringOption = {
  id: string;
  name: string;
  price: number;
  manualUrl?: string;
  productUrl?: string;
};

export type GymEquipmentItem = {
  id: string;
  name: string;
  brand: "rep" | "rogue" | "other";
  category: "rack" | "bench" | "barbell" | "plates" | "flooring" | "cable" | "cardio" | "accessory" | "platform" | "other";
  dims: string;
  weight: string;
  manualUrl: string;
  assemblyTime: string;
  crewSize: number;
  tools: string[];
  notes: string;
};

// ── Manufacturer Support Contacts ──
// Scholars can call these directly for equipment-specific assembly questions
// instead of waiting for admin. Saves time on-site.
export const MANUFACTURER_SUPPORT = {
  rep: {
    name: "Rep Fitness",
    phone: "(720) 669-5222",
    hours: "Mon-Fri 8am-5pm MST",
    email: "info@repfitness.com",
    kb: "https://help.repfitness.com",
    note: "Ask for assembly support. Have model number ready (on the box label).",
  },
  rogue: {
    name: "Rogue Fitness",
    phone: "(614) 358-6190",
    hours: "Mon-Fri 8am-7pm EST, Sat 9am-5pm EST",
    email: "salesteam@roguefitness.com",
    kb: "https://www.roguefitness.com/theindex",
    note: "Ask for technical support. Have item number ready (starts with 2-letter prefix).",
  },
  newage: {
    name: "NewAge Products (Bold Series)",
    phone: "(877) 306-8930",
    hours: "Mon-Fri 9am-6pm EST",
    email: "support@newageproducts.com",
    kb: "https://newageproducts.com/support-hub/bold-series/",
    note: "Have the model number from the cabinet label.",
  },
} as const;

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
  gymEquipment: { id: string; qty: number; customName?: string }[];
  gymFlooringType: "none" | "stall-mats" | "click-in" | "polyaspartic";
  gymNotes: string;
};

export const EMPTY_SELECTIONS: ProductSelections = {
  boldSeriesId: "",
  standardShelving: [],
  overheadStorage: [],
  extraHaulAways: 0,
  flooringId: "none",
  extraBinPacks: 0,
  notes: "",
  gymEquipment: [],
  gymFlooringType: "none",
  gymNotes: "",
};

const BOLD_MANUAL_URL = "https://newageproducts.com/support-hub/bold-series/";
const BOLD_INSTALL_PDF = "https://pdf.lowes.com/productdocuments/c897b0d5-76aa-4d55-9c4a-c718ce1ef8db/12492516.pdf";

export const BOLD_SERIES_SETS: BoldSeriesSet[] = [
  { id: "bold-3pc-wall", name: "3-Pc Wall Cabinets", dims: '96"W x 20"H x 12"D', model: "50653", retail: 380, manualUrl: BOLD_MANUAL_URL, productUrl: "https://www.homedepot.com/p/309436139" },
  { id: "bold-6pc-wall", name: "6-Pc Wall Cabinets", dims: '192"W x 19.58"H x 12"D', model: "50659", retail: 600, manualUrl: BOLD_MANUAL_URL, productUrl: "https://www.homedepot.com/p/309439261" },
  { id: "bold-2pc-system", name: "2-Piece System", dims: '104"W x 77"H x 18"D', model: "50500", retail: 1400, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/305712662" },
  { id: "bold-3pc-system", name: "3-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50670", retail: 1280, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/309439274" },
  { id: "bold-4pc-bamboo", name: "4-Pc Bamboo Top", dims: '92"W x 76.75"H x 18"D', model: "73501", retail: 1340, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/335324535" },
  { id: "bold-4pc-stainless", name: "4-Pc Stainless Top", dims: '92"W x 76.75"H x 18"D', model: "73505", retail: 1430, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/335324537" },
  { id: "bold-5pc-bamboo", name: "5-Pc Bamboo Top", dims: '120"W x 76.75"H x 18"D', model: "73509", retail: 1987, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/335324554" },
  { id: "bold-5pc-stainless", name: "5-Pc Stainless Top", dims: '120"W x 76.75"H x 18"D', model: "73513", retail: 2140, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/335324564" },
  { id: "bold-6pc-system", name: "6-Piece System", dims: '144"W x 76.75"H x 18"D', model: "50502", retail: 2150, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/305718295" },
  { id: "bold-7pc-system", name: "7-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50421", retail: 1680, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/304275984" },
  { id: "bold-7pc-extended", name: "7-Piece Extended", dims: '174"W x 77"H x 18"D', model: "50506", retail: 2530, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/305718348" },
  { id: "bold-8pc-system-a", name: "8-Piece System (A)", dims: '132"W x 77"H x 18"D', model: "50405", retail: 1850, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/304275892" },
  { id: "bold-8pc-system-b", name: "8-Piece System (B)", dims: '132"W x 76.75"H x 18"D', model: "50462", retail: 2200, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/304275888" },
  { id: "bold-9pc-system", name: "9-Piece System", dims: '132"W x 77"H x 18"D', model: "50408", retail: 1950, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/304275933" },
  { id: "bold-9pc-platinum", name: "9-Piece Platinum", dims: '132"W x 76.75"H x 18"D', model: "54992", retail: 1950, manualUrl: BOLD_INSTALL_PDF, productUrl: "https://www.homedepot.com/p/313227820" },
];

export const STANDARD_SHELVING: ShelvingItem[] = [
  { id: "shelf-5tier-48w", name: "5-Tier Metal Shelving", dims: '72"H x 48"W x 24"D', cost: 122, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/e5/e5018827-ddcc-44f1-81d5-a4570f6639f5.pdf", productUrl: "https://www.homedepot.com/p/VEIKOUS-5-Tier-Metal-Garage-Storage-Shelving-Unit-Standard-Bookcase-in-Black-72-in-H-x-48-in-W-x-24-in-D-HP1106-03-1/333229150" },
  { id: "shelf-4tier-60w", name: "4-Tier Metal Shelving", dims: '72"H x 60"W x 18"D', cost: 175, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/e1/e17c7d0e-a791-4932-b411-b595e9d7389a.pdf", productUrl: "https://www.homedepot.com/p/VEIKOUS-72-in-Black-Metal-4-Tier-Garage-Storage-Shelving-Bookcases-Unit-with-Adjustable-Shelves-60-in-W-x-18-in-D-HP1106-09-4/319760619" },
];

export const OVERHEAD_STORAGE: OverheadItem[] = [
  { id: "overhead-32d", name: 'Overhead Rack -- 32"D', dims: '97.5"W x 43.75"H x 32"D', cost: 169, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/76/7665bcf1-45a4-4dbc-808a-05ca6c0863ee.pdf", productUrl: "https://www.homedepot.com/p/Husky-97-5-in-W-x-43-75-in-H-x-32-in-D-Adjustable-Height-Metal-Heavy-Duty-Overhead-Garage-Storage-Rack-in-Black-ACR3296B-P/305858888" },
  { id: "overhead-48d", name: 'Overhead Rack -- 48"D', dims: '97.5"W x 43.75"H x 48"D', cost: 219, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/f3/f3b497bf-cbf9-45bd-8900-72e4fd6aa46a.pdf", productUrl: "https://www.homedepot.com/p/Husky-97-5-in-W-x-43-75-in-H-x-48-in-D-Adjustable-Height-Metal-Heavy-Duty-Overhead-Garage-Storage-Rack-in-Black-ACR4896B/303493157" },
  { id: "overhead-bin-rack", name: "Six Bin Rack (Ceiling Mounted)", dims: '3"W x 2"H x 26"D', cost: 168, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/a4/a4bd1190-6b56-4bc5-8793-c202383c900d.pdf", productUrl: "https://www.homedepot.com/p/KOOVA-3-in-W-x-2-in-H-x-26-in-D-Six-Bin-Rack-Adjustable-Height-Garage-Ceiling-Mounted-Storage-Unit-Black-KV-OHB-6/325821503" },
];

export const FLOORING_OPTIONS: FlooringOption[] = [
  { id: "none", name: "None", price: 0 },
  { id: "click-in-1car", name: "Click-In Plate Flooring -- 1-Car (~200 sq ft)", price: 1497, manualUrl: "https://racedeck.com/garage-floor-installation/", productUrl: "https://www.homedepot.com/p/Greatmats-Perforated-Click-12-1-8-in-x-12-1-8-in-Gray-Plastic-Garage-Floor-Tile-25-Pack-PCGT1X1GRY25/308539495" },
  { id: "click-in-2car", name: "Click-In Plate Flooring -- 2-Car (~400 sq ft)", price: 2897, manualUrl: "https://racedeck.com/garage-floor-installation/", productUrl: "https://www.homedepot.com/p/Greatmats-Perforated-Click-12-1-8-in-x-12-1-8-in-Gray-Plastic-Garage-Floor-Tile-25-Pack-PCGT1X1GRY25/308539495" },
  { id: "click-in-3car", name: "Click-In Plate Flooring -- 3-Car (~600 sq ft)", price: 4297, manualUrl: "https://racedeck.com/garage-floor-installation/", productUrl: "https://www.homedepot.com/p/Greatmats-Perforated-Click-12-1-8-in-x-12-1-8-in-Gray-Plastic-Garage-Floor-Tile-25-Pack-PCGT1X1GRY25/308539495" },
  { id: "polyaspartic-1car", name: "Polyaspartic Floor Coating -- 1-Car (~200 sq ft)", price: 0, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
  { id: "polyaspartic-2car", name: "Polyaspartic Floor Coating -- 2-Car (~400 sq ft)", price: 0, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
  { id: "polyaspartic-3car", name: "Polyaspartic Floor Coating -- 3-Car (~600 sq ft)", price: 0, manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
];

// ── Gym Equipment Catalog ──
// Rep Fitness + Rogue recommended models with direct PDF manual links.
// Cable systems (ARES, Athena, Slinger) are critical — scholars need
// step-by-step cable threading and routing instructions.

export const GYM_EQUIPMENT_CATALOG: GymEquipmentItem[] = [
  // ── Rep Fitness — Power Racks ──
  {
    id: "rep-pr-4000",
    name: "PR-4000 Power Rack",
    brand: "rep",
    category: "rack",
    dims: '49"W x 48"D x 86"H',
    weight: "250 lbs",
    manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/60d0c8f88556b07a28847fe2/PR-4000-manual-REP-compressed.pdf",
    assemblyTime: "90-120 min",
    crewSize: 2,
    tools: ["socket wrench set", "Allen wrench set", "level", "rubber mallet"],
    notes: "Assemble uprights flat on ground. Finger-tight all bolts until frame is complete. Level every upright. Floor bolt optional but recommended.",
  },
  {
    id: "rep-pr-5000",
    name: "PR-5000 Power Rack",
    brand: "rep",
    category: "rack",
    dims: '49"W x 48"D x 93"H',
    weight: "300 lbs",
    manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/61291f406c65aa15b87d5157/PR-5000-manual-compressed.pdf",
    assemblyTime: "90-120 min",
    crewSize: 2,
    tools: ["socket wrench set", "Allen wrench set", "level", "rubber mallet"],
    notes: "3x3\" uprights with 1\" Westside hole spacing. Assemble flat, raise together with 3 people. Floor bolt recommended for heavy use.",
  },

  // ── Rep Fitness — Cable Systems (CRITICAL: detailed cable routing) ──
  {
    id: "rep-ares",
    name: "ARES Cable Attachment (for PR-4000/5000)",
    brand: "rep",
    category: "cable",
    dims: "Mounts to 6-post rack",
    weight: "200+ lbs with weight stacks",
    manualUrl: "https://www.manualslib.com/manual/3391615/Rep-Ares.html",
    assemblyTime: "2-3 hours",
    crewSize: 2,
    tools: ["socket wrench set", "Allen wrench set (5mm, 6mm)", "step ladder", "cable routing tool or tape"],
    notes: "MUST be mounted on 6-post PR-4000/5000 config. Cable routing is the hardest part — thread cables through pulleys BEFORE mounting weight stacks. Do NOT fully tighten side plates until cables move freely through full range. Two people required, ladder needed for top pulleys.",
  },
  {
    id: "rep-ares-2",
    name: "ARES 2.0 Cable Attachment (for PR-4000/5000)",
    brand: "rep",
    category: "cable",
    dims: "Mounts to 6-post rack",
    weight: "220+ lbs with weight stacks",
    manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/Ares-2.0-Assembly-Instructions%20(1)-compressed.pdf",
    assemblyTime: "2-3 hours",
    crewSize: 2,
    tools: ["socket wrench set", "Allen wrench set (5mm, 6mm)", "step ladder", "cable routing tool"],
    notes: "Updated cable routing vs ARES v1. Assemble on flat level surface. Cable threading must be done before weight stack installation. Run each cable through full range of motion before loading any weight. Check pulley alignment at every junction.",
  },
  {
    id: "rep-athena",
    name: "Athena Side-Mount Functional Trainer (FT-3500)",
    brand: "rep",
    category: "cable",
    dims: "Side-mounts to PR-4000/5000",
    weight: "300+ lbs per side with stacks",
    manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-Assembly.pdf",
    assemblyTime: "3-4 hours (both sides)",
    crewSize: 3,
    tools: ["socket wrench set", "Allen wrench set", "step ladder", "level", "cable routing tool"],
    notes: "MOST COMPLEX gym install. Each side is independent — assemble one side fully before starting the other. Cable threading requires patience: route cable through every pulley in sequence, verify smooth movement at each step. Weight stacks go on LAST. Wall anchor may be needed if not bolted to rack. Also available as wall-mounted version.",
  },
  {
    id: "rep-athena-cable-replace",
    name: "Athena Cable Replacement Kit",
    brand: "rep",
    category: "cable",
    dims: "N/A",
    weight: "5 lbs",
    manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-cableReplacementGuide.pdf",
    assemblyTime: "45-60 min per cable",
    crewSize: 1,
    tools: ["Allen wrench set", "cable routing tool"],
    notes: "Replacement cable guide for Athena. Photograph the existing cable routing BEFORE removing old cable.",
  },
  {
    id: "rep-ft-5000",
    name: "FT-5000 Standalone Functional Trainer",
    brand: "rep",
    category: "cable",
    dims: '60"W x 45"D x 86"H',
    weight: "500+ lbs",
    manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5ca23c1f0428633d2cf44fc8/Functional-Trainer-Assembly-Instructions-V2.pdf",
    assemblyTime: "2-3 hours",
    crewSize: 3,
    tools: ["6mm Allen wrench", "13mm wrench", "step ladder", "level"],
    notes: "500+ lbs — MINIMUM 3 people. Cables NOT pre-installed. Thread each cable through pulley system carefully. Must be level — adjust feet, check with level on every stack guide. MUST be wall-anchored or floor-bolted — WILL tip if unsecured.",
  },

  // ── Rep Fitness — Benches ──
  {
    id: "rep-ab-3000",
    name: "AB-3000 FID Adjustable Bench",
    brand: "rep",
    category: "bench",
    dims: '57"L x 26"W x 18"H',
    weight: "68 lbs",
    manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/605d0d450ad05379b10d0eba/AB-3000-manual-REP.pdf",
    assemblyTime: "15-30 min",
    crewSize: 1,
    tools: ["Allen wrench set", "socket wrench"],
    notes: "Attach legs/base first, then seat pad, then back pad. Check all adjustment pins lock securely at every angle.",
  },
  {
    id: "rep-ab-5000",
    name: "AB-5000 Zero Gap Adjustable Bench",
    brand: "rep",
    category: "bench",
    dims: '59"L x 26"W x 18"H',
    weight: "90 lbs",
    manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5cffc7c32c7d3a493e798a85/AB-5000-Assembly-Instructions.pdf",
    assemblyTime: "20-30 min",
    crewSize: 1,
    tools: ["Allen wrench set", "socket wrench"],
    notes: "Zero-gap design requires precise seat/back pad alignment. Test every angle position after assembly.",
  },
  {
    id: "rep-fb-5000",
    name: "FB-5000 Competition Flat Bench",
    brand: "rep",
    category: "bench",
    dims: '48"L x 12"W x 17.5"H',
    weight: "64 lbs",
    manualUrl: "https://help.repfitness.com",
    assemblyTime: "10-15 min",
    crewSize: 1,
    tools: ["Allen wrench set"],
    notes: "4-6 bolts total. Level check after assembly — wobble means uneven legs, use rubber feet or shims.",
  },

  // ── Rep Fitness — Bars & Plates ──
  {
    id: "rep-sabre-bar",
    name: "Sabre Barbell",
    brand: "rep",
    category: "barbell",
    dims: '86.6"L, 28.5mm shaft',
    weight: "45 lbs",
    manualUrl: "",
    assemblyTime: "No assembly",
    crewSize: 1,
    tools: [],
    notes: "No assembly. Unbox, inspect for shipping damage, check sleeve spin, hang on J-hooks.",
  },
  {
    id: "rep-bumpers",
    name: "Rep Bumper Plates (set)",
    brand: "rep",
    category: "plates",
    dims: "450mm diameter",
    weight: "Varies by set",
    manualUrl: "",
    assemblyTime: "No assembly",
    crewSize: 1,
    tools: [],
    notes: "No assembly. Sort by weight, store on plate horns — heaviest at bottom. Apply thin coat of 3-in-1 oil to barbell sleeves.",
  },

  // ── Rogue Fitness — Racks ──
  {
    id: "rogue-sml-2",
    name: "SML-2 Monster Lite Squat Stand",
    brand: "rogue",
    category: "rack",
    dims: '49"W x 48"D x 90"H',
    weight: "138 lbs",
    manualUrl: "https://www.roguefitness.com/theindex/gear-how-tos/how-to-assemble-the-rogue-sml-2-monster-lite-squat-stand",
    assemblyTime: "30-45 min",
    crewSize: 2,
    tools: ["3/4\" wrench", "socket wrench", "level"],
    notes: "Assemble each upright independently, connect with cross-member. Level each foot. Wall-mount stabilizer kit recommended if not bolting to floor.",
  },
  {
    id: "rogue-rml-490",
    name: "RML-490 Power Rack",
    brand: "rogue",
    category: "rack",
    dims: '53"W x 53"D x 90"H',
    weight: "335 lbs",
    manualUrl: "https://assets.roguefitness.com/image/upload/v1658760997/catalog/Rigs%20and%20Racks/Power%20Racks%20/Monster%20Lite%20Racks/XX10965/RA0478_CUST_INSTR_vrv4gz.pdf",
    assemblyTime: "90-120 min",
    crewSize: 2,
    tools: ["3/4\" wrench", "9/16\" wrench", "socket wrench set", "level", "rubber mallet"],
    notes: "Monster Lite series. 3x3\" uprights with 5/8\" hardware. Assemble uprights flat, raise together (3 people recommended). Floor bolt with 3/8\" concrete anchors.",
  },

  // ── Rogue Fitness — Cable Systems (CRITICAL) ──
  {
    id: "rogue-ml-slinger",
    name: "Monster Lite Slinger (Rack-Mount Cable)",
    brand: "rogue",
    category: "cable",
    dims: "Mounts to ML rack cross-members",
    weight: "100+ lbs per side",
    manualUrl: "https://assets.roguefitness.com/instructions/IS0484/IS0484_CUST_INSTR_V1",
    assemblyTime: "60-90 min per side",
    crewSize: 2,
    tools: ["3/4\" wrench", "9/16\" wrench", "socket wrench set", "step ladder"],
    notes: "Cable runs on TOP of pulleys in the pulley groove. Insert 3/8\" spacers into side plates with cable on top of pulleys but BELOW all spacers. Secure all 3/8\" hardware first, then all 1\" hardware. Bolt end of cable passes through rubber grommet, then through tube via center 1\" crossmember hole.",
  },
  {
    id: "rogue-ml-lat-low-row",
    name: "Monster Lite Lat Pulldown + Low Row Kit",
    brand: "rogue",
    category: "cable",
    dims: "Mounts to ML rack uprights",
    weight: "80+ lbs",
    manualUrl: "https://assets.roguefitness.com/instructions/IS0535/IS0535_CUST_INSTR_V1",
    assemblyTime: "45-60 min",
    crewSize: 2,
    tools: ["3/4\" wrench", "socket wrench set", "5/8\" detent pins"],
    notes: "Attach seat to upright using 5/8\" x 5\" detent pins at 4th and 6th holes from ground. Cable assembly connects to Slinger setup. Can be quickly disconnected when not in use.",
  },

  // ── Rogue Fitness — Benches ──
  {
    id: "rogue-adj-bench",
    name: "Adjustable Bench 3.0",
    brand: "rogue",
    category: "bench",
    dims: '56"L x 24"W x 18"H',
    weight: "128 lbs",
    manualUrl: "https://www.roguefitness.com",
    assemblyTime: "15-30 min",
    crewSize: 1,
    tools: ["socket wrench set"],
    notes: "Heavy bench — 128 lbs. Attach legs first, then pads. Test every angle position for secure lockout.",
  },
  {
    id: "rogue-flat-bench",
    name: "Rogue Flat Utility Bench 2.0",
    brand: "rogue",
    category: "bench",
    dims: '48"L x 12"W x 17"H',
    weight: "65 lbs",
    manualUrl: "https://www.roguefitness.com",
    assemblyTime: "10-15 min",
    crewSize: 1,
    tools: ["socket wrench set"],
    notes: "Simple assembly: 4-6 bolts. Level check after — wobble means uneven legs.",
  },

  // ── Rogue Fitness — Bars, Plates & Cardio ──
  {
    id: "rogue-ohio-bar",
    name: "Ohio Bar",
    brand: "rogue",
    category: "barbell",
    dims: '86.75"L, 28.5mm shaft',
    weight: "45 lbs",
    manualUrl: "",
    assemblyTime: "No assembly",
    crewSize: 1,
    tools: [],
    notes: "No assembly. Unbox, inspect, check sleeve spin, apply 3-in-1 oil.",
  },
  {
    id: "rogue-echo-bumpers",
    name: "Echo Bumper Plates (set)",
    brand: "rogue",
    category: "plates",
    dims: "450mm diameter",
    weight: "Varies by set",
    manualUrl: "",
    assemblyTime: "No assembly",
    crewSize: 1,
    tools: [],
    notes: "No assembly. Sort by weight on plate horns, heaviest at bottom.",
  },
  {
    id: "rogue-echo-bike",
    name: "Echo Bike",
    brand: "rogue",
    category: "cardio",
    dims: '58.9"L x 29.9"W x 50.4"H',
    weight: "127 lbs",
    manualUrl: "https://www.roguefitness.com",
    assemblyTime: "30-45 min",
    crewSize: 1,
    tools: ["socket wrench set", "Allen wrench set", "adjustable wrench"],
    notes: "Heavy at 127 lbs. Attach base, handlebars, seat, wind guard, console. Level on garage floor.",
  },

  // ── General / Brand-Agnostic ──
  {
    id: "gym-stall-mats",
    name: 'Rubber Stall Mats (4\'x6\' x 3/4")',
    brand: "other",
    category: "flooring",
    dims: "4' x 6' x 3/4\" each",
    weight: "~100 lbs each",
    manualUrl: "",
    assemblyTime: "15-20 min per mat",
    crewSize: 2,
    tools: ["utility knife", "straight edge", "tape measure"],
    notes: "Flat side UP. Start from back wall toward garage door. 1/4\" gap at walls for expansion. Cut with fresh utility blade (multiple passes). No adhesive needed on concrete. Strong odor 1-2 weeks — advise client to ventilate.",
  },
  {
    id: "gym-platform-diy",
    name: "DIY Deadlift/Olympic Platform",
    brand: "other",
    category: "platform",
    dims: "8' x 4' when complete",
    weight: "~150 lbs",
    manualUrl: "",
    assemblyTime: "45-60 min",
    crewSize: 2,
    tools: ["drill", "wood screws", "wood glue", "jigsaw or circular saw", "tape measure", "pencil"],
    notes: "Materials: 2 sheets 4x8 plywood (3/4\"), 1 sheet 4x8 rubber (3/4\"). Bottom: full plywood. Middle: plywood center (4'x4'), rubber sides (2'x4' each). Top: plywood center only, rubber sides flush. Screw every 12\", wood glue between layers.",
  },
  {
    id: "gym-wall-storage",
    name: "Wall-Mounted Gym Storage (hooks, bar holders, band pegs)",
    brand: "other",
    category: "accessory",
    dims: "Varies",
    weight: "Varies",
    manualUrl: "",
    assemblyTime: "30-45 min",
    crewSize: 1,
    tools: ["stud finder", "drill", "3/8\" x 3\" lag bolts", "level", "tape measure", "pencil"],
    notes: "Bar holders: lag bolt into studs at 54\" height. Plate storage: into studs only, NEVER drywall anchors. Band pegs: 3/8\" x 3\" lag bolts at 3 heights (low/mid/high).",
  },
  {
    id: "gym-custom",
    name: "Custom Equipment (customer-supplied)",
    brand: "other",
    category: "other",
    dims: "Varies",
    weight: "Varies",
    manualUrl: "",
    assemblyTime: "Varies",
    crewSize: 1,
    tools: [],
    notes: "Customer-supplied equipment. Ask customer for included manual. Check ManualsLib.com if manual is missing. Photograph all parts before starting assembly.",
  },
];

// Group constants for UI category filters
export const GYM_EQUIPMENT_CATEGORIES = [
  { value: "rack", label: "Power Racks & Stands" },
  { value: "cable", label: "Cable Systems & Attachments" },
  { value: "bench", label: "Benches" },
  { value: "barbell", label: "Barbells" },
  { value: "plates", label: "Plates" },
  { value: "cardio", label: "Cardio" },
  { value: "flooring", label: "Gym Flooring" },
  { value: "platform", label: "Platforms" },
  { value: "accessory", label: "Accessories & Storage" },
  { value: "other", label: "Other / Custom" },
] as const;

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
