import { useEffect, useMemo, useState } from "react";
import { ATTRACTIONS, TIER_NAMES_HE, attractionUpgradeCost, getAttraction } from "../../data/attractions";
import { DECOR } from "../../data/decor";
import { STALLS, stallBuildCost, stallUpgradeCost, getStall } from "../../data/stalls";
import { GAME_STATIC_ASSETS } from "../../config/assets";
import { GEM_REPAIR_COST } from "../../managers/Simulation";
import { useGameStore } from "../../state/useGameStore";
import { useI18n } from "../../i18n/I18nContext";
import {
  attractionDisplayName,
  stallDisplayName,
  decorDisplayName,
  utilDisplayName,
} from "../../i18n/names";
import type { Locale } from "../../i18n/catalog";

type Tab = "build" | "staff" | "logistics" | "expand";

const CAT_KEYS = {
  thrill: "thrill",
  family: "family",
  water: "water",
  carnival: "carnival",
} as const;

const TAB_KEYS = [
  ["build", "build", "🏗️"],
  ["staff", "staff", "👷"],
  ["logistics", "logistics", "📦"],
  ["expand", "expand", "🗺️"],
] as const;

export function SidePanels() {
  const [tab, setTab] = useState<Tab | null>(null);
  const [cat, setCat] = useState<
    "attraction" | "stall" | "path" | "bin" | "bench" | "decor"
  >("attraction");
  const [filter, setFilter] = useState<keyof typeof CAT_KEYS | "all">("all");
  const store = useGameStore();
  const { t, dir } = useI18n();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: Tab }>).detail;
      if (detail?.tab) setTab(detail.tab);
    };
    window.addEventListener("cit-open-panel", onOpen);
    return () => window.removeEventListener("cit-open-panel", onOpen);
  }, []);

  useEffect(() => {
    if (store.buildMode !== "none" && typeof window !== "undefined" && window.innerWidth < 640) {
      setTab(null);
    }
  }, [store.buildMode]);

  const attractions = useMemo(() => {
    if (filter === "all") return ATTRACTIONS;
    return ATTRACTIONS.filter((a) => a.category === filter);
  }, [filter]);

  const selectedAttr =
    store.selectedEntity?.kind === "attraction"
      ? store.attractions.find((a) => a.uid === store.selectedEntity?.id)
      : null;
  const selectedStall =
    store.selectedEntity?.kind === "stall"
      ? store.stalls.find((s) => s.uid === store.selectedEntity?.id)
      : null;

  const sheetOpen = tab !== null;
  const showSelection = Boolean(selectedAttr || selectedStall);

  const renderPanelBody = () =>
    tab ? (
      <PanelBody
        tab={tab}
        cat={cat}
        setCat={setCat}
        filter={filter}
        setFilter={setFilter}
        attractions={attractions}
        store={store}
      />
    ) : null;

  return (
    <div dir={dir}>
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 sm:hidden">
        {showSelection && !sheetOpen && (
          <div className="pointer-events-auto mx-2 mb-2">
            <SelectionCard
              selectedAttr={selectedAttr}
              selectedStall={selectedStall}
              store={store}
            />
          </div>
        )}

        {sheetOpen && (
          <div className="pointer-events-auto wow-frame mx-0 flex max-h-[min(58vh,420px)] flex-col rounded-t-md">
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <div className="mx-auto h-1 w-10 rounded-full bg-[color:var(--wow-gold-dim)]" />
            </div>
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="wow-title text-sm font-bold">
                {t(TAB_KEYS.find((row) => row[0] === tab)?.[1] ?? "build")}
              </span>
              <button
                type="button"
                className="btn-chip !text-xs"
                onClick={() => setTab(null)}
              >
                {t("close")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
              {renderPanelBody()}
            </div>
          </div>
        )}
      </div>

      <aside className="pointer-events-auto absolute bottom-4 end-4 top-24 z-40 hidden w-[340px] flex-col gap-2 sm:flex">
        <div className="glass-panel flex gap-1 p-1">
          {TAB_KEYS.map(([id, labelKey]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded border px-2 py-2 text-xs font-semibold transition ${
                tab === id
                  ? "border-[color:var(--wow-gold)] bg-[#5a4018] text-[color:var(--wow-gold)]"
                  : "border-transparent text-[color:var(--wow-muted)] hover:bg-[#2a2018] hover:text-[color:var(--wow-parchment)]"
              }`}
              onClick={() => setTab(id)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="glass-panel min-h-0 flex-1 overflow-hidden p-3">
          <div className="flex h-full min-h-0 flex-col overflow-y-auto">{renderPanelBody()}</div>
        </div>
      </aside>

      {showSelection && (
        <div className="pointer-events-auto absolute bottom-4 start-4 z-40 hidden w-[300px] sm:block">
          <SelectionCard
            selectedAttr={selectedAttr}
            selectedStall={selectedStall}
            store={store}
          />
        </div>
      )}
    </div>
  );
}

function PanelBody({
  tab,
  cat,
  setCat,
  filter,
  setFilter,
  attractions,
  store,
}: {
  tab: Tab;
  cat: "attraction" | "stall" | "path" | "bin" | "bench" | "decor";
  setCat: (c: "attraction" | "stall" | "path" | "bin" | "bench" | "decor") => void;
  filter: keyof typeof CAT_KEYS | "all";
  setFilter: (f: keyof typeof CAT_KEYS | "all") => void;
  attractions: typeof ATTRACTIONS;
  store: ReturnType<typeof useGameStore>;
}) {
  const { t, locale } = useI18n();

  if (tab === "build") {
    return (
      <div className="flex flex-col gap-2 pb-2">
        <StarterKitBar store={store} setCat={setCat} />
        <AssetBankStrip />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["attraction", "attractions"],
              ["stall", "stallsShort"],
              ["path", "paths"],
              ["bin", "bins"],
              ["bench", "benches"],
              ["decor", "decor"],
            ] as const
          ).map(([id, labelKey]) => (
            <button
              key={id}
              type="button"
              className={`rounded border px-3 py-1 text-[11px] font-semibold ${
                cat === id ? "bg-grass-mid text-white" : "bg-slate-100 text-[color:var(--wow-muted)]"
              }`}
              onClick={() => {
                setCat(id);
                if (id === "path") store.setBuildMode("path");
                else if (id === "bin") store.setBuildMode("bin");
                else if (id === "bench") store.setBuildMode("bench");
                else store.setBuildMode("none");
              }}
              data-testid={`build-cat-${id}`}
              aria-pressed={cat === id}
            >
              {t(labelKey)}
            </button>
          ))}
          <button
            type="button"
            className="btn-chip !text-[11px] border-[color:#8b3a2a] text-[#e8a090]"
            onClick={() => store.setBuildMode("demolish")}
          >
            {t("demolish")}
          </button>
        </div>

        {cat === "attraction" && (
          <>
            <div className="flex flex-wrap gap-1">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("all")} />
              {(Object.keys(CAT_KEYS) as (keyof typeof CAT_KEYS)[]).map((k) => (
                <FilterChip
                  key={k}
                  active={filter === k}
                  onClick={() => setFilter(k)}
                  label={t(CAT_KEYS[k])}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {attractions.map((a) => {
                const freeKit =
                  store.starterKit.attractionLeft > 0 && a.id === store.starterKit.attractionId;
                const name = attractionDisplayName(a.id, a.nameHe, a.nameEn, locale);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-start ${
                      freeKit ? "bg-amber-50 ring-1 ring-amber-300" : "bg-slate-50"
                    }`}
                    onClick={() => store.setBuildMode("attraction", a.id)}
                  >
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg text-xs font-bold text-white"
                      style={{ background: a.color }}
                    >
                      {a.shape === "wheel" ? "🎡" : a.shape === "coaster" ? "🎢" : "🎠"}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-bold text-[color:var(--wow-parchment)]">
                        {name}
                        {freeKit ? t("freeDot") : ""}
                      </span>
                      <span className="block text-[10px] text-[color:var(--wow-muted)]">
                        {t("capacityLine", {
                          cat: t(CAT_KEYS[a.category]),
                          cap: a.baseCapacity,
                          price: freeKit ? t("kit") : `₪${Math.round(300 + a.excitementScore * 12)}`,
                        })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {cat === "stall" && (
          <div className="space-y-1.5" data-testid="stalls-list">
            {STALLS.map((s) => {
              const freeKit = store.starterKit.stallLeft > 0 && s.id === store.starterKit.stallId;
              const name = stallDisplayName(s.id, s.nameHe, s.nameEn, locale);
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`stall-card-${s.id}`}
                  className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-start ${
                    freeKit ? "bg-amber-50 ring-1 ring-amber-300" : "bg-slate-50"
                  }`}
                  onClick={() => store.setBuildMode("stall", s.id)}
                >
                  <span
                    className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg text-sm"
                    style={{ background: s.color }}
                  >
                    {s.icon === "balloon" ? (
                      <img
                        src="/assets/balloon-vendor-tile.jpg"
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "🍿"
                    )}
                  </span>
                  <span className="flex-1">
                    <span className="block text-xs font-bold text-[color:var(--wow-parchment)]">
                      {name}
                      {freeKit ? t("freeDot") : ""}
                    </span>
                    <span className="block text-[10px] text-[color:var(--wow-muted)]">
                      {t("priceBuild", {
                        price: s.productPrice,
                        build: freeKit ? t("kit") : t("buildPrice", { n: stallBuildCost(s) }),
                      })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {(cat === "path" || cat === "bin" || cat === "bench") && (
          <div className="space-y-2">
            {cat === "path" ? (
              <p className="text-sm leading-relaxed text-[color:var(--wow-muted)]">{t("pathHint")}</p>
            ) : cat === "bin" ? (
              <>
                <div className="rounded border border-[color:var(--wow-border)] bg-[#1a2414] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-emerald-900">{t("binsTitle")}</div>
                      <div className="text-[11px] text-emerald-800/80">
                        {t("binsInPark")}: {store.grid.bins.size}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`rounded border px-3 py-2 text-xs font-bold ${
                        store.buildMode === "bin"
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-emerald-800 ring-1 ring-emerald-300"
                      }`}
                      onClick={() => store.setBuildMode("bin")}
                    >
                      {store.starterKit.binLeft > 0 ? t("placeBinFree") : t("placeBinCost")}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/90">{t("binHelp")}</p>
                </div>
                <p className="text-[11px] text-[color:var(--wow-muted)]">{t("placeOnMapHint")}</p>
              </>
            ) : (
              <>
                <div className="rounded border border-[color:var(--wow-border)] bg-[#241c10] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-amber-900">{t("benchesTitle")}</div>
                      <div className="text-[11px] text-amber-800/80">
                        {t("binsInPark")}: {store.grid.benches.size}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`rounded border px-3 py-2 text-xs font-bold ${
                        store.buildMode === "bench"
                          ? "bg-amber-700 text-white"
                          : "bg-white text-amber-900 ring-1 ring-amber-300"
                      }`}
                      onClick={() => store.setBuildMode("bench")}
                    >
                      {t("placeBenchCost")}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-950/90">{t("benchHelp")}</p>
                </div>
                <p className="text-[11px] text-[color:var(--wow-muted)]">{t("benchNearQueues")}</p>
              </>
            )}
          </div>
        )}

        {cat === "decor" && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-[color:var(--wow-muted)]">
              {t("decorHelp")} {t("decorInPark", { n: store.grid.decor.size })}
            </p>
            <div className="space-y-1.5">
              {DECOR.map((d) => {
                const icon =
                  d.id === "statue" ? "🗿" : d.id === "tree" ? "🌳" : d.id === "bush" ? "🌿" : "🌸";
                const selected = store.buildMode === "decor" && store.selectedBuildId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-start ${
                      selected ? "bg-lime-100 ring-1 ring-lime-400" : "bg-slate-50"
                    }`}
                    onClick={() => store.setBuildMode("decor", d.id)}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded border border-[color:var(--wow-border)] bg-[#241c14] text-lg">
                      {icon}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs font-bold text-[color:var(--wow-parchment)]">
                        {decorDisplayName(d.id, d.nameHe, d.nameEn, locale)}
                      </span>
                      <span className="block text-[10px] text-[color:var(--wow-muted)]">
                        {t("decorMoodLine", {
                          cost: d.cost,
                          radius: d.radius,
                          mood: d.moodPerSec.toFixed(1),
                        })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "staff") {
    return (
      <div className="space-y-3 pb-2">
        <p className="text-xs text-[color:var(--wow-muted)]">{t("activeStaffN", { n: store.staff.length })}</p>
        <StaffHire
          title={t("janitorTitle")}
          desc={t("janitorDesc")}
          cost={600}
          count={store.staff.filter((s) => s.role === "janitor").length}
          onHire={() => store.hireStaff("janitor")}
          hireLabel={t("hire")}
        />
        <StaffHire
          title={t("runnerTitle")}
          desc={t("runnerDesc")}
          cost={700}
          count={store.staff.filter((s) => s.role === "runner").length}
          onHire={() => store.hireStaff("runner")}
          hireLabel={t("hire")}
        />
        <StaffHire
          title={t("mechanicTitle")}
          desc={t("mechanicDesc")}
          cost={900}
          count={store.staff.filter((s) => s.role === "mechanic").length}
          onHire={() => store.hireStaff("mechanic")}
          hireLabel={t("hire")}
        />
      </div>
    );
  }

  if (tab === "logistics") {
    return (
      <div className="space-y-3 pb-2">
        <div className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-3">
          <div className="text-xs text-[color:var(--wow-muted)]">{t("warehouseStock")}</div>
          <div className="font-display text-2xl font-bold text-[color:var(--wow-parchment)]">{store.warehouseStock}</div>
          {!store.warehouseBuilt && (
            <p className="mt-2 text-[11px] font-semibold text-amber-200" data-testid="no-warehouse-hint">
              {t("needWarehouseFirst")}
            </p>
          )}
          <button
            type="button"
            className="btn-primary mt-2 w-full"
            data-testid="order-supply"
            onClick={() => store.buyWarehouseStock(40)}
          >
            {store.warehouseBuilt ? t("orderSupply") : t("orderSupplyBlocked")}
          </button>
        </div>
        <div className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-3 text-xs text-[color:var(--wow-muted)]">
          <div>{t("entranceLanes", { n: store.entranceLanes })}</div>
          <button type="button" className="btn-primary mt-2 w-full" onClick={() => store.upgradeEntrance()}>
            {t("upgradeEntrance", { n: 1500 * store.entranceLanes })}
          </button>
        </div>
        <div className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-3 text-xs text-[color:var(--wow-muted)]">
          <div>{t("parkingBays", { n: store.parkingBays })}</div>
          <button type="button" className="btn-primary mt-2 w-full" onClick={() => store.upgradeParking()}>
            {t("addParking")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-2">
      {store.grid.plots.map((p) => (
        <div key={p.id} className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-[color:var(--wow-parchment)]">{t("plot", { id: p.id })}</div>
              <div className="text-[11px] text-[color:var(--wow-muted)]">
                {t("tiles", { w: p.width, h: p.height })}
              </div>
            </div>
            {p.unlocked ? (
              <span className="rounded border border-[color:var(--wow-border)] bg-[#1a2414] px-2 py-1 text-[10px] font-bold text-[color:var(--wow-hp)]">
                {t("openStatus")}
              </span>
            ) : (
              <button type="button" className="btn-primary text-[11px]" onClick={() => store.buyExpansion(p.id)}>
                {t("buyFor", { n: p.cost })}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SelectionCard({
  selectedAttr,
  selectedStall,
  store,
}: {
  selectedAttr: ReturnType<typeof useGameStore>["attractions"][number] | null | undefined;
  selectedStall: ReturnType<typeof useGameStore>["stalls"][number] | null | undefined;
  store: ReturnType<typeof useGameStore>;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="glass-panel p-3">
      {selectedAttr && (
        <>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-sm font-bold text-[color:var(--wow-parchment)] sm:text-base">
                {(() => {
                  const def = getAttraction(selectedAttr.defId);
                  return def
                    ? attractionDisplayName(def.id, def.nameHe, def.nameEn, locale)
                    : selectedAttr.defId;
                })()}
              </div>
              <div className="text-[11px] text-[color:var(--wow-muted)]">
                <span className="me-1 rounded border border-[color:var(--wow-border)] bg-[#3a2c1c] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--wow-gold)]">
                  {selectedAttr.tier >= 5
                    ? `${t("level")} 5 ${t("max")}`
                    : `${t("level")} ${selectedAttr.tier}`}
                </span>
                {tierName(selectedAttr.tier, locale)} ·{" "}
                {t("durabilityPct", { n: Math.round(selectedAttr.durability) })}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/70">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#e8c547] to-[#2d8f3a]"
                  style={{ width: `${(selectedAttr.tier / 5) * 100}%` }}
                />
              </div>
            </div>
            <button type="button" className="btn-chip !px-2 !py-1" onClick={() => store.clearSelection()}>
              ✕
            </button>
          </div>
          <div className="mb-2 text-xs text-[color:var(--wow-muted)]">
            {t("queueRevenue", {
              q: selectedAttr.queue.length,
              r: Math.round(selectedAttr.revenueToday),
            })}
            {selectedAttr.broken ? ` · ${t("broken")}` : ""}
          </div>
          <div className="flex gap-2">
            {selectedAttr.broken && (
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => store.repairAttraction(selectedAttr.uid)}
              >
                {t("repairGems", { n: GEM_REPAIR_COST })}
              </button>
            )}
            {selectedAttr.tier < 5 && (
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => store.upgradeAttraction(selectedAttr.uid)}
              >
                {t("upgradeCost", {
                  n: attractionUpgradeCost(getAttraction(selectedAttr.defId)!, selectedAttr.tier),
                })}
              </button>
            )}
          </div>
        </>
      )}
      {selectedStall && (
        <>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-sm font-bold text-[color:var(--wow-parchment)]">
                {(() => {
                  const def = getStall(selectedStall.defId);
                  return def
                    ? stallDisplayName(def.id, def.nameHe, def.nameEn, locale)
                    : selectedStall.defId;
                })()}
              </div>
              <div className="text-[11px] text-[color:var(--wow-muted)]">
                {t("levelOf5", { n: selectedStall.tier })} · {t("stock")} {selectedStall.stock}
              </div>
            </div>
            <button type="button" className="btn-chip !px-2 !py-1" onClick={() => store.clearSelection()}>
              ✕
            </button>
          </div>
          {selectedStall.tier < 5 && (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => store.upgradeStall(selectedStall.uid)}
            >
              {t("upgradeCost", {
                n: stallUpgradeCost(getStall(selectedStall.defId)!, selectedStall.tier),
              })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function tierName(tier: number, locale: Locale): string {
  const he = TIER_NAMES_HE[tier - 1] ?? "";
  if (locale === "he") return he;
  const en = ["Basic", "Improved", "Advanced", "Elite", "Legendary"][tier - 1] ?? "";
  if (locale === "en") return en;
  if (locale === "ar") {
    return ["أساسي", "محسّن", "متقدم", "نخبة", "أسطوري"][tier - 1] ?? en;
  }
  return ["基础", "改良", "高级", "精英", "传奇"][tier - 1] ?? en;
}

function AssetBankStrip() {
  const { t } = useI18n();
  const park = GAME_STATIC_ASSETS.PARK_MAP_ISOMETRIC!;
  const balloon = GAME_STATIC_ASSETS.BALLOON_VENDOR_TILE!;
  return (
    <div className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-2.5">
      <div className="mb-1.5 text-[11px] font-bold text-sky-900">{t("assetBankConcept")}</div>
      <div className="flex gap-2">
        <figure className="flex-1 overflow-hidden rounded border border-[color:var(--wow-border)] bg-[#241c14]">
          <img src={park.src} alt={park.name} className="h-16 w-full object-cover" />
          <figcaption className="truncate px-1.5 py-1 text-[9px] text-[color:var(--wow-muted)]">{t("parkMap")}</figcaption>
        </figure>
        <figure className="w-20 overflow-hidden rounded border border-[color:var(--wow-border)] bg-[#241c14]">
          <img src={balloon.src} alt={balloon.name} className="h-16 w-full object-cover" />
          <figcaption className="truncate px-1.5 py-1 text-[9px] text-[color:var(--wow-muted)]">{t("balloons")}</figcaption>
        </figure>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-sky-900/80">{t("assetBankHint")}</p>
    </div>
  );
}

function StarterKitBar({
  store,
  setCat,
}: {
  store: ReturnType<typeof useGameStore>;
  setCat: (c: "attraction" | "stall" | "path" | "bin" | "bench" | "decor") => void;
}) {
  const { t, locale } = useI18n();
  const kit = store.starterKit;
  const left = kit.attractionLeft + kit.stallLeft + kit.binLeft;
  if (left <= 0) return null;
  const attr = getAttraction(kit.attractionId);
  const stall = getStall(kit.stallId);

  return (
    <div className="rounded border border-[color:var(--wow-border)] bg-[#241c10] p-2.5">
      <div className="mb-1.5 text-[11px] font-bold text-amber-800">
        {t("starterKitLeft", { n: left })}
      </div>
      <div className="flex flex-col gap-1">
        {kit.attractionLeft > 0 && attr && (
          <button
            type="button"
            className="rounded-xl bg-white px-2 py-1.5 text-start text-[11px] font-semibold text-[color:var(--wow-parchment)]"
            onClick={() => {
              setCat("attraction");
              store.setBuildMode("attraction", kit.attractionId);
            }}
          >
            🎠 {attractionDisplayName(attr.id, attr.nameHe, attr.nameEn, locale)}
            {t("freeDot")}
          </button>
        )}
        {kit.stallLeft > 0 && stall && (
          <button
            type="button"
            className="rounded-xl bg-white px-2 py-1.5 text-start text-[11px] font-semibold text-[color:var(--wow-parchment)]"
            onClick={() => {
              setCat("stall");
              store.setBuildMode("stall", kit.stallId);
            }}
          >
            🍭 {stallDisplayName(stall.id, stall.nameHe, stall.nameEn, locale)}
            {t("freeDot")}
          </button>
        )}
        {kit.binLeft > 0 && (
          <button
            type="button"
            className="rounded-xl bg-white px-2 py-1.5 text-start text-[11px] font-semibold text-[color:var(--wow-parchment)]"
            onClick={() => {
              setCat("bin");
              store.setBuildMode("bin");
            }}
          >
            🗑️ {utilDisplayName("bin", locale)}
            {t("freeDot")}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
        active ? "bg-sky-deep text-white" : "bg-slate-100 text-[color:var(--wow-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function StaffHire({
  title,
  desc,
  cost,
  count,
  onHire,
  hireLabel,
}: {
  title: string;
  desc: string;
  cost: number;
  count: number;
  onHire: () => void;
  hireLabel: string;
}) {
  return (
    <div className="rounded border border-[color:var(--wow-border)] bg-[#1a1410] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[color:var(--wow-parchment)]">
            {title} <span className="text-[11px] font-medium text-[color:var(--wow-muted)]">×{count}</span>
          </div>
          <div className="text-[11px] text-[color:var(--wow-muted)]">{desc}</div>
        </div>
        <button type="button" className="btn-primary shrink-0 text-[11px]" onClick={onHire}>
          {hireLabel} ₪{cost}
        </button>
      </div>
    </div>
  );
}
