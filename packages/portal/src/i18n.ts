// Minimal i18n — a flat strings table keyed by (lang, key). English is
// the fallback: any missing key renders English, so adding a locale is
// incremental. Locales live in ./strings/*.ts — en/sw/fr ship together.
import en from './strings/en.ts';
import sw from './strings/sw.ts';
import fr from './strings/fr.ts';

export type Lang = 'en' | 'sw' | 'fr';

const STRINGS: Record<Lang, Record<string, string>> = { en, sw, fr };

export const LANGS: Lang[] = ['en', 'sw', 'fr'];

export const langFrom = (url: URL, cookie?: string | null): Lang => {
  const q = url.searchParams.get('lang');
  if (q === 'sw' || q === 'en' || q === 'fr') return q;
  const c = cookie?.match(/(?:^|;\s*)lang=(sw|en|fr)/)?.[1];
  return (c as Lang) ?? 'en';
};

export function t(lang: Lang, key: string): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}
