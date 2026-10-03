import { useEffect, useMemo, useState } from "react";
import { ATTRACTIONS } from "../../data/attractions";
import { STALLS, stallBuildCost } from "../../data/stalls";
import { DECOR } from "../../data/decor";
import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";
import { IsoThumb, type ThumbShape } from "./IsoThumb";
import { resolveBankLook, type BankLookRef } from "./bankLook";
import {
  attractionDisplayName,
  stallDisplayName,
  decorDisplayName,
  utilDisplayName,
} from "../../i18n/names";
import { GAME_STATIC_ASSETS } from "../../config/assets";

type BankTab = "thrill" | "family" | "stalls" | "paths" | "utilities";

type BankCard = {
  id: string;
  kind: "attraction" | "stall" | "path" | "util";
  name: string;
  nameEn: string;
  cost: number;
  color: string;
  accent: string;
  tier: number;
  locked: boolean;
  unlockHint: string;
  shape: ThumbShape;
  /** Shipped look still under public/assets/looks — null keeps SVG fallback. */
  look: BankLookRef | null;
  moodEffect: number;
  incomeHint: number;
  staffNeeded: number;
  footprint: string;
  freeKit?: boolean;
  /** Transparent card art from public/assets/ui/cards */
  artSrc?: string;
};

function cardArtFor(id: string): string | undefined {
  if (id === "grand_carousel") return GAME_STATIC_ASSETS.CARD_CAROUSEL?.src;
  if (id === "cotton_candy") return GAME_STATIC_ASSETS.CARD_COTTON_CANDY?.src;
  return undefined;
}

const TAB_META: { id: BankTab; icon: string; labelKey: string }[] = [
  { id: "thrill", icon: "🎢", labelKey: "coasters" },
  { id: "family", icon: "👨‍👩‍👧‍👦", labelKey: "family" },
  { id: "stalls", icon: "🍿", labelKey: "stalls" },
  { id: "paths", icon: "🛤️", labelKey: "paths" },
  { id: "utilities", icon: "🚻", labelKey: "utilities" },
];

function attractionCost(excitement: number): number {
  return Math.round(300 + excitement * 12);
}

function unlockForAttraction(
  excitement: number,
  parkLevel: number,
  unlockLabel: (n: number) => string,
): { locked: boolean; hint: string } {
  if (excitement >= 92 && parkLevel < 5) return { locked: true, hint: unlockLabel(5) };
  if (excitement >= 85 && parkLevel < 3) return { locked: true, hint: unlockLabel(3) };
  if (excitement >= 75 && parkLevel < 2) return { locked: true, hint: unlockLabel(2) };
  return { locked: false, hint: "" };
}

export function BuildBankModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useGameStore();
  const { t, locale, dir } = useI18n();
  const [tab, setTab] = useState<BankTab>("thrill");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unlockLabel = (n: number) => t("unlockLevel", { n });

  const cards: BankCard[] = useMemo(() => {
    if (tab === "stalls") {
      return STALLS.map((s) => {
        const free = store.starterKit.stallLeft > 0 && s.id === store.starterKit.stallId;
        return {
          id: s.id,
          kind: "stall" as const,
          name: stallDisplayName(s.id, s.nameHe, s.nameEn, locale),
          nameEn: s.nameEn,
          cost: free ? 0 : stallBuildCost(s),
          color: s.color,
          accent: "#fbbf24",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "stall" as ThumbShape,
          look: resolveBankLook("stall", s.id),
          moodEffect: s.buyMoodBoost ?? 8,
          incomeHint: s.productPrice,
          staffNeeded: 1,
          footprint: "1×1",
          freeKit: free,
          artSrc: cardArtFor(s.id),
        };
      });
    }
    if (tab === "paths") {
      // Roads/paths to lay out — not standalone service buildings
      return [
        {
          id: "path",
          kind: "path" as const,
          name: utilDisplayName("path", locale),
          nameEn: "Paved Path",
          cost: 40,
          color: "#94a3b8",
          accent: "#e2e8f0",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "path" as ThumbShape,
          look: resolveBankLook("util", "path"),
          moodEffect: 2,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
        },
      ];
    }
    if (tab === "utilities") {
      const items: BankCard[] = [
        {
          id: "bin",
          kind: "util",
          name: utilDisplayName("bin", locale),
          nameEn: "Trash Bin",
          cost: store.starterKit.binLeft > 0 ? 0 : 100,
          color: "#14b8a6",
          accent: "#5eead4",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "bin" as ThumbShape,
          look: resolveBankLook("util", "bin"),
          moodEffect: 6,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
          freeKit: store.starterKit.binLeft > 0,
        },
        {
          id: "bench",
          kind: "util",
          name: utilDisplayName("bench", locale),
          nameEn: "Park Bench",
          cost: 80,
          color: "#a16207",
          accent: "#fbbf24",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "bench" as ThumbShape,
          look: resolveBankLook("util", "bench"),
          moodEffect: 5,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
        },
        {
          id: "parking",
          kind: "util",
          name: utilDisplayName("parking", locale),
          nameEn: "Parking Bay",
          cost: 800,
          color: "#475569",
          accent: "#94a3b8",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "parking" as ThumbShape,
          look: resolveBankLook("util", "parking"),
          moodEffect: 1,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
        },
        {
          id: "warehouse",
          kind: "util",
          name: utilDisplayName("warehouse", locale),
          nameEn: "Logistics Warehouse",
          cost: store.warehouseBuilt ? 0 : 1200,
          color: "#64748b",
          accent: "#fbbf24",
          tier: 1,
          locked: store.warehouseBuilt,
          unlockHint: store.warehouseBuilt ? t("builtAlready") : "",
          shape: "warehouse" as ThumbShape,
          look: resolveBankLook("util", "warehouse"),
          moodEffect: 0,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
        },
        {
          id: "hire_janitor",
          kind: "util",
          name: utilDisplayName("hire_janitor", locale),
          nameEn: "Hire Janitor",
          cost: store.starterKit.janitorLeft > 0 ? 0 : 600,
          color: "#2563eb",
          accent: "#93c5fd",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "hire" as ThumbShape,
          look: resolveBankLook("util", "hire_janitor"),
          moodEffect: 10,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "—",
          freeKit: store.starterKit.janitorLeft > 0,
        },
        {
          id: "hire_runner",
          kind: "util",
          name: utilDisplayName("hire_runner", locale),
          nameEn: "Hire Runner",
          cost: store.starterKit.runnerLeft > 0 ? 0 : 700,
          color: "#ea580c",
          accent: "#fdba74",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "hire" as ThumbShape,
          look: resolveBankLook("util", "hire_runner"),
          moodEffect: 4,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "—",
          freeKit: store.starterKit.runnerLeft > 0,
        },
        {
          id: "hire_mechanic",
          kind: "util",
          name: utilDisplayName("hire_mechanic", locale),
          nameEn: "Hire Mechanic",
          cost: 900,
          color: "#7c3aed",
          accent: "#c4b5fd",
          tier: 1,
          locked: store.parkLevel < 2,
          unlockHint: unlockLabel(2),
          shape: "hire" as ThumbShape,
          look: resolveBankLook("util", "hire_mechanic"),
          moodEffect: 8,
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "—",
        },
      ];
      for (const d of DECOR.slice(0, 6)) {
        items.push({
          id: `decor:${d.id}`,
          kind: "util",
          name: decorDisplayName(d.id, d.nameHe, d.nameEn, locale),
          nameEn: d.nameEn,
          cost: d.cost,
          color: "#84cc16",
          accent: "#bef264",
          tier: 1,
          locked: false,
          unlockHint: "",
          shape: "generic",
          look: resolveBankLook("util", `decor:${d.id}`),
          moodEffect: Math.round(d.moodPerSec * 10),
          incomeHint: 0,
          staffNeeded: 0,
          footprint: "1×1",
        });
      }
      return items;
    }

    const list =
      tab === "thrill"
        ? ATTRACTIONS.filter((a) => a.category === "thrill" || a.category === "water")
        : ATTRACTIONS.filter((a) => a.category === "family" || a.category === "carnival");

    return list.map((a) => {
      const free = store.starterKit.attractionLeft > 0 && a.id === store.starterKit.attractionId;
      const unlock = free
        ? { locked: false, hint: "" }
        : unlockForAttraction(a.excitementScore, store.parkLevel, unlockLabel);
      return {
        id: a.id,
        kind: "attraction" as const,
        name: attractionDisplayName(a.id, a.nameHe, a.nameEn, locale),
        nameEn: a.nameEn,
        cost: free ? 0 : attractionCost(a.excitementScore),
        color: a.color,
        accent: a.accent,
        tier: 1,
        locked: unlock.locked,
        unlockHint: unlock.hint,
        shape: (a.shape as ThumbShape) || "generic",
        look: resolveBankLook("attraction", a.id),
        moodEffect: Math.round(a.excitementScore / 10),
        incomeHint: a.baseTicketPrice,
        staffNeeded: a.footprint.w >= 3 ? 2 : 1,
        footprint: `${a.footprint.w}×${a.footprint.h}`,
        freeKit: free,
        artSrc: cardArtFor(a.id),
      };
    });
  }, [tab, store.parkLevel, store.starterKit, store.warehouseBuilt, locale, t]);

  useEffect(() => {
    if (!open) return;
    const firstFree = cards.find((c) => !c.locked);
    setSelectedId(firstFree?.id ?? cards[0]?.id ?? null);
  }, [tab, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];

  if (!open) return null;

  const placeCard = (card: BankCard | undefined) => {
    if (!card || card.locked) return;
    if (card.id === "hire_janitor") {
      store.hireStaff("janitor");
      onClose();
      return;
    }
    if (card.id === "hire_runner") {
      store.hireStaff("runner");
      onClose();
      return;
    }
    if (card.id === "hire_mechanic") {
      store.hireStaff("mechanic");
      onClose();
      return;
    }
    if (card.id.startsWith("decor:")) {
      store.setBuildMode("decor", card.id.replace("decor:", ""));
      onClose();
      return;
    }
    if (card.kind === "attraction") store.setBuildMode("attraction", card.id);
    else if (card.kind === "stall") store.setBuildMode("stall", card.id);
    else if (card.kind === "path" || card.id === "path") store.setBuildMode("path");
    else if (card.id === "bin") store.setBuildMode("bin");
    else if (card.id === "bench") store.setBuildMode("bench");
    else if (card.id === "parking") store.setBuildMode("parking");
    else if (card.id === "warehouse") store.setBuildMode("warehouse");
    onClose();
  };

  const place = () => placeCard(selected);

  return (
    <div className="absolute inset-0 z-[55] flex items-end justify-center sm:items-center" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label={t("close")}
        onClick={onClose}
      />

      <div
        className="build-bank-panel relative mb-0 flex max-h-[min(86vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-md sm:mb-6"
        data-testid="build-bank-modal"
      >
        <div className="relative flex items-center justify-center border-b border-[color:var(--wow-border)] px-4 py-3">
          <h2 className="wow-title text-center text-base font-extrabold sm:text-xl">
            {t("buildBankTitle")}
          </h2>
          <button
            type="button"
            className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded border-2 border-[color:var(--wow-border)] bg-[#3a2010] text-sm font-bold text-[color:var(--wow-gold)] hover:brightness-110"
            onClick={onClose}
            aria-label={t("close")}
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-[4.5rem] shrink-0 flex-col gap-1.5 border-e border-[color:var(--wow-border)] bg-[#120e0a]/80 p-2 sm:w-28">
            {TAB_META.map((m) => {
              const active = tab === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`bank-tab-${m.id}`}
                  onClick={() => setTab(m.id)}
                  className={`flex flex-col items-center gap-0.5 rounded border-2 px-1 py-2.5 text-[10px] font-bold transition sm:text-[11px] ${
                    active
                      ? "border-[color:var(--wow-gold)] bg-[#5a4018] text-[color:var(--wow-gold)]"
                      : "border-[color:var(--wow-border)] bg-[#1a1410] text-[color:var(--wow-muted)] hover:text-[color:var(--wow-parchment)]"
                  }`}
                >
                  <span className="text-xl leading-none">{m.icon}</span>
                  <span className="leading-tight">{t(m.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          <div className="grid flex-1 grid-cols-2 content-start gap-2.5 overflow-y-auto p-3 sm:grid-cols-3">
            {cards.map((c) => {
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`bank-card-${c.id}`}
                  onClick={() => {
                    setSelectedId(c.id);
                    if (typeof window !== "undefined" && window.innerWidth < 640 && !c.locked) {
                      placeCard(c);
                    }
                  }}
                  className={`relative flex flex-col items-center rounded border-2 bg-[#1a1410]/90 p-2 text-center transition ${
                    active
                      ? "border-[color:var(--wow-gold)] shadow-[0_0_0_2px_rgba(232,197,71,0.35)]"
                      : "border-[color:var(--wow-border)] hover:border-[color:var(--wow-gold-dim)] hover:bg-[#241c14]"
                  }`}
                >
                  <IsoThumb
                    shape={c.shape}
                    color={c.color}
                    accent={c.accent}
                    locked={c.locked}
                    size={96}
                    lookKind={c.look?.kind}
                    lookId={c.look?.id}
                    artSrc={c.artSrc}
                  />
                  <div className="mt-1.5 line-clamp-2 text-[11px] font-bold leading-tight text-[color:var(--wow-parchment)] sm:text-xs">
                    {c.name}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[color:var(--wow-gold-dim)]">
                    {t("tier")} {c.tier}
                    {c.freeKit ? t("freeDot") : ""}
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[11px] font-bold tabular-nums text-[color:var(--wow-gold)]">
                    <span>{c.locked
                      ? c.unlockHint || t("locked")
                      : c.cost === 0
                        ? t("free")
                        : c.cost.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="hidden w-64 shrink-0 flex-col border-s border-[color:var(--wow-border)] bg-[#120e0a]/70 p-3 sm:flex">
            {selected && (
              <>
                <div className="mx-auto">
                  <IsoThumb
                    shape={selected.shape}
                    color={selected.color}
                    accent={selected.accent}
                    locked={selected.locked}
                    size={140}
                    lookKind={selected.look?.kind}
                    lookId={selected.look?.id}
                    artSrc={selected.artSrc}
                  />
                </div>
                <h3 className="wow-title mt-3 text-center text-lg font-bold">
                  {selected.name}
                </h3>
                <p className="text-center text-[11px] text-[color:var(--wow-muted)]">{selected.nameEn}</p>
                <p className="mt-1 text-center text-xs font-bold text-[color:var(--wow-gold-dim)]">
                  {t("tier")} {selected.tier}
                </p>

                <div className="mt-3 space-y-2 rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-2.5">
                  <StatRow
                    label={t("incomePrice")}
                    value={selected.incomeHint ? `₪${selected.incomeHint}` : "—"}
                  />
                  <StatRow label={t("moodEffect")} value={`+${selected.moodEffect}`} />
                  <StatRow label={t("staffNeeded")} value={`${selected.staffNeeded}`} />
                  <StatRow label={t("footprint")} value={selected.footprint} />
                </div>

                <div className="wow-bar-track mt-3">
                  <div className="h-full w-1/5 bg-gradient-to-l from-[#e8c547] to-[#7a3bb8]" />
                </div>
                <p className="mt-1 text-center text-[10px] text-[color:var(--wow-muted)]">{t("upgradeProgress")}</p>

                <button
                  type="button"
                  disabled={
                    selected.locked ||
                    (selected.cost > 0 && store.cash < selected.cost && !selected.id.startsWith("hire_"))
                  }
                  onClick={place}
                  className="btn-primary mt-auto w-full py-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selected.locked
                    ? selected.unlockHint || t("locked")
                    : selected.kind === "path"
                      ? t("layPath")
                      : t("buildNow")}
                </button>
              </>
            )}
          </aside>
        </div>

        <div className="border-t border-[color:var(--wow-border)] bg-[#120e0a]/90 p-3 sm:hidden">
          {selected && (
            <div className="mb-2 flex items-center gap-2">
              <IsoThumb
                shape={selected.shape}
                color={selected.color}
                accent={selected.accent}
                locked={selected.locked}
                size={56}
                lookKind={selected.look?.kind}
                lookId={selected.look?.id}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[color:var(--wow-parchment)]">{selected.name}</div>
                <div className="text-[11px] text-[color:var(--wow-muted)]">
                  {t("tier")} {selected.tier} · +{selected.moodEffect} ·{" "}
                  {selected.cost === 0 ? t("free") : selected.cost}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
            data-testid="bank-place-btn"
            disabled={!selected || selected.locked}
            onClick={place}
          >
            {selected?.locked ? t("locked") : selected?.kind === "path" ? t("layPath") : t("buildNow")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-[color:var(--wow-muted)]">{label}</span>
      <span className="font-bold tabular-nums text-[color:var(--wow-parchment)]">{value}</span>
    </div>
  );
}
