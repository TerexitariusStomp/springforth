import { createInstance, type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { DICTS, type Lang } from '../../../src/portal/i18n.ts';

// One instance per request is wasteful on Workers' tight CPU budget, and
// nothing in the app ever calls changeLanguage — lang is resolved per
// request from URL/cookie — so a per-lang cached instance is safe.
// (If a mutable API is ever needed, go back to per-request instances.)
const cache = new Map<Lang, i18n>();

export function createI18n(lang: Lang): i18n {
	let instance = cache.get(lang);
	if (!instance) {
		instance = createInstance();
		instance.use(initReactI18next).init({
			lng: lang,
			fallbackLng: "en",
			resources: {
				en: { translation: DICTS.en },
				sw: { translation: DICTS.sw },
				fr: { translation: DICTS.fr },
			},
			interpolation: { escapeValue: false },
			returnNull: false,
		});
		cache.set(lang, instance);
	}
	return instance;
}

export { langFrom, LANGS, type Lang } from '../../../src/portal/i18n.ts';
