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

/** Inflación del G20 (scripts/sources/oecd.ts): series de la OCDE y de dónde salieron en esta descarga. */
export interface G20Data extends SeriesData {
	via: 'oecd' | 'dbnomics';
}

// ---------- Previsiones del FMI (World Economic Outlook) ----------

export interface ImfRow {
	/** Código del FMI: USA, EURO, WEOWORLD… */
	code: string;
	name: string;
	/** Crecimiento del PIB real (%) en [año, año + 1]; null si el FMI no lo da. */
	gdp: [number | null, number | null];
	/** Inflación media (%) en [año, año + 1]. */
	cpi: [number | null, number | null];
}

/** Un país del G20 en el año en curso (estimación del WEO), para la tabla ECST. Todo en %. */
export interface ImfCountry {
	/** Código del FMI (ISO de 3 letras: USA, DEU…). */
	code: string;
	name: string;
	/** Crecimiento del PIB real, inflación media y paro. */
	gdp: number | null;
	cpi: number | null;
	unemployment: number | null;
	/** Deuda pública bruta y saldo público (negativo = déficit), en % del PIB. */
	debt: number | null;
	balance: number | null;
}

export interface ImfData {
	/** Edición del WEO en español («octubre de 2026»); null si la API no la dice. */
	edition: string | null;
	/** Los dos años de la tabla: [año actual, siguiente]. */
	years: [number, number];
	rows: ImfRow[];
	/** Los países del G20 (y España, invitada permanente) en el año en curso. */
	g20?: ImfCountry[];
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

/** Una disposición en la semana del BOE: sin enlaces, que salen del id (ver src/lib/boe.ts). */
export interface BoeWeekItem {
	id: string;
	title: string;
	dept: string;
	epigraph: string;
}

/** Un sumario de la semana (static/data/boe-week.json, lo carga BOE al elegir «Semana»). */
export interface BoeWeekDay {
	/** «2026-10-14» */
	date: string;
	number: string;
	sections: { code: string; name: string; total: number; items: BoeWeekItem[] }[];
}

/** Los sumarios de los últimos 7 días, del más reciente al más antiguo. */
export interface BoeWeek {
	days: BoeWeekDay[];
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
	/** 'en' si el medio publica en inglés (scripts/sources/news.ts). */
	lang?: 'en';
	/** El titular traducido al español (scripts/translate.ts), si lo hay. */
	titleEs?: string;
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

// ---------- Modelos en tendencia (Hugging Face) ----------

export interface HfModel {
	/** «autor/modelo», como en la URL de Hugging Face. */
	id: string;
	author: string;
	name: string;
	/** Tarea en inglés, tal como la da Hugging Face («text-generation»…): la vista la traduce. */
	task: string;
	likes: number;
	/** Descargas del último mes. */
	downloads: number;
	url: string;
	/** Cuándo se creó (ISO 8601), o vacío. */
	created: string;
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

// ---------- Precio de la luz en Europa (Energy-Charts y REE) ----------

/** Media diaria del mercado mayorista en una zona de precio («DE-LU»), en €/MWh. */
export interface EuPowerZone {
	/** Zona de precio del mercado europeo: «DE-LU», «FR», «IT-North»… */
	zone: string;
	/** País (ISO2) al que corresponde, para enlazar con PAIS. */
	country: string;
	/** Nombre en español: «Alemania y Luxemburgo», «Italia (norte)». */
	name: string;
	/** Media de hoy y de mañana (día de Madrid); null si aún no se conoce o el día está incompleto. */
	today: number | null;
	tomorrow: number | null;
	/** Quién lo publica: «Energy-Charts / SMARD» o «REE» (España). */
	source: string;
}

export interface EuPowerData {
	/** Día de «hoy» (Madrid): «2026-10-14». */
	date: string;
	zones: EuPowerZone[];
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
	/** Variación en 7 días (%). Opcional: las copias antiguas no la traen. */
	change7d?: number | null;
	marketCap: number | null;
}

export interface CryptoData {
	coins: Coin[];
	/** Cierre diario de bitcoin en dólares (hora de Madrid), hasta 400 días. Para el termómetro de riesgo. */
	btcHistory?: { date: string; usd: number }[];
}

// ---------- Curva de tipos del Tesoro de EE. UU. ----------

export interface YieldCurveData {
	tenors: string[];
	/** Una fila por día, del más antiguo al más reciente. */
	days: { date: string; values: (number | null)[] }[];
}

/** VIX y su curva (scripts/sources/vix.ts), con el VVIX y el SKEW de Cboe: último cierre y el anterior. */
export interface VixData extends YieldCurveData {
	vvix?: { date: string; value: number; previous: number | null } | null;
	skew?: { date: string; value: number; previous: number | null } | null;
}

// ---------- Subastas de deuda de EE. UU. (Fiscal Data) ----------

export interface Auction {
	/** Día de la subasta (AAAA-MM-DD). */
	date: string;
	/** Plazo: «10-Year», «29-Year 10-Month» (reaperturas)… */
	term: string;
	/** «Note», «Bond» o «FRN» (tipo flotante). */
	kind: string;
	reopening: boolean;
	/** Importe ofrecido, en dólares. */
	offering: number | null;
	/** Rentabilidad máxima adjudicada (%). Null si aún no se ha hecho. */
	highYield: number | null;
	bidToCover: number | null;
	/** Parte adjudicada a postores indirectos (bancos centrales y fondos extranjeros, sobre todo), en %. */
	indirectPct: number | null;
	/** Media del bid-to-cover de las 6 subastas anteriores del mismo plazo y tipo. */
	avgBidToCover?: number | null;
}

export interface AuctionsData {
	/** Anunciadas y pendientes, de la más cercana a la más lejana. */
	upcoming: Auction[];
	/** Las últimas 10 hechas, de la más reciente a la más antigua. */
	recent: Auction[];
}

// ---------- Wikipedia: lo más leído y efemérides ----------

export interface WikiPage {
	title: string;
	url: string;
	extract: string;
	views?: number;
}

/** Lo del día en una Wikipedia (español o inglés). */
export interface WikiEdition {
	/** Artículo destacado del día, si lo hay. */
	featured: WikiPage | null;
	mostRead: WikiPage[];
	onThisDay: { year: number; text: string; url: string }[];
	/** «In the news» (solo la Wikipedia en inglés lo tiene en el feed). */
	news?: { text: string; url: string }[];
}

/** Arriba, la Wikipedia en español; en `en`, la inglesa (si respondió). */
export interface WikiData extends WikiEdition {
	date: string;
	en?: WikiEdition;
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

/** Salida a bolsa del calendario de Finnhub. */
export interface Ipo {
	/** «2026-10-14» */
	date: string;
	/** Puede venir vacío si aún no tiene. */
	symbol: string;
	name: string;
	exchange: string;
	/** Precio o horquilla en $, tal cual lo da Finnhub: «18.00» o «18.00-20.00». Vacío si no se sabe. */
	price: string;
	shares: number | null;
	/** Importe de la colocación, en $. */
	value: number | null;
	/** expected: prevista · priced: con precio fijado · filed: registrada. */
	status: string;
}

/**
 * Rentabilidad por plazos de cada valor (static/data/perf.json), en %. Claves de Finnhub sin el
 * «PriceReturnDaily»: «5Day», «13Week», «26Week», «52Week», «yearToDate», «monthToDate»…
 */
export interface PerfData {
	symbols: Record<string, Record<string, number>>;
}

export interface FinnhubData {
	earnings: Earnings[];
	news: NewsItem[];
	quotes: Quote[];
	/** Las copias guardadas antes de añadir las salidas a bolsa no lo tienen. */
	ipos?: Ipo[];
}

// ---------- Ficha de valor: analistas, resultados y directivos (Finnhub) ----------

/** Recomendaciones de los analistas en un mes (cuántos dicen cada cosa). */
export interface AnalystRecs {
	/** Mes de la encuesta: «2026-10-01». */
	period: string;
	strongBuy: number;
	buy: number;
	hold: number;
	sell: number;
	strongSell: number;
}

/** Beneficio por acción de un trimestre: lo esperado y lo que salió. */
export interface EarningsSurprise {
	/** Fin del trimestre: «2026-06-30». */
	period: string;
	actual: number | null;
	estimate: number | null;
	/** Sorpresa en %, positiva si superó lo esperado. */
	surprisePct: number | null;
}

/** Compra o venta de acciones de un directivo (formulario 4 de la SEC). */
export interface InsiderTrade {
	name: string;
	/** Acciones compradas (+) o vendidas (−). */
	change: number;
	price: number | null;
	/** Fecha de la operación (ISO, día). */
	date: string;
	/** 'P' compra, 'S' venta. */
	code: 'P' | 'S';
}

/** Precio objetivo medio de los analistas (solo si el plan de Finnhub lo da). */
export interface PriceTarget {
	mean: number | null;
	high: number | null;
	low: number | null;
	/** Cuándo lo actualizó Finnhub (ISO). */
	updated: string | null;
}

export interface StockAnalysis {
	/** Cuándo se descargó este valor (ISO): se refresca a las 24 h. */
	fetchedAt: string;
	/** Los últimos meses, del más reciente al más antiguo. */
	recs: AnalystRecs[];
	/** Los últimos trimestres, del más reciente al más antiguo. */
	surprises: EarningsSurprise[];
	/** Compras y ventas de directivos en los últimos 90 días, de la más reciente a la más antigua. */
	insiders: InsiderTrade[];
	target?: PriceTarget;
}

/** Por código del valor («NVDA»). */
export type AnalystsData = Record<string, StockAnalysis>;

// ---------- Mercados de predicción (Polymarket) ----------

export interface Prediction {
	id: string;
	title: string;
	url: string;
	/** Volumen negociado en 24 h, en dólares. */
	volume24h: number;
	endDate: string;
	/**
	 * Opciones con su probabilidad implícita (0–1), de más a menos probable, y `d`, cuánto ha cambiado en
	 * 24 h (en tanto por uno: 0,05 = 5 puntos), si Polymarket lo da.
	 */
	outcomes: { label: string; p: number; d?: number }[];
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

// ---------- Carteras 13F de grandes fondos (SEC) ----------

/** Una posición de la cartera, sumadas todas sus líneas del 13F (por CUSIP). */
export interface FundPosition {
	cusip: string;
	/** Emisor, como lo escribe el fondo («Apple Inc»). */
	name: string;
	/** Valor declarado, en dólares. */
	value: number;
	/** Acciones (o nominal, en los bonos). */
	shares: number;
	/** Peso en la cartera declarada (0–1). */
	weight: number;
	/** Opciones: el valor es el del subyacente. */
	putCall?: 'Put' | 'Call';
}

/** Compra o venta frente al trimestre anterior. */
export interface FundMove {
	cusip: string;
	name: string;
	putCall?: 'Put' | 'Call';
	/** Cambio en acciones (negativo si vende). */
	shares: number;
	/** Ese cambio valorado al precio del trimestre, en dólares (negativo si vende). */
	value: number;
	/** Cambio relativo de acciones (0,25 = +25 %); null si la posición es nueva. */
	pct: number | null;
	/** new: posición nueva · exit: la vende entera · add: compra más · trim: vende parte. */
	status: 'new' | 'exit' | 'add' | 'trim';
}

export interface Fund {
	/** Clave corta: «BRK», «ARK»… */
	key: string;
	name: string;
	manager: string;
	cik: string;
	/** Nombre oficial en la SEC. */
	filer: string;
	/** Fin del trimestre declarado: «2026-06-30». */
	period: string;
	/** Fecha de presentación. */
	filed: string;
	/** Índice del expediente en sec.gov. */
	url: string;
	/** Valor total declarado, en dólares. */
	total: number;
	/** Número de posiciones. */
	count: number;
	/** Las 10 mayores. */
	top: FundPosition[];
	/** Trimestre anterior, si se ha podido leer. Sin él, bought y sold van vacíos. */
	prev?: { period: string; total: number };
	/** Las 5 mayores compras y ventas por valor. */
	bought: FundMove[];
	sold: FundMove[];
}

export interface FundsData {
	funds: Fund[];
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

/** Reserva de agua de los embalses de España en una semana. */
export interface WaterBasin {
	name: string;
	hm3: number;
	capacity: number;
	pct: number;
}
export interface WaterData {
	/** Semana del dato: «2026-10-13». */
	date: string;
	/** Agua embalsada y capacidad total, en hm³. */
	hm3: number;
	capacity: number;
	/** % de llenado. */
	pct: number;
	/** % de la misma semana hace un año y media de esa semana en los 10 años anteriores. */
	yearAgo: number;
	avg10: number;
	/** % semanal de los últimos 10 años. */
	history: Point[];
	/** Cuencas (ámbitos) en la última semana, de menos a más llena. */
	basins: WaterBasin[];
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

/** El titular de un medio dentro de un tema. */
export interface ImpLink {
	source: string;
	url: string;
}

/** Un tema importante, tal como se guarda en el histórico diario: lo mínimo para listarlo. */
export interface ImpEntry {
	/** Clave estable del tema entre pasadas y días (para desduplicar). */
	k: string;
	title: string;
	/** 'en' si el titular está en inglés, y su traducción (scripts/translate.ts). */
	lang?: 'en';
	titleEs?: string;
	url: string;
	/** Medios distintos que lo dan. */
	sources: string[];
	/** Puntuación (ver scripts/sources/imp.ts). */
	score: number;
	/** Secciones de titulares donde aparece (claves de NEWS_SECTIONS). En el histórico, desde M9. */
	sections?: string[];
	/** El enlace de cada medio. Solo en el top de ahora y en el día de hoy (no en días anteriores). */
	links?: ImpLink[];
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

// ---------- Índice de búsqueda de la barra (static/data/search.json) ----------

/** Una entrada del índice: título, enlace y etiqueta. Nombres de una letra para que pese poco. */
export interface SearchEntry {
	/** Título (recortado). */
	t: string;
	/** Enlace: externo (https://…) o interno de la web («/s?sym=NVDA», sin la base). */
	u: string;
	/** Etiqueta que se ve en la barra: NEWS, BOE o Valor. */
	s: 'NEWS' | 'BOE' | 'Valor';
}

// ---------- Rutas marítimas clave (IMF PortWatch) ----------

export interface Chokepoint {
	/** «chokepoint6» */
	id: string;
	/** En español: «Ormuz». */
	name: string;
	/** Último día con datos (AAAA-MM-DD). */
	last: string;
	/** Media de tránsitos diarios de los últimos 7 días. */
	avg7: number;
	/** La misma media, un año antes. */
	avg7PrevYear: number | null;
	/** Cambio en % frente al año anterior. */
	change: number | null;
	/** Media móvil de 7 días de los últimos 90 días, para el minigráfico. */
	spark: number[];
}

// ---------- Próximas elecciones (Wikidata) ----------

/** general: generales o legislativas · presidential: presidenciales · referendum: referéndum. */
export type ElectionKind = 'general' | 'presidential' | 'referendum';

export interface Election {
	/** Día de la votación (AAAA-MM-DD). */
	date: string;
	/** Nombre del país, en español (o en inglés si Wikidata no lo tiene en español). */
	country: string;
	/** Código ISO 3166-1 alfa-2 del país («ES»), si Wikidata lo tiene. */
	iso: string | null;
	kind: ElectionKind;
	/** Nombre de la elección, en español o inglés. */
	name: string;
	/** Ficha en Wikidata. */
	url: string;
}

export interface ElectionsData {
	items: Election[];
}

// ---------- Barcos en los puertos (AIS, aisstream.io) ----------

export interface Ship {
	/** Identificador AIS del barco (MMSI). */
	mmsi: number;
	name: string;
	/** Tipo en español («Pasaje», «Carga»…), si el barco ha enviado sus datos fijos. */
	type: string;
	/** Velocidad en nudos. */
	speed: number | null;
	/** «Amarrado», «Fondeado», «Navegando»… según el estado AIS y la velocidad. */
	status: string;
	destination: string;
	lat: number;
	lon: number;
	/** Última posición recibida (ISO 8601). */
	time: string;
}

export interface PortShips {
	id: string;
	name: string;
	/** Barcos detectados; `ships` trae solo los más recientes. */
	total: number;
	ships: Ship[];
}

export interface ShipsData {
	ports: PortShips[];
	/** Segundos que estuvo escuchando la última pasada. */
	listened: number;
}

// ---------- Sanciones y aranceles (Federal Register) ----------

export interface TradeDoc extends FedRegDoc {
	/** Organismo, abreviado: «OFAC», «USTR», «ITA». */
	agency: string;
	/** «Sanciones» o «Aranceles». */
	topic: string;
}

// ---------- Líderes: agenda de hoy (LIDER) ----------

export interface AgendaEvent {
	/** Cuándo empieza (ISO 8601, UTC), o null si la agenda no da hora. */
	start: string | null;
	/** Día de la agenda en la zona del propio líder (AAAA-MM-DD). */
	date: string;
	title: string;
	place: string;
}

export interface LeaderAgenda {
	/** «sanchez», «trump»… (ver src/lib/leaders.ts). */
	id: string;
	/** Actos de ayer a pasado mañana; null si la agenda no se ha podido leer. */
	events: AgendaEvent[] | null;
	/** De dónde sale la agenda. */
	source: { name: string; url: string };
	error?: string;
}

/** Una vulnerabilidad del catálogo KEV de la CISA (fallos que ya se están explotando). */
export interface KevItem {
	/** «CVE-2026-12345». */
	cveID: string;
	vendorProject: string;
	product: string;
	vulnerabilityName: string;
	/** Día en que la CISA la añadió al catálogo (AAAA-MM-DD). */
	dateAdded: string;
	/** La CISA sabe que se usa en campañas de ransomware (knownRansomwareCampaignUse === 'Known'). */
	ransomware: boolean;
}

export interface KevData {
	/** Las 10 añadidas más recientemente. */
	items: KevItem[];
	/** Cuántas hay en todo el catálogo. */
	total: number;
	/** Día UTC de la descarga (AAAA-MM-DD), que es el día de la CISA: al que se refiere `today`. */
	day: string;
	/** Cuántas se añadieron ese día. */
	today: number;
}

/** Tormentas solares (NOAA Space Weather Prediction Center). Escalas de 0 a 5; 0 es «sin tormenta». */
export interface SwpcData {
	/** Índice Kp planetario más reciente (0–9) y cuándo se midió (ISO 8601, UTC). */
	kp: number | null;
	kpAt: string | null;
	/** Kp de las últimas 24 h (cada 3 h), del más antiguo al más reciente. */
	kp24: { t: string; v: number }[];
	/** Escalas actuales: G (tormenta geomagnética), S (radiación solar), R (apagones de radio). */
	g: number | null;
	s: number | null;
	r: number | null;
	/** La escala G más alta prevista para los próximos días, y para qué día (AAAA-MM-DD). */
	gForecast: number | null;
	gForecastDate: string | null;
}

// ---------- Diario Oficial de la UE, serie L (scripts/sources/eurlex.ts) ----------

export type EuLexType = 'Reglamento' | 'Directiva' | 'Decisión' | 'Otro';

/** Un acto de la serie L del Diario Oficial de la UE. */
export interface EuLexDoc {
	/** Número CELEX: «32026R1753». */
	id: string;
	/** Título oficial, en inglés. */
	title: string;
	type: EuLexType;
	/** Temas (Sanciones, Aranceles, Energía…), por palabras del título. */
	tags: string[];
	/** Día de publicación: «2026-10-14». */
	date: string;
	/** Ficha en EUR-Lex, en español. */
	url: string;
}

// ---------- Archivo de titulares (scripts/sources/archive.ts) ----------

/** Un titular archivado. Claves cortas: un mes son miles. */
export interface ArchiveEntry {
	/** Titular. */
	t: string;
	/** Medio. */
	s: string;
	/** Hora UTC al minuto: «2026-10-14T14:05Z». */
	d: string;
	/** Enlace. */
	u: string;
}

/** Índice del archivo (news-archive.json). Cada mes está en news-archive/AAAA-MM.json. */
export interface NewsArchive {
	/** Del más reciente al más antiguo. */
	months: { month: string; count: number; bytes: number }[];
}

// ---------- Avisos de viaje (Departamento de Estado de EE. UU.) ----------

/** El aviso de viaje de un país: nivel 1 (precauciones normales) a 4 (no viajar). */
export interface TravelAdvisory {
	/** Nombre del país en inglés, tal como lo da el título («Ukraine»). Se cruza con PAIS por nombre. */
	name: string;
	level: 1 | 2 | 3 | 4;
	/** Título completo: «Ukraine - Level 4: Do Not Travel». */
	title: string;
	url: string;
	/** Última actualización del aviso (ISO 8601). */
	updated: string;
	/** Si el nivel ha cambiado desde que la terminal lo sigue: el anterior y cuándo se vio el cambio. */
	prevLevel?: 1 | 2 | 3 | 4;
	changedAt?: string;
}

export interface AdvisoriesData {
	items: TravelAdvisory[];
}

// ---------- Calendarios de publicación: próximo dato (Eurostat, BLS, INE) ----------

export interface ReleaseEvent {
	/** Inicio en ISO UTC. */
	date: string;
	/** Si el organismo no da la hora. */
	allDay: boolean;
	title: string;
	/** Organismo: BEA (PIB y PCE), DOL (paro semanal) y Fed (H.4.1) llegan, como el BLS, con las fechas de FRED. */
	source: 'Eurostat' | 'BLS' | 'INE' | 'BEA' | 'DOL' | 'Fed';
	/** Tema (src/lib/nextrelease.ts) si es uno de los datos que enseña la terminal, o null. */
	topic: string | null;
	url?: string;
}

export interface ReleaseCalData {
	/** Próximas publicaciones de los datos que enseña la terminal (con tema), por fecha. */
	events: ReleaseEvent[];
	/** Las publicadas en los últimos 8 días (de la copia anterior), por fecha: para el resumen SEMANA. */
	past?: ReleaseEvent[];
}

// ---------- NOVEDADES: lo fusionado en Arc Terminal (PR de GitHub) ----------

export interface Change {
	/** Número del PR. */
	number: number;
	title: string;
	/** Cuándo se fusionó (ISO 8601). */
	mergedAt: string;
	url: string;
}

export interface ChangesData {
	/** Lo fusionado en los últimos 7 días, de lo más reciente a lo más antiguo. */
	items: Change[];
}

// ---------- Señales de riesgo: GDACS, IODA y OMS (scripts/sources/gdacs.ts, ioda.ts y who.ts) ----------

/** Alerta naranja o roja de catástrofe de GDACS (ONU y Comisión Europea). */
export type GdacsType = 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF';

export interface GdacsEvent {
	/** Tipo y número de evento de GDACS, p. ej. «EQ1501234». Estable entre episodios. */
	id: string;
	type: GdacsType;
	/** Nombre del tipo en español. */
	kind: string;
	level: 'orange' | 'red';
	name: string;
	country: string;
	/** Fecha de inicio, fin y última actualización, en ISO (UTC). */
	from: string | null;
	to: string | null;
	updated: string | null;
	/** Texto de gravedad de GDACS, p. ej. «Magnitude 7.1M, Depth:10km». */
	severity: string;
	/** Puntuación de alerta de GDACS (0–3 aprox.): sirve para ordenar dentro de un mismo nivel. */
	score: number | null;
	lat: number | null;
	lon: number | null;
	url: string;
}

/** Caída de internet de un país según IODA. */
export interface IodaOutage {
	/** Código ISO del país (p. ej. «IR»). */
	code: string;
	name: string;
	/** El peor nivel de las señales que siguen en alerta. */
	level: 'critical' | 'warning';
	/** Señales en alerta ahora: «bgp», «ping-slash24», «merit-nt»… */
	signals: string[];
	/** Primera alerta de la racha actual y la última, en ISO (UTC). */
	since: string;
	last: string;
	/** Cuánto ha caído la peor señal frente a lo normal, en % (p. ej. 85 = queda el 15 %). */
	drop: number | null;
	url: string;
}

/** Parte de brote de la OMS (Disease Outbreak News). */
export interface OutbreakNews {
	/** Identificador del parte, p. ej. «2026-DON590». */
	id: string;
	title: string;
	/** Fecha de publicación en ISO (UTC). */
	date: string | null;
	/** Primeras frases del resumen, en texto plano. */
	summary: string;
	url: string;
}

// ---------- Demanda eléctrica en tiempo real (REE, scripts/sources/ree-demand.ts) ----------

export interface DemandPoint {
	/** Hora del dato en ISO (UTC). */
	time: string;
	real: number | null;
	forecast: number | null;
}

export interface DemandData {
	/** Último dato con demanda real y su prevista, en MW. */
	time: string;
	real: number;
	forecast: number | null;
	scheduled: number | null;
	/** Cuánto está la real por debajo (+) o por encima (−) de la prevista, en %. */
	gap: number | null;
	/** Las dos últimas horas, para ver si la caída es brusca o progresiva. */
	recent: DemandPoint[];
}

// ---------- Refugiados y desplazados (ACNUR, scripts/sources/unhcr.ts) ----------

export interface UnhcrCountry {
	/** ISO 3166-1 alfa-3: «SYR». */
	iso3: string;
	/** Nombre en inglés, como lo da ACNUR. */
	name: string;
	/** Refugiados y solicitantes de asilo originarios del país. */
	from: number;
	/** Refugiados y solicitantes de asilo acogidos en el país. */
	hosted: number;
	/** Desplazados internos. */
	idps: number;
}

export interface UnhcrData {
	/** Año del dato (fin de año). */
	year: number;
	countries: UnhcrCountry[];
}

// ---------- Asteroides que pasan cerca de la Tierra (NASA JPL CNEOS, scripts/sources/neo.ts) ----------

export interface NeoPass {
	/** Designación: «2026 TP6». */
	des: string;
	/** Momento de máximo acercamiento, en ISO (UTC). */
	date: string;
	/** Distancia mínima en distancias lunares (1 = 384 400 km). */
	ld: number;
	/** Velocidad relativa, en km/s. */
	speed: number | null;
	/** Tamaño en metros: el medido si lo hay; si no, la horquilla que sale de su brillo (albedo 0,25 a 0,05). */
	size: { min: number; max: number; measured: boolean } | null;
// ---------- Red de bitcoin (mempool.space, scripts/sources/bitcoin.ts) ----------

export interface BitcoinNet {
	/** Comisión para entrar en el próximo bloque, en sat/vB. */
	feeFast: number | null;
	/** La del tercer bloque (unos 30 min). */
	feeHalfHour: number | null;
	/** Transacciones esperando (mempool) y su tamaño en vMB. */
	mempoolTx: number | null;
	mempoolVmb: number | null;
	/** Potencia de minado, en EH/s. */
	hashrate: number | null;
	/** Altura del último bloque. */
	height: number;
	/** Próximo halving: su altura, bloques que faltan y fecha estimada (10 min por bloque). */
	halving: { height: number; blocks: number; date: string };
// ---------- Inseguridad alimentaria aguda (FEWS NET, scripts/sources/fewsnet.ts) ----------

export interface FoodInsecurity {
	/** ISO 3166-1 alfa-2: «SO». */
	code: string;
	/** Nombre en inglés, como lo da FEWS NET. */
	country: string;
	/** Personas en fase IPC 3 o peor («crisis» o más), horquilla de FEWS NET. */
	low: number;
	high: number;
	/** Periodo al que se refiere: «2026-08-01» a «2026-09-30». */
	from: string;
	to: string;
	/** Situación actual, proyección o picos de necesidad del año. */
	scenario: string;
	/** Frente a hace un año: «Higher», «Similar», «Lower»… si lo da. */
	vsYear: string | null;
}
