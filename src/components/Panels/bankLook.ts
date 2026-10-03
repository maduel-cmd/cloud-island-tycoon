/**
 * Resolve Build Bank card ids → existing look stills under public/assets/looks.
 * Does not invent chrome icons or new ride art — only maps to shipped files.
 */
export type BankLookKind = "attraction" | "stall" | "prop" | "staff";

export type BankLookRef = {
  kind: BankLookKind;
  id: string;
};

/**
 * Bank-card art path (transparent punch derived from look stills).
 * Park billboards keep using public/assets/looks — these copies are bank-only.
 */
export function bankLookSrc(kind: BankLookKind, id: string): string {
  const safe = id.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `/assets/ui/bank-looks/${kind}/${safe}.png`;
}

/**
 * Map a build-bank card to a look still.
 * Returns null when no shipped look exists (keep SVG fallback).
 */
export function resolveBankLook(
  cardKind: "attraction" | "stall" | "util",
  cardId: string,
): BankLookRef | null {
  if (cardKind === "attraction") {
    return { kind: "attraction", id: cardId };
  }
  if (cardKind === "stall") {
    return { kind: "stall", id: cardId };
  }

  // utilities / decor / hire
  if (cardId.startsWith("decor:")) {
    const decorId = cardId.slice("decor:".length);
    return { kind: "prop", id: decorId };
  }
  if (cardId === "path" || cardId === "bin" || cardId === "bench" || cardId === "warehouse") {
    return { kind: "prop", id: cardId };
  }
  if (cardId === "hire_janitor") return { kind: "staff", id: "janitor" };
  if (cardId === "hire_runner") return { kind: "staff", id: "runner" };
  if (cardId === "hire_mechanic") return { kind: "staff", id: "mechanic" };
  // parking — no look still shipped
  return null;
}
