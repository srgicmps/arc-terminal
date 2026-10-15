// Ajustes en tu cuenta (lógica pura; el navegador está en cloud.svelte.ts). Se comparan tres copias de tus
// ajustes (los de prefs.ts que se pueden llevar, como en transfer.ts):
//   local:  lo que hay ahora en este navegador
//   remote: lo que hay en el servidor (/api/prefs, cloud/prefs.ts)
//   base:   cómo estaban los dos la última vez que se pusieron de acuerdo (null: este navegador nunca ha sincronizado)
// Lo que ha cambiado aquí se sube; lo que ha cambiado en otro dispositivo se baja. Si cambió en los dos
// sitios a la vez, gana este navegador (es lo último que has tocado tú aquí).

export type Prefs = Record<string, string>;
export interface Patch {
	set: Prefs;
	del: string[];
}
export interface Plan {
	/** Lo que hay que mandar al servidor. */
	push: Patch;
	/** Lo que hay que cambiar en este navegador. */
	apply: Patch;
	/** Cómo quedan los dos al terminar: la base de la próxima vez. */
	result: Prefs;
}

export const isEmpty = (p: Patch) => !Object.keys(p.set).length && !p.del.length;

export function merge(local: Prefs, remote: Prefs, base: Prefs | null): Plan {
	const push: Patch = { set: {}, del: [] };
	const apply: Patch = { set: {}, del: [] };
	const result: Prefs = {};
	const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base ?? {})]);
	for (const k of keys) {
		const l = local[k];
		const r = remote[k];
		// Primera vez en este navegador: se juntan los dos y, si una clave está en ambos, manda el servidor.
		const value = base === null ? (r ?? l) : l !== base[k] ? l : r;
		if (value !== undefined) result[k] = value;
		if (value !== r) {
			if (value === undefined) push.del.push(k);
			else push.set[k] = value;
		}
		if (value !== l) {
			if (value === undefined) apply.del.push(k);
			else apply.set[k] = value;
		}
	}
	return { push, apply, result };
}

/**
 * Lo que este navegador recuerda de la última vez: de quién eran los ajustes y cómo quedaron.
 * Si ahora entra otra persona, lo de aquí no es suyo: no se sube, se cambia por lo de su cuenta.
 */
export interface SyncMemory {
	user: string;
	base: Prefs;
}

export function startPlan(local: Prefs, remote: Prefs, memory: SyncMemory | null, user: string): Plan {
	if (memory && memory.user !== user) return { push: { set: {}, del: [] }, apply: diff(local, remote), result: remote };
	return merge(local, remote, memory?.base ?? null);
}

/** Qué cambiar en `from` para que quede como `to`. */
export function diff(from: Prefs, to: Prefs): Patch {
	const set: Prefs = {};
	for (const [k, v] of Object.entries(to)) if (from[k] !== v) set[k] = v;
	return { set, del: Object.keys(from).filter((k) => !(k in to)) };
}

export function readMemory(text: string | null): SyncMemory | null {
	try {
		const m = JSON.parse(text ?? '') as SyncMemory;
		return typeof m?.user === 'string' && m.base && typeof m.base === 'object' ? m : null;
	} catch {
		return null;
	}
}
