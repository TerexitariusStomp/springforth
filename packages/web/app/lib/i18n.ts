import { createInstance, type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { DICTS, type Lang } from "@springforth/portal";

// One instance per request — SSR must never share mutable i18n state.
export function createI18n(lang: Lang): i18n {
	const instance = createInstance();
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
	return instance;
}

export { langFrom, LANGS, type Lang } from "@springforth/portal";
