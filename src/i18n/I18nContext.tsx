import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getLocale,
  initLocale,
  localeDir,
  setLocaleAndNotify,
  t as translate,
  type Locale,
  LOCALES,
} from "./catalog";

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
  locales: typeof LOCALES;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLoc] = useState<Locale>(() => initLocale());

  const setLocale = useCallback((l: Locale) => {
    setLocaleAndNotify(l);
    setLoc(l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : l;
    document.documentElement.dir = localeDir(l);
  }, []);

  const value = useMemo<I18nCtx>(
    () => ({
      locale,
      setLocale,
      t: (key: string, params?: Record<string, string | number>) =>
        translate(key, locale, params),
      dir: localeDir(locale),
      locales: LOCALES,
    }),
    [locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      locale: getLocale(),
      setLocale: setLocaleAndNotify,
      t: (key: string, params?: Record<string, string | number>) => translate(key, getLocale(), params),
      dir: localeDir(),
      locales: LOCALES,
    };
  }
  return ctx;
}
