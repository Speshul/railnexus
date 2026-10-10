import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeT, type Locale } from "./core";

/** The visitor's chosen language (cookie), or null if they haven't chosen yet. */
export const getChosenLocale = cache(async (): Promise<Locale | null> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : null;
});

export const getLocale = cache(async (): Promise<Locale> => (await getChosenLocale()) ?? "en");

export const getT = cache(async () => makeT(await getLocale()));
