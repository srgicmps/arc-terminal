// Tus líderes (M25): cuáles salen en LIDER y en qué orden. Se guarda en este navegador como la lista de ids
// visibles, en orden («["lagarde","sanchez"]»). Sin nada guardado, todos en el orden de leaders.ts.
// Lógica pura, sin Svelte, para probarla con Vitest.
import { LEADERS, type Leader } from './leaders.ts';

export const LEADERS_KEY = 'arc-leaders';

/** Lo guardado, limpio: solo ids que existen, sin repetir. null si no vale (y entonces, todos). */
export function cleanLeaderIds(raw: unknown): string[] | null {
	if (!Array.isArray(raw)) return null;
	const ids = raw.filter((x, i): x is string => typeof x === 'string' && LEADERS.some((l) => l.id === x) && raw.indexOf(x) === i);
	return ids.length ? ids : null;
}

/** Los ids visibles, en orden: los guardados o, sin nada guardado, todos. */
export const visibleIds = (saved: string[] | null) => saved ?? LEADERS.map((l) => l.id);

/** Los líderes que salen, en tu orden. */
export function myLeaders(saved: string[] | null): Leader[] {
	return visibleIds(saved).flatMap((id) => LEADERS.find((l) => l.id === id) ?? []);
}

/** Todos: primero los visibles en tu orden y después los ocultos, en el orden de siempre. */
export function allInOrder(saved: string[] | null): Leader[] {
	const mine = myLeaders(saved);
	return [...mine, ...LEADERS.filter((l) => !mine.includes(l))];
}

/**
 * Enciende o apaga uno: al encenderlo va al final. No se puede apagar el último (quedaría la vista vacía).
 * Devuelve null si queda como sin guardar (todos, en el orden de siempre).
 */
export function toggleLeader(saved: string[] | null, id: string): string[] | null {
	const ids = visibleIds(saved);
	const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
	return normalize(next.length ? next : ids);
}

/** Sube (−1) o baja (+1) uno de los visibles. */
export function moveLeader(saved: string[] | null, id: string, dir: -1 | 1): string[] | null {
	const ids = [...visibleIds(saved)];
	const i = ids.indexOf(id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= ids.length) return saved;
	[ids[i], ids[j]] = [ids[j], ids[i]];
	return normalize(ids);
}

/** Si es justo lo de siempre, no hace falta guardarlo. */
const normalize = (ids: string[]) => (ids.join() === LEADERS.map((l) => l.id).join() ? null : ids);
