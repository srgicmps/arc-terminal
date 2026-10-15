// Llevar los ajustes a otro dispositivo (M21): todo lo que prefs.ts marca como ajuste o dato tuyo, en un
// enlace (…/help#ajustes=<base64url>). Al abrirlo en el otro navegador, HELP pregunta antes de copiar
// nada. Lógica pura, sin depender del navegador: recibe el localStorage (o uno simulado en los tests).
import { PREFS } from './prefs.ts';

/** Lo que no tiene sentido llevarse: la hora de tu última visita es de cada navegador. */
const SKIP = new Set(['arc-last-visit']);

/** ¿Se puede llevar esta clave? Solo las de localStorage que prefs.ts da como ajuste o dato. */
export function portable(key: string): boolean {
	if (SKIP.has(key)) return false;
	const pref = PREFS.find((p) => p.key === key || (p.prefix !== undefined && key.startsWith(p.prefix)));
	return !!pref && pref.storage === 'local' && pref.kind !== 'caché';
}

type Store = Pick<Storage, 'length' | 'key' | 'getItem'>;

/** Las claves que se pueden llevar y su valor, tal y como están guardadas. */
export function collect(store: Store): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < store.length; i++) {
		const key = store.key(i);
		const value = key === null ? null : store.getItem(key);
		if (key !== null && value !== null && portable(key)) out[key] = value;
	}
	return out;
}

/** Por trozos: `fromCharCode(...bytes)` con muchos datos (notas, cartera) pasa del tope de argumentos (RangeError). */
function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const fromBase64Url = (s: string) => {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Los ajustes, en un texto que cabe en un enlace. */
export function encode(prefs: Record<string, string>): string {
	return toBase64Url(new TextEncoder().encode(JSON.stringify(prefs)));
}

/** Lo contrario de encode. Descarta lo que no sea una clave que se pueda llevar; null si el texto no vale. */
export function decode(text: string): Record<string, string> | null {
	try {
		const data: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(text)));
		if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
		const out: Record<string, string> = {};
		for (const [key, value] of Object.entries(data)) if (portable(key) && typeof value === 'string') out[key] = value;
		return Object.keys(out).length ? out : null;
	} catch {
		return null;
	}
}

export const HASH = '#ajustes=';
