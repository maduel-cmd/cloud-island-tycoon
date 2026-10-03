import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { LOCALES, type Locale } from "../../i18n/catalog";

export function WelcomeModal() {
  const [open, setOpen] = useState(true);
  const { t, locale, setLocale, dir } = useI18n();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]" dir={dir}>
      <div className="wow-frame max-w-lg rounded-md p-6">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-md border-2 border-[color:var(--wow-border)] shadow"
          />
          <div className="text-start">
            <div className="wow-title font-display text-3xl font-extrabold">{t("brand")}</div>
            <p className="mt-1 text-sm font-medium text-[color:var(--wow-muted)]">{t("welcomeTagline")}</p>
          </div>
        </div>
        <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--wow-gold-dim)]">
          {t("zoneStarter")}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("language")}>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`rounded border px-3 py-1 text-xs font-bold transition ${
                locale === l.id
                  ? "border-[color:var(--wow-gold)] bg-[#5a4018] text-[color:var(--wow-gold)]"
                  : "border-[color:var(--wow-border)] bg-[#1a1410] text-[color:var(--wow-muted)] hover:text-[color:var(--wow-parchment)]"
              }`}
              onClick={() => setLocale(l.id as Locale)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[color:var(--wow-parchment)]">{t("welcomeBodyShort")}</p>
        <p className="mt-2 text-xs font-semibold text-[color:var(--wow-gold)]">{t("welcomeFirstStep")}</p>
        <button type="button" className="btn-primary mt-5 w-full py-3 text-base" onClick={() => setOpen(false)}>
          {t("welcomeCta")}
        </button>
      </div>
    </div>
  );
}
