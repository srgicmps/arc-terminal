// Forma de los datos de static/data/*.json. La comparten los scripts que los descargan (scripts/sources/)
// y las vistas que los muestran.

// ---------- Series temporales (macro, tipos, divisas) ----------

export interface Point {
	/** Periodo: «2026-09», «2026-Q2», «2026-10-14»… */
	t: string;
	v: number;
}

export interface Series {
	id: string;
	label: string;
	/** «%», «€/$», «pb»… */
	unit: string;
	/** Código del país o zona, si aplica: ES, EA, US… */
	geo?: string;
	/** Puntos ordenados del más antiguo al más reciente. */
	points: Point[];
	/** Organismo que publica el dato. */
	source: string;
	/** Enlace a la serie en la web del organismo. */
	url?: string;
}

export interface SeriesData {
	series: Series[];
}

// ---------- BOE ----------

export interface BoeItem {
	id: string;
	title: string;
	dept: string;
	epigraph: string;
	html: string;
	pdf: string;
}

export interface BoeSection {
	code: string;
	name: string;
	/** Número total de disposiciones de la sección (se guardan todas salvo en las secciones de anuncios). */
	total: number;
	items: BoeItem[];
}

export interface BoeData {
	/** «2026-10-14» */
	date: string;
	number: string;
	pdf: string;
	sections: BoeSection[];
}

// ---------- Federal Register (EE. UU.) ----------

export interface FedRegDoc {
	id: string;
	title: string;
	type: string;
	subtype: string;
	abstract: string;
	agencies: string[];
	/** «2026-10-14» */
	date: string;
	url: string;
	pdf: string;
}

export interface FedRegData {
	presidential: FedRegDoc[];
	rules: FedRegDoc[];
}

// ---------- Noticias ----------

export interface NewsItem {
	title: string;
	url: string;
	source: string;
	/** ISO 8601, o null si el feed no trae fecha. */
	time: string | null;
	summary: string;
}

export interface FeedStatus {
	name: string;
	count: number;
	error?: string;
}

export interface NewsData {
	items: NewsItem[];
	feeds: FeedStatus[];
}

export interface HnItem {
	id: string;
	title: string;
	url: string;
	domain: string;
	points: number;
	comments: number;
	time: string;
}

// ---------- Terremotos (USGS) ----------

export interface Quake {
	id: string;
	mag: number;
	place: string;
	/** ISO 8601 */
	time: string;
	url: string;
	tsunami: boolean;
	/** Alerta PAGER: green, yellow, orange, red o null. */
	alert: string | null;
	lat: number;
	lon: number;
	depth: number;
}

// ---------- Precio de la luz (REE) ----------

export interface PricePoint {
	/** ISO 8601 con zona horaria de Madrid. */
	t: string;
	/** €/MWh */
	v: number;
}

export interface PowerData {
	pvpc: PricePoint[];
	spot: PricePoint[];
}

// ---------- Tiempo (Open-Meteo) ----------

export interface WeatherDay {
	date: string;
	code: number;
	max: number;
	min: number;
	rain: number;
	wind: number;
}

export interface WeatherPlace {
	name: string;
	current: { time: string; temp: number; code: number; wind: number; windDir: number; humidity: number };
	daily: WeatherDay[];
	/** Temperatura del agua del mar, si la hay. */
	sea: number | null;
}

export interface WeatherData {
	places: WeatherPlace[];
}

// ---------- Cripto (CoinGecko) ----------

export interface Coin {
	id: string;
	symbol: string;
	name: string;
	usd: number;
	eur: number;
	change24h: number | null;
	marketCap: number | null;
}

export interface CryptoData {
	coins: Coin[];
}

// ---------- Curva de tipos del Tesoro de EE. UU. ----------

export interface YieldCurveData {
	tenors: string[];
	/** Una fila por día, del más antiguo al más reciente. */
	days: { date: string; values: (number | null)[] }[];
}
