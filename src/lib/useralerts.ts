// Órdenes de Sergi desde la barra que tiene que ver la Action (lote 27-B, decisión D41 = A): alertas
// propias («alerta NVDA > 150»), la lista MIS para los avisos y las palabras vigiladas. La web es
// estática y no puede escribir en el repo: la barra abre un issue de GitHub ya escrito y Sergi pulsa
// «Submit». La Action (scripts/requests.ts) lee solo los issues abiertos que ha creado el dueño del repo.
// Los issues son PÚBLICOS (el repo lo es): aquí no va nada privado, nunca el tema de ntfy ni la zona.
// Este archivo es lógica pura que comparten la barra y la Action.

export const REPO = 'srgicmps/arc-terminal';
export const OWNER = 'srgicmps';

/** Tipos de orden: el prefijo del título del issue («[alerta] NVDA > 150») y su etiqueta. */
export const KINDS = ['alerta', 'mis', 'vigila'] as const;
export type RequestKind = (typeof KINDS)[number];

/** Topes, contra errores y abusos: lo que pase de aquí no se aplica. */
export const LIMITS = { alerts: 20, mis: 40, words: 30, wordLength: 40 };

/** Activos con nombre propio; lo demás se trata como un valor de bolsa (cotización de Finnhub). */
const ASSETS: Record<string, { id: string; name: string; unit: string }> = {
	BTC: { id: 'coin:bitcoin', name: 'Bitcoin', unit: '$' },
	BITCOIN: { id: 'coin:bitcoin', name: 'Bitcoin', unit: '$' },
	ETH: { id: 'coin:ethereum', name: 'Ethereum', unit: '$' },
	ETHEREUM: { id: 'coin:ethereum', name: 'Ethereum', unit: '$' },
	DIESEL: { id: 'diesel', name: 'Diésel (media de España)', unit: '€/L' },
	GASOIL: { id: 'diesel', name: 'Diésel (media de España)', unit: '€/L' },
	GASOLEO: { id: 'diesel', name: 'Diésel (media de España)', unit: '€/L' }
};

/**
 * Una alerta: el precio cruza un nivel («NVDA > 150», «diésel < 1,40») o la variación del día llega a un
 * porcentaje («BTC -5%»: baja un 5 % o más; «NVDA 3%»: se mueve un 3 % en cualquier sentido).
 */
export type UserAlert = {
	/** «NVDA», «coin:bitcoin», «diesel». */
	asset: string;
	/** Cómo se escribe en el aviso: «NVDA», «Bitcoin». */
	name: string;
	unit: string;
} & ({ op: '>' | '<'; value: number } | { op: '%'; value: number });

const upper = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/** «1.234,5», «1,40», «150» → número; null si no lo es. */
export function parseNumber(raw: string): number | null {
	let s = raw.trim().replace(/\s/g, '');
	if (/,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
	else s = s.replace(/,/g, '');
	if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

/** «NVDA > 150», «btc -5%», «diésel < 1,40» → la alerta; null si no se entiende. */
export function parseAlert(raw: string): UserAlert | null {
	const m = raw.trim().match(/^([A-Za-zÀ-ÿ0-9.:]+)\s*(>=?|<=?|)\s*([+-]?\s*[\d.,]+)\s*(%?)$/);
	if (!m) return null;
	const [, symRaw, opRaw, numRaw, pct] = m;
	const sym = upper(symRaw);
	if (!/^[A-Z0-9.:]{1,12}$/.test(sym)) return null;
	const value = parseNumber(numRaw);
	if (value === null) return null;
	const known = ASSETS[sym];
	const base = known ? { asset: known.id, name: known.name, unit: known.unit } : { asset: sym, name: sym, unit: '$' };
	if (pct) {
		// «NVDA > 3%» no tiene sentido: el porcentaje va solo, con su signo.
		if (opRaw || value === 0 || Math.abs(value) > 50) return null;
		return { ...base, op: '%', value };
	}
	if (!opRaw || value <= 0) return null;
	return { ...base, op: opRaw.startsWith('>') ? '>' : '<', value };
}

/** Cómo se escribe una alerta: «NVDA > 150», «Bitcoin −5 %», «Diésel (media de España) < 1,4 €/L». */
export function alertText(a: UserAlert): string {
	const num = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 4 });
	if (a.op === '%') return `${a.name} ${a.value > 0 ? '+' : a.value < 0 ? '−' : '±'}${num(Math.abs(a.value))} %`;
	return `${a.name} ${a.op} ${num(a.value)}${a.unit === '$' ? '' : ` ${a.unit}`}`;
}

/** ¿Salta con este precio y variación del día (en %)? */
export function alertHit(a: UserAlert, price: number | null, changePct: number | null): boolean {
	if (a.op === '%') {
		if (changePct === null || !Number.isFinite(changePct)) return false;
		return a.value < 0 ? changePct <= a.value : changePct >= a.value;
	}
	if (price === null || !Number.isFinite(price)) return false;
	return a.op === '>' ? price >= a.value : price <= a.value;
}

/** Una palabra vigilada aceptable: sin saltos de línea, ni demasiado larga ni vacía. */
export function cleanWord(raw: string): string | null {
	const w = raw.replace(/\s+/g, ' ').trim();
	return w && w.length <= LIMITS.wordLength && !/[\[\]<>]/.test(w) ? w : null;
}

/** El título del issue: «[alerta] NVDA > 150», «[mis] NVDA AAPL», «[vigila] aranceles, vivienda». */
export function requestTitle(kind: RequestKind, payload: string): string {
	return `[${kind}] ${payload}`;
}

/** Lee un título de issue: el tipo y lo que va detrás; null si no es una orden de la barra. */
export function parseTitle(title: string): { kind: RequestKind; payload: string } | null {
	const m = title.match(/^\s*\[(alerta|mis|vigila)\]\s*(.*)$/i);
	return m ? { kind: m[1].toLowerCase() as RequestKind, payload: m[2].trim() } : null;
}

/** Los valores de un «[mis] NVDA AAPL»: en mayúsculas, sin repetir y con el tope. */
export function parseMis(payload: string): string[] {
	const codes = payload.split(/[\s,]+/).map(upper).filter((c) => /^[A-Z0-9.:]{1,12}$/.test(c));
	return [...new Set(codes)].slice(0, LIMITS.mis);
}

/** Las palabras de un «[vigila] aranceles, vivienda». */
export function parseWords(payload: string): string[] {
	const words = payload.split(',').map(cleanWord).filter((w): w is string => !!w);
	return [...new Map(words.map((w) => [w.toLowerCase(), w])).values()].slice(0, LIMITS.words);
}

const BODY: Record<RequestKind, string> = {
	alerta: 'Alerta creada desde la barra de Arc Terminal. La Action la vigila en cada pasada y cierra este issue cuando avisa al móvil. Para borrarla, cierra el issue.',
	mis: 'Lista MIS para los avisos de valores seguidos, desde la barra de Arc Terminal. Vale el issue abierto más reciente; la Action cierra los anteriores.',
	vigila: 'Palabras vigiladas para los avisos (BOE y titulares), desde la barra de Arc Terminal. Vale el issue abierto más reciente; la Action cierra los anteriores.'
};

/** El enlace que abre el issue ya escrito: Sergi solo tiene que pulsar «Submit». */
export function issueUrl(kind: RequestKind, payload: string): string {
	const q = new URLSearchParams({ title: requestTitle(kind, payload), labels: kind, body: BODY[kind] });
	return `https://github.com/${REPO}/issues/new?${q}`;
}

/** Los issues abiertos de un tipo, para revisarlos o cerrarlos a mano. */
export function issuesUrl(kind: RequestKind): string {
	const q = new URLSearchParams({ q: `is:issue is:open author:${OWNER} in:title "[${kind}]"` });
	return `https://github.com/${REPO}/issues?${q}`;
}
