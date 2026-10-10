"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type Locale } from "./core";

const LocaleCtx = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export const useLocale = () => useContext(LocaleCtx);

export function useT() {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
