// Lo que cuenta el MANUAL (src/routes/manual) y que no es de un comando: sin conexión, Tu sitio,
// personalización, avisos al móvil, ajedrez y preguntas frecuentes. Solo datos y funciones puras.
// La parte de los avisos sale de scripts/alerts/config.ts: si cambia un cupo o un umbral, cambia aquí.
import {
	AI_NEWS,
	DAILY_TOTAL,
	DIESEL,
	IMP_BIG,
	KEEP_DAYS,
	LAUNCHES,
	LUZ,
	POLYMARKET,
	QUAKE,
	QUOTAS,
	RATES,
	STOCKS,
	STRAITS,
	SUMMARIES,
	WAR,
	WEEK,
	type Level
} from '../../scripts/alerts/config.ts';
import { norm } from './cmdline.ts';
import type { Command } from './commands.ts';

/** Un bloque de texto del manual: párrafos y, si hace falta, una lista. */
export interface GuideSection {
	id: string;
	title: string;
	paras: string[];
	items?: string[];
}

export const OFFLINE: GuideSection = {
	id: 'sin-conexion',
	title: 'Sin conexión e instalar en el móvil',
	paras: [
		'Arc Terminal se puede instalar como una app: en el móvil, «Añadir a pantalla de inicio» desde el menú del navegador (en el iPhone, desde Compartir en Safari).',
		'Sin conexión sigue funcionando con la última copia guardada: la portada siempre, y cada vista que hayas abierto antes. Arriba sale «Sin conexión» mientras dure.',
		'Las cotizaciones y gráficos de TradingView, el tiempo de tu sitio y otros datos en directo necesitan red.',
		'Cuando la web se publica de nuevo con datos frescos, sale el aviso «Hay datos nuevos · Recargar».'
	]
};

export const PLACE: GuideSection = {
	id: 'tu-sitio',
	title: 'Tu sitio',
	paras: [
		'El chip de la cabecera con un pin («Madrid · cambiar») elige tu sitio: busca una ciudad, usa tu ubicación o toca uno de tus favoritos (hasta 5).',
		'Tu sitio lo usan WX (tiempo, aire, mar, sol y luna), la portada y el reloj. Se guarda solo en este navegador.',
		'Desde la barra: «LUGAR Tokio» busca la ciudad y la deja como tu sitio.'
	]
};

export const PERSONAL: GuideSection = {
	id: 'personalizacion',
	title: 'Personalización',
	paras: ['Todo se guarda en este navegador: en otro dispositivo empiezas de cero.'],
	items: [
		'Tema: el botón ◐ de la cabecera cambia entre automático (sigue al sistema), de día y de noche.',
		'Encajar en la pantalla (⤢): en pantallas grandes, la vista llena el alto y cada panel tiene su propio scroll.',
		'Portada modular (▦, solo en TOP): oculta, ordena y ensancha los paneles de la portada.',
		'Idioma de los titulares: ES (traducidos) o EN (el original), en IMP.',
		'Palabras vigiladas: en BOE, las disposiciones que las nombran salen arriba.',
		'Tu lista de valores (MIS), tu sitio, la provincia de FUEL, el mapa de calor de WS y las vistas del modo TV se recuerdan.',
		'Cualquier panel se amplía tocando su título.'
	]
};

export const CHESS_GUIDE: GuideSection = {
	id: 'ajedrez',
	title: 'Ajedrez',
	paras: [
		'CHESS juega contra Stockfish dentro del navegador, sin servidor. El motor pesa unos 7 MB: se descarga la primera vez y luego funciona sin conexión.',
		'La partida se guarda después de cada jugada; puedes cerrar y seguir otro día.'
	],
	items: [
		'Rival: cinco niveles (de Principiante ≈1350 a Máximo) o «Persona», para jugar a dos en el mismo dispositivo.',
		'Reloj: sin reloj o partidas de 5+3, 10+0, 15+10 y 30+0.',
		'Pista: el motor sugiere una jugada. Analizar: revisa la partida y marca los errores.',
		'Problema del día (de Lichess): se elige con el selector «Modo».',
		'Copiar PGN: la partida en el formato estándar, para pegarla en otro programa.',
		'Esc cancela la pieza elegida o la coronación.'
	]
};

/** La ficha de un valor (/s): no tiene comando, se abre escribiendo el código. */
export const STOCK: GuideSection & { examples: string[]; panels: { name: string; what: string }[] } = {
	id: 'valor',
	title: 'La ficha de un valor',
	paras: [
		'Escribe el código de un valor en la barra y pulsa Intro: NVDA, AAPL, SAN, BME:REP, FX:GBPUSD… Si no es un comando, abre su ficha.',
		'Cotización y gráficos llegan en directo de TradingView; los documentos de la SEC solo salen con la clave SEC_USER_AGENT.'
	],
	examples: ['NVDA', 'AAPL', 'BME:REP'],
	panels: [
		{ name: 'Gráfico', what: 'Gráfico interactivo de TradingView.' },
		{ name: 'Cotización', what: 'Precio y variación en directo.' },
		{ name: 'Análisis técnico', what: 'Resumen de indicadores técnicos.' },
		{ name: 'Datos fundamentales', what: 'Valoración, márgenes y cuentas.' },
		{ name: 'Perfil de la empresa', what: 'Qué hace, sector y sede.' },
		{ name: 'Documentos SEC', what: 'Últimos informes en la SEC (empresas de EE. UU.).' },
		{ name: 'Volumen en corto', what: 'Parte del volumen del último día vendida en corto y su media de 20 días (FINRA, EE. UU.). No es el interés en corto.' },
		{ name: 'En las noticias', what: 'Titulares que la nombran.' }
	]
};

// ---------- Avisos al móvil ----------

const LEVEL_NAME: Record<Level, string> = { 1: 'urgente', 2: 'importante', 3: 'interesante', 4: 'resúmenes' };

const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Qué avisa cada nivel, con los umbrales de config.ts. */
const LEVEL_WHAT: Record<Level, string[]> = {
	1: [
		`Terremotos de magnitud ${QUAKE.mag} o más (${QUAKE.magTsunami} si hay aviso de tsunami).`,
		`Cambios de tipos oficiales: ${RATES.map((r) => r.bank).join(', ')}.`,
		`Temas muy grandes de IMP: ${IMP_BIG.media} medios o más en ${IMP_BIG.sections} secciones.`,
		`Guerras, con ${WAR.media} medios fiables: ${WAR.kinds.map((k) => k.name.toLowerCase()).join(', ')}. Un aviso por tema cada ${WAR.waitHours} h, salvo escalada.`,
		`Conflictos y escaladas de ese tamaño (los menores van en P2).`,
		`Tránsito por ${STRAITS.names.join(', ')} que cae un ${pct(STRAITS.drop)} o más.`,
		'Catástrofes en alerta roja (GDACS), un apagón en España y caídas de internet de un país.'
	],
	2: [
		'Datos macro nuevos: IPC, paro, PIB, euríbor…, con la diferencia frente al anterior.',
		'Mercados que se mueven más que su umbral (bolsas, bonos, primas de riesgo, divisas, cripto, petróleo).',
		`Valores seguidos que se mueven un ${STOCKS.threshold} % o más.`,
		'Sanciones y aranceles del Federal Register, elecciones del G20 y la UE, y gas almacenado en la UE.',
		`Novedades grandes de IA (hasta ${AI_NEWS.perDay} al día).`,
		`Diésel: cambio diario, mínimos o máximos de ${DIESEL.extremeDays} días y tu zona a ${DIESEL.gapCts} céntimos o más de la media de España.`,
		'Servicios importantes caídos (según sus páginas de estado) y brotes que anuncia la OMS.'
	],
	3: [
		`Mercados de predicción con más de ${POLYMARKET.minVolume.toLocaleString('es-ES')} $ de volumen que se mueven ${Math.round(POLYMARKET.change * 100)} puntos o más.`,
		'Resultados de las grandes empresas, crisis humanitarias nuevas y fuentes de la terminal caídas varios días.',
		`Luz de mañana un ${LUZ.change} % por encima o por debajo de lo normal.`,
		'Festivos y días sin bolsa (la víspera) y cambio de hora (el viernes antes).',
		`Lanzamientos espaciales destacados, ${LAUNCHES.fromMin}–${LAUNCHES.toMin} minutos antes.`
	],
	4: [
		`Resumen de la mañana (desde las ${SUMMARIES.morning.from}) y de la noche (desde las ${SUMMARIES.evening.from}).`,
		`SEMANA: los domingos a las ${SUMMARIES.week.from}, los ${WEEK.top} temas de más peso de IMP.`
	]
};

export interface AlertLevel {
	level: Level;
	name: string;
	/** Cupo diario; null sin límite propio. */
	quota: number | null;
	what: string[];
}

export const ALERT_LEVELS: AlertLevel[] = ([1, 2, 3, 4] as const).map((level) => ({
	level,
	name: LEVEL_NAME[level],
	quota: Number.isFinite(QUOTAS[level]) ? QUOTAS[level] : null,
	what: LEVEL_WHAT[level]
}));

export const ALERTS: GuideSection = {
	id: 'avisos',
	title: 'Avisos al móvil',
	paras: [
		'Arc Terminal manda avisos al móvil con ntfy (una app gratuita) cuando pasa algo que merece la pena. Los decide la propia Action que descarga los datos, con reglas fijas y sin IA.',
		`Hay cuatro niveles, de P1 (urgente) a P4 (resúmenes). Cada nivel tiene un cupo diario y, en total, como mucho ${DAILY_TOTAL} avisos al día (día de Madrid); si se llega al tope, gana el nivel más alto.`,
		`El historial de avisos se guarda ${KEEP_DAYS} días para no repetir ninguno.`,
		'Son personales: el canal es privado y no se puede suscribir nadie más desde la web.'
	]
};

// ---------- Preguntas frecuentes ----------

export interface Faq {
	q: string;
	a: string;
}

export const FAQ: Faq[] = [
	{
		q: '¿De dónde salen los datos?',
		a: 'De fuentes públicas y oficiales: Eurostat, BCE, INE, BOE, Red Eléctrica, el Ministerio, USGS, medios por RSS… La lista completa y su estado, en STATUS; cómo se descargan, en DOC.'
	},
	{
		q: '¿Cada cuánto se actualizan?',
		a: 'Una Action de GitHub descarga los datos cada 15 minutos (y lo urgente, como terremotos, avisos y titulares, cada 5) y vuelve a publicar la web. Cada panel dice al pie cuándo se actualizó. Las cotizaciones de TradingView van en directo.'
	},
	{
		q: '¿Por qué no sale un panel?',
		a: 'Algunas fuentes necesitan una clave opcional (FRED, Finnhub, SEC, Hugging Face): sin ella su panel no sale y no se rompe nada. Si una fuente falla, su panel lo dice; en STATUS ves cuál está caída.'
	},
	{
		q: '¿Qué se guarda de mí?',
		a: 'Nada en ningún servidor. Tus ajustes, tu lista de valores, tu sitio o la partida de ajedrez se guardan solo en este navegador (lo tienes todo en «Lo que se guarda en tu navegador»). Si borras los datos del sitio, vuelves a empezar.'
	},
	{
		q: '¿Cómo la instalo en el móvil?',
		a: 'Abre la web en el navegador del móvil y elige «Añadir a pantalla de inicio» (en el iPhone, Compartir → Añadir a pantalla de inicio en Safari). Se abre como una app y funciona sin conexión con la última copia.'
	},
	{
		q: '¿Cómo abro la ficha de un valor?',
		a: 'Escribe su código en la barra (NVDA, SAN, BME:REP…) y pulsa Intro. Si el código no es un comando, abre su ficha con TradingView.'
	},
	{
		q: '¿Puedo hacer cuentas o cambiar divisas en la barra?',
		a: 'Sí. Empieza por «=» para calcular («=1250*1,21», «=200*21%»); Intro deja el resultado para seguir. «100 USD EUR» convierte con el cambio de referencia del BCE.'
	},
	{
		q: '¿Cómo comparto una vista?',
		a: '«compartir WS» copia el enlace de esa vista (en el móvil abre el menú de compartir); «compartir» solo, el de la vista abierta. También vale con un valor: «compartir NVDA».'
	},
	{
		q: '¿Usa inteligencia artificial?',
		a: 'No para decidir qué es importante: IMP y los avisos usan reglas y puntos fijos. Solo se traducen titulares al español con un servicio de traducción automática o, si no, con el traductor del propio navegador.'
	}
];

// ---------- Buscador ----------

/** ¿Contiene el texto todas las palabras de la búsqueda? Sin tildes ni mayúsculas. Vacía: sí. */
export function matches(text: string, query: string): boolean {
	const words = norm(query).split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const hay = norm(text);
	return words.every((w) => hay.includes(w));
}

/** Todo el texto de un comando y su ficha, para buscar en él. */
export function commandText(c: Command): string {
	const m = c.manual;
	return [
		c.code,
		c.key,
		c.desc,
		c.sources,
		...(c.aliases ?? []),
		m?.what ?? '',
		...(m?.args ?? []).flatMap((a) => [a.label, ...a.examples, ...(a.options ?? [])]),
		...(m?.tips ?? []),
		...(m?.panels ?? []).flatMap((p) => [p.name, p.what])
	].join(' ');
}

/** Todo el texto de una sección de la guía, para buscar en ella. */
export const sectionText = (s: GuideSection) => [s.title, ...s.paras, ...(s.items ?? [])].join(' ');

// ---------- Miniaturas ----------

/**
 * Nombre de la miniatura de una vista en static/manual/ (sin «.jpg»): la ruta sin barras, y la portada,
 * «top». «/» → «top», «/eco» → «eco». scripts/thumbs.ts, que las captura, lleva una copia (Node no puede
 * importar este archivo): si cambia aquí, cambia allí.
 */
export function thumbSlug(route: string): string {
	return route.replace(/\//g, '') || 'top';
}
