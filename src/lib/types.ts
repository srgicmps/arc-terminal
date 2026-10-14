// Forma de los datos de static/data/*.json. La comparten los scripts que los descargan (scripts/sources/)
// y las vistas que los muestran.
import type { SeaState, SunDay } from './weather.ts';

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
	/** La misma noticia en otros medios (scripts/cluster.ts), sin el de `source`. */
	also?: { source: string; url: string }[];
}

/** Cómo fue la última descarga de cada canal RSS de una sección. */
export interface FeedStatus {
	name: string;
	/** true si el canal respondió con al menos un titular. */
	ok: boolean;
	/** Titulares que se han guardado de este canal. */
	items: number;
	/** Resumen corto del fallo («HTTP 404», «tiempo agotado», «XML no válido»…), sin URL. */
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

// ---------- Papers del día (Hugging Face) ----------

export interface Paper {
	/** Identificador de arXiv, p. ej. «2510.01234». */
	id: string;
	title: string;
	/** Primeros autores, ya abreviados («A. Pérez, B. Li et al.»). */
	authors: string;
	upvotes: number;
	comments: number;
	/** Página del paper en Hugging Face. */
	url: string;
	arxiv: string;
	/** Cuándo salió en la lista diaria (ISO 8601). */
	time: string;
	summary: string;
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

export interface PowerDay {
	date: string;
	/** Media diaria del PVPC, en €/kWh. */
	avg: number;
	min: number;
	max: number;
}

export interface PowerData {
	pvpc: PricePoint[];
	spot: PricePoint[];
	/** Historial diario que va acumulando la propia web. */
	history?: PowerDay[];
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
	/** Salida y puesta del sol de hoy (puede faltar en copias antiguas). */
	sun?: SunDay | null;
}

export interface WeatherData {
	places: WeatherPlace[];
	/** Oleaje en las costas norte y sur de Menorca (puede faltar en copias antiguas). */
	coasts?: SeaState[];
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

// ---------- Wikipedia: lo más leído y efemérides ----------

export interface WikiPage {
	title: string;
	url: string;
	extract: string;
	views?: number;
}

export interface WikiData {
	date: string;
	/** Artículo destacado del día, si lo hay. */
	featured: WikiPage | null;
	mostRead: WikiPage[];
	onThisDay: { year: number; text: string; url: string }[];
}

// ---------- Riesgos naturales: huracanes (NOAA) y eventos (NASA EONET) ----------

export interface Storm {
	id: string;
	name: string;
	/** HU huracán, TS tormenta tropical, TD depresión… */
	classification: string;
	/** Viento máximo sostenido, en nudos. */
	knots: number;
	pressure: number;
	lat: number;
	lon: number;
	updated: string;
	url: string;
}

export interface NaturalEvent {
	id: string;
	title: string;
	category: string;
	date: string;
	url: string;
	lat: number;
	lon: number;
	magnitude: string;
}

export interface HazardsData {
	storms: Storm[];
	events: NaturalEvent[];
}

// ---------- Finnhub: resultados, noticias y cotizaciones ----------

export interface Earnings {
	/** «2026-10-14» */
	date: string;
	symbol: string;
	/** bmo: antes de la apertura · amc: tras el cierre · dmh: durante la sesión · vacío: sin hora. */
	hour: string;
	quarter: number | null;
	year: number | null;
	epsEstimate: number | null;
	epsActual: number | null;
	revenueEstimate: number | null;
	revenueActual: number | null;
}

export interface Quote {
	symbol: string;
	price: number;
	change: number | null;
	/** Variación del día, en %. */
	changePct: number | null;
	prevClose: number | null;
	/** ISO 8601 de la última cotización. */
	time: string | null;
}

export interface FinnhubData {
	earnings: Earnings[];
	news: NewsItem[];
	quotes: Quote[];
}

// ---------- Mercados de predicción (Polymarket) ----------

export interface Prediction {
	id: string;
	title: string;
	url: string;
	/** Volumen negociado en 24 h, en dólares. */
	volume24h: number;
	endDate: string;
	/** Opciones con su probabilidad implícita (0–1), de más a menos probable. */
	outcomes: { label: string; p: number }[];
}

export interface PredictionsData {
	geopolitics: Prediction[];
	economy: Prediction[];
	/** Decisiones de tipos de interés (etiqueta «fed-rates»). Opcional: las copias antiguas no lo traen. */
	rates?: Prediction[];
}

// ---------- Documentos presentados en la SEC (EDGAR) ----------

export interface SecFiling {
	/** Formulario: «8-K», «10-Q», «10-K», «4», «6-K», «20-F» (o su enmienda «/A»). */
	form: string;
	/** Fecha de presentación: «2026-10-14». */
	date: string;
	/** Qué es, en castellano (en los 8-K, los apartados que comunica). */
	desc: string;
	/** Documento principal en sec.gov/Archives. */
	url: string;
}

export interface SecCompany {
	cik: string;
	/** Nombre oficial en la SEC. */
	name: string;
	/** Del más reciente al más antiguo. */
	filings: SecFiling[];
}

/** Por símbolo de la terminal: «NVDA», «BRK.B»… */
export interface SecData {
	companies: Record<string, SecCompany>;
}

/** Un grupo de tecnologías del mix eléctrico (Eólica, Solar…). */
export interface MixGroup {
	key: 'wind' | 'solar' | 'hydro' | 'nuclear' | 'gas' | 'other';
	label: string;
	mwh: number;
	/** Parte del total, de 0 a 1. */
	share: number;
	/** Tecnologías de REE que entran en el grupo. */
	techs: string[];
}
/** De dónde sale la electricidad un día en un sistema eléctrico (España, Baleares). */
export interface PowerMix {
	id: string;
	label: string;
	/** Día del dato: «2026-10-14». */
	date: string;
	mwh: number;
	/** Parte renovable, de 0 a 1. */
	renewable: number;
	/** Toneladas de CO₂ equivalente del día, si REE las publica. */
	co2: number | null;
	groups: MixGroup[];
}
export interface PowerMixData {
	systems: PowerMix[];
}

/** Un festivo: nacional (ES) o de Baleares (IB). */
export interface Holiday {
	/** «2026-12-08» */
	date: string;
	name: string;
	scope: 'ES' | 'IB';
}
export interface HolidaysData {
	items: Holiday[];
}

// ---------- Versiones de herramientas (releases de GitHub) ----------

export interface Release {
	/** «vuejs/core» */
	repo: string;
	/** Nombre para enseñar: «Vue». */
	name: string;
	/** Versión sin prefijos: «3.5.22». */
	version: string;
	/** Cuándo se publicó (ISO 8601), si el feed lo dice. */
	time: string | null;
	/** Página de la release en GitHub, con las notas. */
	url: string;
}

// ---------- Lo más importante (IMP, scripts/sources/imp.ts) ----------

/** Un tema importante, tal como se guarda en el histórico diario: lo mínimo para listarlo. */
export interface ImpEntry {
	/** Clave estable del tema entre pasadas y días (para desduplicar). */
	k: string;
	title: string;
	url: string;
	/** Medios distintos que lo dan. */
	sources: string[];
	/** Puntuación (ver scripts/sources/imp.ts). */
	score: number;
}

/** Un tema del top actual, con el detalle de la puntuación. */
export interface ImpCurrent extends ImpEntry {
	/** Secciones de titulares donde aparece (claves de NEWS_SECTIONS). */
	sections: string[];
	/** Desde cuándo lo vemos (ISO 8601). */
	first: string;
	/** Hora del titular más reciente (ISO 8601). */
	time: string | null;
	/** Fuente oficial que lo confirma (La Moncloa, BOE, Federal Register…), si la hay. */
	official?: string;
	/** Sale en «In the news» de la Wikipedia en inglés. */
	wiki?: true;
}

/** Lo que recuerda imp.ts de cada tema entre pasadas, para saber cuánto tiempo lleva vivo. */
export interface ImpSeen {
	k: string;
	/** Primera y última vez que se vio (ISO 8601). */
	first: string;
	last: string;
	title: string;
	/** Enlaces normalizados del grupo (para reconocerlo aunque cambie el titular principal). */
	urls: string[];
}

export interface ImpData {
	/** Día en Madrid de este cálculo: «2026-10-14». */
	date: string;
	current: ImpCurrent[];
	/** Top 10 de cada día (lo máximo que alcanzó cada tema ese día), el último año. */
	days: { date: string; items: ImpEntry[] }[];
	seen: ImpSeen[];
}

// ---------- Crisis y desastres activos (ReliefWeb, OCHA) ----------

export interface Disaster {
	id: string;
	/** «Afghanistan: Floods - Oct 2026» */
	name: string;
	/** País principal, en inglés como lo da ReliefWeb. */
	country: string;
	/** Tipo principal en inglés («Flood», «Epidemic»…): la vista lo traduce. */
	type: string;
	/** Cuándo empezó (ISO 8601). */
	date: string | null;
	/** Ficha en ReliefWeb, con los informes y sus fuentes originales. */
	url: string;
	/** Código GLIDE del desastre, si lo tiene. */
	glide: string;
}
