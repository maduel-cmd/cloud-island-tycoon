import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { LOCALES, type Locale } from "../../i18n/catalog";

export function WelcomeModal() {
  const [open, setOpen] = useState(true);
  const { t, locale, setLocale, dir } = useI18n();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/70 p-4" dir={dir}>
      <div className="cit-card max-w-lg rounded p-5">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded border border-[color:var(--cit-border)]"
          />
          <div className="text-start">
            <div className="text-2xl font-extrabold text-[color:var(--cit-text)]">{t("brand")}</div>
            <p className="mt-0.5 text-sm font-medium text-[color:var(--cit-label)]">{t("welcomeTagline")}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("language")}>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`rounded border px-3 py-1 text-xs font-bold transition ${
                locale === l.id
                  ? "border-[color:var(--cit-text)] bg-[color:var(--cit-card-2)] text-[color:var(--cit-text)]"
                  : "border-[color:var(--cit-border)] text-[color:var(--cit-label)] hover:text-[color:var(--cit-text)]"
              }`}
              onClick={() => setLocale(l.id as Locale)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[color:var(--cit-text)]">{t("welcomeBodyShort")}</p>
        <p className="mt-2 text-xs font-semibold text-[color:var(--cit-label)]">{t("welcomeFirstStep")}</p>
        <button type="button" className="btn-primary mt-5 w-full py-3 text-base" onClick={() => setOpen(false)}>
          {t("welcomeCta")}
        </button>
      </div>
    </div>
  );
}
