// Umbrales y cupos de los avisos al móvil (scripts/notify.ts y scripts/alerts/rules.ts).
// Todo lo que Sergi puede querer ajustar está aquí, en tablas: cambiar un número no toca la lógica.

/** P1 urgente · P2 importante · P3 interesante · P4 resúmenes. */
export type Level = 1 | 2 | 3 | 4;

/** Tope total de avisos al día (día de Madrid). Solo es una protección contra bucles. */
export const DAILY_TOTAL = 50;

/** Cupo diario de cada nivel. Si se llega al tope total, gana el nivel más alto (P1 antes que P2…). */
export const QUOTAS: Record<Level, number> = { 1: Infinity, 2: 25, 3: 15, 4: 2 };

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
	{ id: 'gdp-ea', file: 'eurostat', name: 'PIB de la zona euro (trimestral)', unit: '%', source: 'Eurostat' }
] as const;

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

export const MARKETS = {
	/** Espera entre dos avisos del mismo activo, salvo que el movimiento se duplique. */
	waitHours: 4,
	/** Desde cuántos activos a la vez van juntos en una sola notificación. */
	group: 3
};

/** Federal Register: palabras de sanciones o aranceles amplios. Uno al día, el más relevante. */
export const FEDREG = /\b(tariffs?|duties|sanctions?|export controls?|embargo|reciprocal trade)\b/i;

/** Gas de la UE (GIE): bajada diaria mínima del llenado, en puntos, y umbrales que se vigilan al cruzarlos. */
export const GAS = { drop: 1, levels: [90, 80, 50] };

// ---------- P3 ----------

/** Polymarket: volumen mínimo en 24 h ($) y cambio mínimo de probabilidad (0–1) en 24 h. */
export const POLYMARKET = { minVolume: 1_000_000, change: 0.15, maxTracked: 60 };

/**
 * Resultados: las 10 más grandes y la lista MIS de Sergi. MIS se guarda en su navegador, así que la Action
 * no la ve: se copia aquí a mano.
 */
export const EARNINGS_WATCH = {
	top10: ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'BRK.B', 'TSM'],
	mis: [] as string[]
};

/** ReliefWeb: niveles que cuentan como «alto» (si la fuente llega a darlos) y antigüedad máxima. */
export const CRISIS = { levels: ['high', 'red'], hours: 48 };

/** Fuente caída: pasadas seguidas en «error» (el mismo número que scripts/issues.ts). */
export const DOWN = { days: 3 };

// ---------- P4 ----------

/** Resúmenes: hora de Madrid desde la que sale y hasta la que aún tiene sentido mandarlo. */
export const SUMMARIES = {
	morning: { from: '08:05', until: '11:59' },
	evening: { from: '22:15', until: '23:59' }
};
