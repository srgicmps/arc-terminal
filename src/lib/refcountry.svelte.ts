// País de referencia de la portada para paro, inflación y deuda (M22), guardado en este navegador.
// Son los países de Eurostat que descarga scripts/sources/eurostat.ts (GEOS).

const KEY = 'arc-ref-country';

export const REF_COUNTRIES = [
	{ code: 'es', name: 'España' },
	{ code: 'de', name: 'Alemania' },
	{ code: 'fr', name: 'Francia' },
	{ code: 'it', name: 'Italia' },
	{ code: 'pt', name: 'Portugal' }
] as const;

export const refCountry = $state({ code: 'es' as string });

/** Se llama al arrancar en el navegador (como onMounted en Vue). */
export function initRefCountry() {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved && REF_COUNTRIES.some((c) => c.code === saved)) refCountry.code = saved;
	} catch {}
}

export function setRefCountry(code: string) {
	if (!REF_COUNTRIES.some((c) => c.code === code)) return;
	refCountry.code = code;
	try {
		localStorage.setItem(KEY, code);
	} catch {}
}

/** Nombre del país elegido: «España». */
export const refName = () => REF_COUNTRIES.find((c) => c.code === refCountry.code)?.name ?? 'España';
