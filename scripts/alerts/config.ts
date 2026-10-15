// Umbrales y cupos de los avisos al móvil (scripts/notify.ts y scripts/alerts/rules.ts).
// Todo lo que Sergi puede querer ajustar está aquí, en tablas: cambiar un número no toca la lógica.

/** P1 urgente · P2 importante · P3 interesante · P4 resúmenes. */
export type Level = 1 | 2 | 3 | 4;

/** Tope total de avisos al día (día de Madrid). Solo es una protección contra bucles. */
export const DAILY_TOTAL = 50;

/** Cupo diario de cada nivel. Si se llega al tope total, gana el nivel más alto (P1 antes que P2…). */
export const QUOTAS: Record<Level, number> = { 1: Infinity, 2: 25, 3: 15, 4: 3 };

/** Priority de ntfy para cada nivel (5 = máxima, suena aunque el móvil esté en silencio si se configura). */
export const NTFY_PRIORITY: Record<Level, number> = { 1: 5, 2: 4, 3: 3, 4: 2 };

/** Días de historial de avisos que se guardan en notify-log.json. */
export const KEEP_DAYS = 7;

// ---------- P1 ----------

export const QUAKE = {
	/** Magnitud mínima. */
	mag: 7,
	/** Con aviso de tsunami basta con esta. */
	magTsunami: 6,
	/** Un terremoto deja de ser motivo de aviso a las 24 h. */
	hours: 24
};

/** Tipos oficiales que se vigilan: avisa cuando cambia el último valor. */
export const RATES = [
	{ id: 'ecb-dfr', file: 'ecb', bank: 'BCE', name: 'facilidad de depósito' },
	{ id: 'policy-us', file: 'bis', bank: 'Fed', name: 'tipo oficial' },
	{ id: 'policy-gb', file: 'bis', bank: 'BoE', name: 'Bank Rate' },
	{ id: 'policy-jp', file: 'bis', bank: 'BoJ', name: 'tipo oficial' }
] as const;

/** IMP: un tema que dan al menos tantos medios en al menos tantas secciones. */
export const IMP_BIG = { media: 8, sections: 3 };

/** Estrechos clave (nombres de PortWatch) y caída de tránsitos frente a la media de 7 días de la semana anterior. */
export const STRAITS = { names: ['Ormuz', 'Canal de Suez', 'Bab el-Mandeb', 'Canal de Panamá'], drop: 0.5 };

// ---------- P2 ----------

/** Datos macro: avisa cuando aparece un periodo nuevo, con el valor y la diferencia con el anterior. */
export const MACRO = [
	{ id: 'cpi-us', file: 'bls', name: 'IPC de EE. UU.', unit: '%', source: 'BLS' },
	{ id: 'payrolls-us', file: 'bls', name: 'Nóminas de EE. UU.', unit: 'mil empleos', source: 'BLS' },
	{ id: 'unemployment-us', file: 'bls', name: 'Paro de EE. UU.', unit: '%', source: 'BLS' },
	{ id: 'inflation-ea', file: 'eurostat', name: 'IPC de la zona euro', unit: '%', source: 'Eurostat' },
	{ id: 'ipc-es', file: 'ine', name: 'IPC de España', unit: '%', source: 'INE' },
	{ id: 'gdp-us', file: 'fred', name: 'PIB de EE. UU. (anualizado)', unit: '%', source: 'BEA vía FRED' },
	{ id: 'gdp-ea', file: 'eurostat', name: 'PIB de la zona euro (trimestral)', unit: '%', source: 'Eurostat' },
	{ id: 'euribor-12m', file: 'ecb', name: 'Euríbor a 12 meses', unit: '%', source: 'BCE' }
] as const;

/**
 * Riesgo macro (fred.json; 'hy-us' llega con el #213 y 'fed-net-liquidity' con el #179: sin ellas, no hay aviso).
 * - Diferencial high yield de EE. UU. ('hy-us', en %): sube al menos HY_JUMP_PB puntos básicos en 7 días
 *   naturales. No se repite mientras siga por encima, salvo que pasen HY_REPEAT_DAYS días.
 * - Liquidez neta de la Fed ('fed-net-liquidity', semanal, en millones de $): cae al menos LIQUIDITY_DROP_M
 *   en 4 semanas (el último dato frente al de 4 datos antes).
 */
export const MACRO_RISK = { HY_JUMP_PB: 50, HY_REPEAT_DAYS: 7, LIQUIDITY_DROP_M: 100_000 };

/** Hipoteca tipo del aviso del euríbor: variable, sistema francés, euríbor + diferencial (puntos). */
export const MORTGAGE = { capital: 150_000, years: 25, spread: 0.8 };

/** Cómo se lee un activo de mercado de los JSON de esta pasada. */
export type AssetSource =
	| { kind: 'coin'; id: string }
	| { kind: 'quote'; symbol: string }
	| { kind: 'series'; file: string; id: string }
	| { kind: 'curve'; tenor: string }
	| { kind: 'spread'; id: string; base: string };

export interface Asset {
	name: string;
	source: AssetSource;
	/** «%»: variación porcentual · «pb»: diferencia en puntos básicos. */
	unit: '%' | 'pb';
	/** Umbral «B» (en valor absoluto). */
	threshold: number;
	/** Solo avisa si sube (primas de riesgo). */
	upOnly?: boolean;
}

/**
 * Umbrales «B» de mercados. Sin datos (p. ej., DAX e IBEX no tienen fuente todavía; el oro tampoco),
 * el activo simplemente no aplica.
 */
export const ASSETS: Asset[] = [
	{ name: 'BTC', source: { kind: 'coin', id: 'bitcoin' }, unit: '%', threshold: 3.5 },
	{ name: 'ETH', source: { kind: 'coin', id: 'ethereum' }, unit: '%', threshold: 3.5 },
	{ name: 'EUR/USD', source: { kind: 'series', file: 'ecb', id: 'eurusd' }, unit: '%', threshold: 0.6 },
	{ name: 'US10Y', source: { kind: 'curve', tenor: '10A' }, unit: 'pb', threshold: 7.5 },
	{
		name: 'Prima ES',
		source: { kind: 'spread', id: 'bond10-es', base: 'bond10-de' },
		unit: 'pb',
		threshold: 10,
		upOnly: true
	},
	{
		name: 'Prima IT',
		source: { kind: 'spread', id: 'bond10-it', base: 'bond10-de' },
		unit: 'pb',
		threshold: 10,
		upOnly: true
	},
	{
		name: 'Prima FR',
		source: { kind: 'spread', id: 'bond10-fr', base: 'bond10-de' },
		unit: 'pb',
		threshold: 10,
		upOnly: true
	},
	{ name: 'S&P 500', source: { kind: 'quote', symbol: 'SPY' }, unit: '%', threshold: 1.25 },
	{ name: 'Nasdaq', source: { kind: 'quote', symbol: 'QQQ' }, unit: '%', threshold: 1.25 },
	{ name: 'DAX', source: { kind: 'quote', symbol: 'DAX' }, unit: '%', threshold: 1.25 },
	{ name: 'IBEX', source: { kind: 'quote', symbol: 'IBEX' }, unit: '%', threshold: 1.25 },
	{ name: 'Petróleo WTI', source: { kind: 'series', file: 'fred', id: 'wti' }, unit: '%', threshold: 2 },
	{ name: 'Oro', source: { kind: 'series', file: 'fred', id: 'gold' }, unit: '%', threshold: 2 }
];

/**
 * Mercados, sin espera: el umbral de cada activo (ASSETS) hace de escalón. El primer aviso del día sale al
 * pasarlo desde el cierre anterior; los siguientes, cada vez que el precio se mueve otro umbral desde el
 * último aviso de ese activo, suba o baje.
 */
export const MARKETS = {
	/** Desde cuántos activos a la vez van juntos en una sola notificación. */
	group: 3
};

/** Federal Register: palabras de sanciones o aranceles amplios. Uno al día, el más relevante. */
export const FEDREG = /\b(tariffs?|duties|sanctions?|export controls?|embargo|reciprocal trade)\b/i;

/**
 * Conflictos: un tema de IMP (current[]) cuyo título case con esto. P1 si cumple IMP_BIG; P2 con
 * `media` medios o más. Un aviso por tema cada `waitHours` (salvo que suba de P2 a P1).
 */
export const CONFLICT = {
	words:
		/\b(ataque|bombardeo|invasi[óo]n|misil(es)?|ofensiva|alto el fuego|tregua|movilizaci[óo]n|art[íi]culo 5|OTAN|NATO|nuclear|escalada|guerra|attack|strike|invasion|missiles?|ceasefire|war)\b/i,
	media: 5,
	waitHours: 12
};

/**
 * Elecciones (elections.json): solo del G20 y la UE. «Hoy vota…» desde `from` (hora de Madrid) del día de
 * la votación; el resultado, con un tema de IMP de ese día o del siguiente con `media` medios o más.
 * G20 y UE son los mismos que isMajor de src/lib/elections.ts (rama claude/elecciones): cuando se mezcle,
 * mejor importarlos de allí.
 */
export const ELECTIONS = {
	from: '08:00',
	media: 5,
	result: /\b(gana|victoria|resultados?|escrutinio|elecciones|wins?|election)\b/i,
	g20: ['AR', 'AU', 'BR', 'CA', 'CN', 'DE', 'FR', 'GB', 'ID', 'IN', 'IT', 'JP', 'KR', 'MX', 'RU', 'SA', 'TR', 'US', 'ZA'],
	eu: [
		'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
		'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
	]
};

/** IA (news-ai.json y news-tech.json): grupo de titulares de `media` medios o más que nombra a un laboratorio y un lanzamiento. */
export const AI_NEWS = {
	media: 3,
	labs: /\b(OpenAI|GPT|Google|Gemini|DeepMind|Anthropic|Claude|Meta|Llama|xAI|Grok|Mistral|DeepSeek|Qwen)/i,
	launch: /\b(lanza|presenta|anuncia|nuevo modelo|launch(es)?|releases?|unveils?|introduc(es|ing))\b/i,
	/** Como mucho tantos al día. */
	perDay: 3
};

/**
 * Valores seguidos (alert-quotes.json, PR #132): escalones del `threshold` % (en valor absoluto), como los
 * mercados y sin espera: el primero del día desde el cierre anterior y los siguientes desde el último aviso
 * de ese valor. Desde `group` a la vez, en uno solo. Nombres legibles de los símbolos de Finnhub
 * (ALERT_TICKERS de scripts/sources/alert-quotes.ts).
 */
export const STOCKS = {
	threshold: 3,
	group: 3,
	names: {
		// ADR de los europeos (D25, solo avisos).
		EADSY: 'Airbus (ADR)',
		BAESY: 'BAE Systems (ADR)',
		RNMBY: 'Rheinmetall (ADR)',
		FINMY: 'Leonardo (ADR)',
		THLLY: 'Thales (ADR)',
		SAABY: 'Saab (ADR)',
		ISMAY: 'Indra (ADR)',
		LMT: 'Lockheed Martin',
		RTX: 'RTX',
		NOC: 'Northrop Grumman',
		GD: 'General Dynamics',
		LHX: 'L3Harris',
		BA: 'Boeing',
		PLTR: 'Palantir',
		'AIR.PA': 'Airbus',
		'BA.L': 'BAE Systems',
		'RHM.DE': 'Rheinmetall',
		'LDO.MI': 'Leonardo',
		'HO.PA': 'Thales',
		'SAAB-B.ST': 'Saab',
		'IDR.MC': 'Indra',
		NVDA: 'NVIDIA',
		AAPL: 'Apple'
	} as Record<string, string>
};

/** Gas de la UE (GIE): bajada diaria mínima del llenado, en puntos, y umbrales que se vigilan al cruzarlos. */
export const GAS = { drop: 1, levels: [90, 80, 50] };

/**
 * Diésel (fuel-es.json para España y las provincias; fuel.json para Menorca). La zona de Sergi va en el
 * secreto ALERT_FUEL_ZONE («07», «28»… o «menorca»); sin él, solo se vigila España.
 * a) Cada dato diario nuevo cuyo precio medio cambie frente al día anterior con dato, de cualquier cantidad
 *    (lo mínimo que se ve: 0,1 cts/L). Si no cambia, no se avisa.
 * b) y c) Sin espera: avisan con cada dato nuevo que cumpla la condición. El id lleva la fecha del dato, así
 *    que el mismo dato no se avisa dos veces.
 */
export const DIESEL = {
	/** b) Mínimo o máximo de tantos días (hace falta un historial al menos así de largo). */
	extremeDays: 90,
	/** c) La zona se separa de la media de España al menos tantos céntimos/L. */
	gapCts: 5
};

// ---------- P3 ----------

/** Polymarket: volumen mínimo en 24 h ($) y cambio mínimo de probabilidad (0–1) en 24 h. */
export const POLYMARKET = { minVolume: 1_000_000, change: 0.15, maxTracked: 60 };

/**
 * Resultados: las 10 más grandes y la lista MIS de Sergi. MIS se guarda en su navegador, así que la Action
 * no la ve: se copia aquí a mano.
 */
export const EARNINGS_WATCH = {
	top10: ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'BRK.B', 'TSM'],
	/** Valores seguidos de EE. UU. (los de STOCKS; NVDA y AAPL ya están arriba). */
	seguidos: ['LMT', 'RTX', 'NOC', 'GD', 'LHX', 'BA', 'PLTR'],
	mis: [] as string[]
};

/** ReliefWeb: niveles que cuentan como «alto» (si la fuente llega a darlos) y antigüedad máxima. */
export const CRISIS = { levels: ['high', 'red'], hours: 48 };

/** Fuente caída: pasadas seguidas en «error» (el mismo número que scripts/issues.ts). */
export const DOWN = { days: 3 };

/**
 * Luz de mañana (PVPC): avisa si su media se separa al menos `change` % de la media de los `days` días
 * anteriores. El historial de power.json lo acumula la web: mientras tenga menos de `days` días se usa lo
 * que haya, con un mínimo de `minDays`.
 */
export const LUZ = { change: 30, days: 30, minDays: 3 };

/** «Mañana es festivo / no abre la bolsa»: hora de Madrid desde la que sale la víspera. */
export const TOMORROW = { from: '19:00', until: '23:59' };

/** Cambio de hora: el viernes anterior, desde esta hora de Madrid. */
export const DST = { from: '10:00', until: '23:59' };

/**
 * Lanzamientos (launches.json): Go y con el NET entre ahora + `fromMin` y ahora + `toMin` minutos. Solo
 * tripulados (no hay campo: se reconoce por la misión), de estos cohetes o misiones, o de estas agencias.
 */
export const LAUNCHES = {
	fromMin: 45,
	toMin: 75,
	crewed: /\b(crew|crewed|tripulad[ao]|shenzhou|soyuz ms|axiom|ax-\d|polaris|starliner|gaganyaan|artemis i{2,})/i,
	types: /\b(starship|artemis|new glenn|ariane 6)/i,
	agencies:
		/\b(NASA|ESA|CNSA|ISRO|JAXA)\b|National Aeronautics|European Space Agency|China National Space|Indian Space Research|Japan Aerospace/
};

// ---------- P4 ----------

/** Resúmenes: hora de Madrid desde la que sale y hasta la que aún tiene sentido mandarlo. */
export const SUMMARIES = {
	morning: { from: '08:05', until: '11:59' },
	evening: { from: '22:15', until: '23:59' },
	/** SEMANA: los domingos. */
	week: { from: '19:00', until: '23:59' }
};

/** SEMANA: cuántos temas de IMP (los de más puntuación de los últimos 7 días). */
export const WEEK = { top: 5 };
