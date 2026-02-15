// ── SOP Parsing Utilities ──
// Extracted from AdminLeads for reuse across mobile and web.

import {
  BOLD_SERIES_SETS,
  STANDARD_SHELVING,
  OVERHEAD_STORAGE,
  FLOORING_OPTIONS,
  type ProductSelections,
} from "../constants/productCatalog";

export type ChecklistEntry = {
  id: string;
  text: string;
  isCompleted: boolean;
  status: "pending" | "approved";
};

export type SopSection = {
  title: string;
  body: string;
};

/**
 * Extract numbered items from the "## 3. PHASE SEQUENCE" section of a SOP
 * and return them as a checklist array.
 *
 * Lines matching /^\d+\.\s/ inside the phase-sequence block become items.
 */
export function parsePhaseSequenceToChecklist(sopText: string): ChecklistEntry[] {
  const phaseMatch = sopText.match(/## 3\. PHASE SEQUENCE[\s\S]*?(?=## \d|$)/i);
  if (!phaseMatch) return [];

  const lines = phaseMatch[0]
    .split("\n")
    .filter((l) => /^\d+\.\s/.test(l.trim()));

  return lines.map((line, i) => ({
    id: `sop-phase-${i + 1}`,
    text: line.replace(/^\d+\.\s*/, "").trim(),
    isCompleted: false,
    status: "approved" as const,
  }));
}

/**
 * Split SOP markdown text into sections at `## N.` headers.
 * Returns an array of { title, body } pairs.
 */
export function parseSopSections(text: string): SopSection[] {
  const parts = text.split(/^(## \d+\..+)$/m);
  const sections: SopSection[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    sections.push({
      title: parts[i].replace(/^## /, "").trim(),
      body: (parts[i + 1] || "").trim(),
    });
  }

  return sections;
}

/**
 * Serialize structured product selections into human-readable strings
 * suitable for storage in Firestore and for SOP prompt context.
 *
 * Credit logic:
 *  - Doctorate: $500 credit toward Bold Series
 *  - Graduate:  $300 credit toward Bold Series
 *  - Undergraduate: $0 credit
 */
export function serializeSelections(
  sel: ProductSelections,
  packageTier: string,
): { shelvingSelections: string; addOns: string } {
  const parts: string[] = [];

  // Bold Series
  const bold = BOLD_SERIES_SETS.find((b) => b.id === sel.boldSeriesId);
  if (bold) {
    const credit = packageTier === "doctorate" ? 500 : packageTier === "graduate" ? 300 : 0;
    const clientPays = Math.max(0, bold.retail - credit);
    parts.push(
      `Bold Series ${bold.name} (${bold.dims}) -- Retail $${bold.retail}${
        credit > 0 ? `, client pays $${clientPays} after $${credit} credit` : ""
      }`,
    );
  }

  // Standard shelving
  sel.standardShelving.forEach((s) => {
    const item = STANDARD_SHELVING.find((x) => x.id === s.id);
    if (item) parts.push(`${s.qty}x ${item.name} (${item.dims})`);
  });

  // Overhead storage
  sel.overheadStorage.forEach((s) => {
    const item = OVERHEAD_STORAGE.find((x) => x.id === s.id);
    if (item) parts.push(`${s.qty}x ${item.name} (${item.dims})`);
  });

  const shelvingSelections = parts.length > 0 ? parts.join(" | ") : "None selected";

  // Add-ons
  const addOnParts: string[] = [];

  if (sel.extraHaulAways > 0) {
    addOnParts.push(`${sel.extraHaulAways}x Extra Haul-Away ($${sel.extraHaulAways * 300})`);
  }

  const flooring = FLOORING_OPTIONS.find((f) => f.id === sel.flooringId);
  if (flooring && flooring.id !== "none") {
    addOnParts.push(
      flooring.price > 0
        ? `${flooring.name} ($${flooring.price})`
        : `${flooring.name} (Price TBD)`,
    );
  }

  if (sel.extraBinPacks > 0) {
    addOnParts.push(`${sel.extraBinPacks}x Extra Bin Pack (8 bins each)`);
  }

  if (sel.notes.trim()) {
    addOnParts.push(`Notes: ${sel.notes.trim()}`);
  }

  const addOns = addOnParts.length > 0 ? addOnParts.join(" | ") : "None selected";

  return { shelvingSelections, addOns };
}
