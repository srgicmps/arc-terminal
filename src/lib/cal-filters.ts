// CAL: filtros del calendario económico de TradingView (países e importancia), guardados en el navegador
// (clave arc-cal). Lógica pura, con tests: qué se puede guardar y cómo se pasa al widget.

export const CAL_COUNTRIES = [
	{ value: 'us', label: 'EE. UU.' },
	{ value: 'eu', label: 'Zona euro' },
	{ value: 'es', label: 'España' },
	{ value: 'de', label: 'Alemania' },
	{ value: 'fr', label: 'Francia' },
	{ value: 'it', label: 'Italia' },
	{ value: 'gb', label: 'R. Unido' },
	{ value: 'cn', label: 'China' },
	{ value: 'jp', label: 'Japón' }
] as const;

/** Importancia de TradingView: -1 baja, 0 media, 1 alta. */
export const CAL_IMPORTANCE = [
	{ value: '1', label: 'Alta' },
	{ value: '0,1', label: 'Media y alta' },
	{ value: '-1,0,1', label: 'Todas' }
] as const;

export type CalCountry = (typeof CAL_COUNTRIES)[number]['value'];
export type CalImportance = (typeof CAL_IMPORTANCE)[number]['value'];
export interface CalFilters {
	countries: CalCountry[];
	importance: CalImportance;
}

export const CAL_DEFAULT: CalFilters = { countries: CAL_COUNTRIES.map((c) => c.value), importance: '0,1' };

/** Lo guardado (texto JSON), validado: lo que no se entienda vuelve al valor por defecto. */
export function parseCalFilters(raw: string | null): CalFilters {
	try {
		const v = JSON.parse(raw ?? '');
		const countries = Array.isArray(v?.countries)
			? CAL_COUNTRIES.map((c) => c.value).filter((c) => v.countries.includes(c))
			: CAL_DEFAULT.countries;
		const importance = CAL_IMPORTANCE.some((i) => i.value === v?.importance) ? v.importance : CAL_DEFAULT.importance;
		return { countries: countries.length ? countries : CAL_DEFAULT.countries, importance };
	} catch {
		return CAL_DEFAULT;
	}
}

/** Configuración del widget «events» de TradingView. Sin ningún país marcado, todos. */
export const calConfig = (f: CalFilters) => ({
	importanceFilter: f.importance,
	countryFilter: (f.countries.length ? f.countries : CAL_DEFAULT.countries).join(',')
});
