"use strict";
/**
 * Server-side equipment catalog for Cloud Functions.
 * Maps equipment IDs → { name, manualUrl } so gsOnJobUpdated can
 * build gs_jobPrep documents without importing the full client catalog.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupEquipment = lookupEquipment;
exports.buildVideoConfirmations = buildVideoConfirmations;
const BOLD_MANUAL_URL = "https://newageproducts.com/support-hub/bold-series/";
const BOLD_INSTALL_PDF = "https://pdf.lowes.com/productdocuments/c897b0d5-76aa-4d55-9c4a-c718ce1ef8db/12492516.pdf";
/** Gym equipment (Rep, Rogue, generic) */
const GYM_CATALOG = {
    "rep-pr-4000": { name: "PR-4000 Power Rack", manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/60d0c8f88556b07a28847fe2/PR-4000-manual-REP-compressed.pdf" },
    "rep-pr-5000": { name: "PR-5000 Power Rack", manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/61291f406c65aa15b87d5157/PR-5000-manual-compressed.pdf" },
    "rep-ares": { name: "ARES Cable Attachment", manualUrl: "https://www.manualslib.com/manual/3391615/Rep-Ares.html" },
    "rep-ares-2": { name: "ARES 2.0 Cable Attachment", manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/Ares-2.0-Assembly-Instructions%20(1)-compressed.pdf" },
    "rep-athena": { name: "Athena Functional Trainer (FT-3500)", manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-Assembly.pdf" },
    "rep-athena-cable-replace": { name: "Athena Cable Replacement Kit", manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-cableReplacementGuide.pdf" },
    "rep-ft-5000": { name: "FT-5000 Standalone Functional Trainer", manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5ca23c1f0428633d2cf44fc8/Functional-Trainer-Assembly-Instructions-V2.pdf" },
    "rep-ab-3000": { name: "AB-3000 FID Adjustable Bench", manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/605d0d450ad05379b10d0eba/AB-3000-manual-REP.pdf" },
    "rep-ab-5000": { name: "AB-5000 Zero Gap Adjustable Bench", manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5cffc7c32c7d3a493e798a85/AB-5000-Assembly-Instructions.pdf" },
    "rep-fb-5000": { name: "FB-5000 Competition Flat Bench", manualUrl: "https://help.repfitness.com" },
    "rep-sabre-bar": { name: "Sabre Barbell", manualUrl: "" },
    "rep-bumpers": { name: "Rep Bumper Plates (set)", manualUrl: "" },
    "rogue-sml-2": { name: "SML-2 Monster Lite Squat Stand", manualUrl: "https://www.roguefitness.com/theindex/gear-how-tos/how-to-assemble-the-rogue-sml-2-monster-lite-squat-stand" },
    "rogue-rml-490": { name: "RML-490 Power Rack", manualUrl: "https://assets.roguefitness.com/image/upload/v1658760997/catalog/Rigs%20and%20Racks/Power%20Racks%20/Monster%20Lite%20Racks/XX10965/RA0478_CUST_INSTR_vrv4gz.pdf" },
    "rogue-ml-slinger": { name: "Monster Lite Slinger", manualUrl: "https://assets.roguefitness.com/instructions/IS0484/IS0484_CUST_INSTR_V1" },
    "rogue-ml-lat-low-row": { name: "Monster Lite Lat Pulldown + Low Row", manualUrl: "https://assets.roguefitness.com/instructions/IS0535/IS0535_CUST_INSTR_V1" },
    "rogue-adj-bench": { name: "Adjustable Bench 3.0", manualUrl: "https://www.roguefitness.com" },
    "rogue-flat-bench": { name: "Rogue Flat Utility Bench 2.0", manualUrl: "https://www.roguefitness.com" },
    "rogue-ohio-bar": { name: "Ohio Bar", manualUrl: "" },
    "rogue-echo-bumpers": { name: "Echo Bumper Plates (set)", manualUrl: "" },
    "rogue-echo-bike": { name: "Echo Bike", manualUrl: "https://www.roguefitness.com" },
    "gym-stall-mats": { name: "Rubber Stall Mats (4'x6')", manualUrl: "" },
    "gym-platform-diy": { name: "DIY Deadlift/Olympic Platform", manualUrl: "" },
    "gym-wall-storage": { name: "Wall-Mounted Gym Storage", manualUrl: "" },
    "gym-custom": { name: "Custom Equipment", manualUrl: "" },
};
/** Bold Series cabinet sets */
const BOLD_CATALOG = {
    "bold-3pc-wall": { name: "Bold 3-Pc Wall Cabinets", manualUrl: BOLD_MANUAL_URL },
    "bold-6pc-wall": { name: "Bold 6-Pc Wall Cabinets", manualUrl: BOLD_MANUAL_URL },
    "bold-2pc-system": { name: "Bold 2-Piece System", manualUrl: BOLD_INSTALL_PDF },
    "bold-3pc-system": { name: "Bold 3-Piece System", manualUrl: BOLD_INSTALL_PDF },
    "bold-4pc-bamboo": { name: "Bold 4-Pc Bamboo Top", manualUrl: BOLD_INSTALL_PDF },
    "bold-4pc-stainless": { name: "Bold 4-Pc Stainless Top", manualUrl: BOLD_INSTALL_PDF },
    "bold-5pc-bamboo": { name: "Bold 5-Pc Bamboo Top", manualUrl: BOLD_INSTALL_PDF },
    "bold-5pc-stainless": { name: "Bold 5-Pc Stainless Top", manualUrl: BOLD_INSTALL_PDF },
    "bold-6pc-system": { name: "Bold 6-Piece System", manualUrl: BOLD_INSTALL_PDF },
    "bold-7pc-system": { name: "Bold 7-Piece System", manualUrl: BOLD_INSTALL_PDF },
    "bold-7pc-extended": { name: "Bold 7-Piece Extended", manualUrl: BOLD_INSTALL_PDF },
    "bold-8pc-system-a": { name: "Bold 8-Piece System (A)", manualUrl: BOLD_INSTALL_PDF },
    "bold-8pc-system-b": { name: "Bold 8-Piece System (B)", manualUrl: BOLD_INSTALL_PDF },
    "bold-9pc-system": { name: "Bold 9-Piece System", manualUrl: BOLD_INSTALL_PDF },
    "bold-9pc-platinum": { name: "Bold 9-Piece Platinum", manualUrl: BOLD_INSTALL_PDF },
};
/** Shelving */
const SHELVING_CATALOG = {
    "shelf-5tier-48w": { name: "5-Tier Metal Shelving", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/e5/e5018827-ddcc-44f1-81d5-a4570f6639f5.pdf" },
    "shelf-4tier-60w": { name: "4-Tier Metal Shelving", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/e1/e17c7d0e-a791-4932-b411-b595e9d7389a.pdf" },
};
/** Overhead storage */
const OVERHEAD_CATALOG = {
    "overhead-32d": { name: "Overhead Rack 32\"D", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/76/7665bcf1-45a4-4dbc-808a-05ca6c0863ee.pdf" },
    "overhead-48d": { name: "Overhead Rack 48\"D", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/f3/f3b497bf-cbf9-45bd-8900-72e4fd6aa46a.pdf" },
    "overhead-bin-rack": { name: "Six Bin Rack (Ceiling Mounted)", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/a4/a4bd1190-6b56-4bc5-8793-c202383c900d.pdf" },
};
/** Flooring */
const FLOORING_CATALOG = {
    "click-in-1car": { name: "Click-In Flooring (1-Car)", manualUrl: "https://racedeck.com/garage-floor-installation/" },
    "click-in-2car": { name: "Click-In Flooring (2-Car)", manualUrl: "https://racedeck.com/garage-floor-installation/" },
    "click-in-3car": { name: "Click-In Flooring (3-Car)", manualUrl: "https://racedeck.com/garage-floor-installation/" },
    "polyaspartic-1car": { name: "Polyaspartic Coating (1-Car)", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
    "polyaspartic-2car": { name: "Polyaspartic Coating (2-Car)", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
    "polyaspartic-3car": { name: "Polyaspartic Coating (3-Car)", manualUrl: "https://images.thdstatic.com/catalog/pdfImages/02/02338db5-99f7-4abf-bd8c-9d78414c3b73.pdf" },
};
/** Unified lookup — returns { name, manualUrl } or null */
function lookupEquipment(id) {
    return (GYM_CATALOG[id] ??
        BOLD_CATALOG[id] ??
        SHELVING_CATALOG[id] ??
        OVERHEAD_CATALOG[id] ??
        FLOORING_CATALOG[id] ??
        null);
}
/**
 * Build video confirmations array from a job's productSelections.
 * Only includes items that have a manualUrl (i.e. items that need assembly).
 */
function buildVideoConfirmations(productSelections) {
    const confirmations = [];
    const sel = productSelections;
    // Gym equipment
    if (sel.gymEquipment && Array.isArray(sel.gymEquipment)) {
        for (const item of sel.gymEquipment) {
            const entry = GYM_CATALOG[item.id];
            if (entry && entry.manualUrl) {
                confirmations.push({
                    equipmentId: item.id,
                    equipmentName: entry.name,
                    manualUrl: entry.manualUrl,
                    confirmedAt: null,
                });
            }
        }
    }
    // Bold Series
    if (sel.boldSeriesId) {
        const entry = BOLD_CATALOG[sel.boldSeriesId];
        if (entry && entry.manualUrl) {
            confirmations.push({
                equipmentId: sel.boldSeriesId,
                equipmentName: entry.name,
                manualUrl: entry.manualUrl,
                confirmedAt: null,
            });
        }
    }
    // Shelving
    if (sel.standardShelving && Array.isArray(sel.standardShelving)) {
        for (const item of sel.standardShelving) {
            const entry = SHELVING_CATALOG[item.id];
            if (entry && entry.manualUrl) {
                confirmations.push({
                    equipmentId: item.id,
                    equipmentName: entry.name,
                    manualUrl: entry.manualUrl,
                    confirmedAt: null,
                });
            }
        }
    }
    // Overhead
    if (sel.overheadStorage && Array.isArray(sel.overheadStorage)) {
        for (const item of sel.overheadStorage) {
            const entry = OVERHEAD_CATALOG[item.id];
            if (entry && entry.manualUrl) {
                confirmations.push({
                    equipmentId: item.id,
                    equipmentName: entry.name,
                    manualUrl: entry.manualUrl,
                    confirmedAt: null,
                });
            }
        }
    }
    // Flooring
    if (sel.flooringId && sel.flooringId !== "none") {
        const entry = FLOORING_CATALOG[sel.flooringId];
        if (entry && entry.manualUrl) {
            confirmations.push({
                equipmentId: sel.flooringId,
                equipmentName: entry.name,
                manualUrl: entry.manualUrl,
                confirmedAt: null,
            });
        }
    }
    return confirmations;
}
