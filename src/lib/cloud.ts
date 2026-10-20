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
/** Topes del servidor (cloud/prefs.ts los aplica). El navegador los respeta antes de subir: si no, una sola clave enorme
 * (una nota larguísima, por ejemplo) haría que el servidor rechazara todo y no se sincronizaría nada más. */
export const LIMITS = { keys: 200, value: 64 * 1024, total: 512 * 1024, body: 600 * 1024 };

export interface Plan {
	/** Lo que hay que mandar al servidor. */
	push: Patch;
	/** Lo que hay que cambiar en este navegador. */
	apply: Patch;
	/** Cómo quedan los dos al terminar: la base de la próxima vez. */
	result: Prefs;
	/** Claves que no caben en la cuenta: se quedan solo en este navegador, sin tocar, hasta que vuelvan a caber. */
	frozen?: string[];
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

const weight = (k: string, v: string) => k.length + v.length;

/**
 * Las claves de aquí que no caben en la cuenta: las que pasan del tope por valor y, si aun así el total o el número
 * de claves no cabe, las más grandes hasta que quepa (con un margen para lo que haya fuera).
 */
export function oversized(local: Prefs): string[] {
	const out = new Set<string>();
	const bySize = Object.entries(local).sort((a, b) => weight(b[0], b[1]) - weight(a[0], a[1]));
	let total = 0;
	for (const [k, v] of bySize) {
		if (v.length > LIMITS.value) out.add(k);
		else total += weight(k, v);
	}
	let count = bySize.length - out.size;
	for (const [k, v] of bySize) {
		if (total <= LIMITS.total * 0.9 && count <= LIMITS.keys - 10) break;
		if (out.has(k)) continue;
		out.add(k);
		total -= weight(k, v);
		count--;
	}
	return [...out];
}

/**
 * merge, pero sin las claves que no caben: ni se suben, ni se borran, ni se cambian aquí (si en el servidor queda una
 * copia vieja, se respeta hasta que la de aquí vuelva a caber y gane por ser la cambiada).
 */
export function mergeFitting(local: Prefs, remote: Prefs, base: Prefs | null): Plan {
	const frozen = oversized(local);
	if (!frozen.length) return merge(local, remote, base);
	const skip = new Set(frozen);
	const keep = (p: Prefs) => Object.fromEntries(Object.entries(p).filter(([k]) => !skip.has(k)));
	const plan = merge(keep(local), keep(remote), base && keep(base));
	for (const k of frozen) {
		// La base guarda cómo quedó la última vez que cupo: cuando vuelva a caber, la de aquí será la cambiada y ganará.
		const was = base?.[k];
		if (was !== undefined) plan.result[k] = was;
	}
	return { ...plan, frozen };
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
	return mergeFitting(local, remote, memory?.base ?? null);
}

/**
 * ¿Ha entrado otra cuenta en este navegador desde otra pestaña? La memoria guardada (saved, arc-sync) es ya de otro
 * usuario que la de esta pestaña (mine): lo que esta enseña y recuerda es del anterior, y lo que subiera iría a la cuenta
 * nueva. Pasa tras «Cerrar sesión» (HELP) si entra otra persona con más pestañas abiertas.
 */
export const replaced = (mine: SyncMemory | null, saved: SyncMemory | null): boolean =>
	!!mine && !!saved && saved.user !== mine.user;

/** Dónde guarda este navegador su SyncMemory (localStorage). */
export const MEMORY = 'arc-sync';

/**
 * La memoria tras «Borrar mi cuenta» (HELP): de nadie. No se borra la memoria, se cambia por esta: las demás pestañas
 * de la cuenta borrada la ven como otra cuenta (replaced) y salen, y para quien entre después (también la misma
 * persona) es como si entrara otra: manda lo de su cuenta y no se sube nada de lo que quede aquí (startPlan).
 */
export const NOBODY: SyncMemory = { user: '', base: {} };

/**
 * La pausa de «Borrar mi cuenta» (hold en cloud.svelte.ts) vale para todas las pestañas de este navegador: la que
 * borra guarda aquí la hora (localStorage) y la renueva mientras sigue parada; las demás no suben ni bajan nada.
 */
export const HOLD = 'arc-sync-hold';

/** Lo que dura la pausa sin renovarse: si la pestaña que borra se cierra a medias, las demás siguen al rato. */
export const HOLD_MS = 30_000;

/** ¿Sigue en pie la pausa guardada (stamp: la hora en ms, como texto)? Sin hora, con una rara o vieja, no. */
export function holdActive(stamp: string | null, now: number): boolean {
	if (!stamp) return false;
	const t = Number(stamp);
	return Number.isFinite(t) && Math.abs(now - t) < HOLD_MS;
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
