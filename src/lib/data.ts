// Lectura de los datos descargados por scripts/update.ts (static/data/<nombre>.json).
import type { FuelData, FuelSpainData } from './fuel.ts';
import type {
	BoeData,
	CryptoData,
	FedRegData,
	FinnhubData,
	HazardsData,
	HolidaysData,
	HnItem,
	NewsData,
	Paper,
	PowerData,
	PowerMixData,
	PredictionsData,
	Quake,
	Release,
	SecData,
	SeriesData,
	WeatherData,
	WikiData,
	YieldCurveData
} from './types.ts';
import type { AirData, AlertsData } from './weather.ts';

/** Lo que guarda cada archivo de static/data: los datos y cuándo se descargaron. */
export interface Dataset<T> {
	name: string;
	/** Cuándo se descargaron (ISO 8601). */
	fetchedAt: string;
	data: T;
}

/** Estado de cada fuente en la última actualización (static/data/status.json). */
export interface SourceStatus {
	name: string;
	label: string;
	/**
	 * ok: recién descargada · cached: copia reciente reutilizada · stale: falló y se usa la anterior ·
	 * error: sin datos · off: necesita una clave que no está configurada
	 */
	state: 'ok' | 'cached' | 'stale' | 'error' | 'off';
	fetchedAt: string | null;
	/** Cada cuánto se refresca como mucho (maxAgeMinutes de scripts/sources). Lo usa <Updated>. */
	maxAgeMinutes?: number;
	error?: string;
	/** Clave de GitHub Secrets que necesita, si necesita alguna. */
	requires?: string;
}

// Vite convierte cada JSON en un trozo aparte que solo se carga en la página que lo pide.
// Si un archivo no existe (en local, antes de `pnpm data`), simplemente no aparece aquí.
const loaders = import.meta.glob('/static/data/*.json', { import: 'default' });

/**
 * Qué tipo de datos guarda cada archivo de static/data, por su nombre (el `name` de cada fuente en
 * scripts/sources). Así `dataset('ecb')` ya sabe que devuelve SeriesData y `pnpm check` avisa si una
 * vista pide un archivo que no existe o lo usa con otro tipo.
 */
export interface DataMap {
	air: AirData;
	alerts: AlertsData;
	bis: SeriesData;
	bls: SeriesData;
	boe: BoeData;
	crypto: CryptoData;
	ecb: SeriesData;
	eurostat: SeriesData;
	fedreg: FedRegData;
	finnhub: FinnhubData;
	fred: SeriesData;
	fuel: FuelData;
	'fuel-es': FuelSpainData;
	hazards: HazardsData;
	holidays: HolidaysData;
	hfpapers: Paper[];
	hn: HnItem[];
	ine: SeriesData;
	power: PowerData;
	'power-mix': PowerMixData;
	predictions: PredictionsData;
	quakes: Quake[];
	'quakes-es': Quake[];
	releases: Release[];
	sec: SecData;
	status: SourceStatus[];
	uscurve: YieldCurveData;
	usdebt: SeriesData;
	weather: WeatherData;
	wiki: WikiData;
	/** Titulares de cada sección: news-eco, news-geo, news-gov… */
	[news: `news-${string}`]: NewsData;
}

export async function dataset<K extends keyof DataMap>(name: K): Promise<Dataset<DataMap[K]> | null> {
	const load = loaders[`/static/data/${name}.json`];
	return load ? ((await load()) as Dataset<DataMap[K]>) : null;
}
