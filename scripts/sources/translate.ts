// Traducción de los titulares en inglés al español (MyMemory). Fuente derivada: va después de IMP,
// cuando ya están guardados los titulares de esta pasada. Todo el trabajo está en scripts/translate.ts.
// Sin el Secret MYMEMORY_EMAIL se salta (STATUS la enseña como «Sin clave») y todo sigue en inglés.
import { translateHeadlines, type TranslationCache } from '../translate.ts';
import type { Source } from '../lib.ts';

export const translations: Source<TranslationCache> = {
	name: 'translations',
	label: 'Traducción de titulares en inglés · MyMemory (traducción automática)',
	// Cada pasada mira si hay titulares nuevos; lo ya traducido no se vuelve a pedir.
	maxAgeMinutes: 0,
	requires: 'MYMEMORY_EMAIL',
	// Nivel 2: detrás de IMP (after: true), que ya habrá escrito imp.json (scripts/lib.ts, waves).
	after: 2,
	fetch: (previous) => translateHeadlines({ dir: 'static/data', email: process.env.MYMEMORY_EMAIL, previous })
};
