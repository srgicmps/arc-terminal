// Centro de notificaciones de Arc OS (shell): junta los avisos gordos (los mismos que los P1 del móvil, de
// /data/muro.json) y las novedades de la web (/data/changes.json) en una sola lista, con lo leído aparte.
// Lógica pura: la parte del navegador está en notices.svelte.ts.
import type { WallData } from '../../exp/muro.ts';
import type { ChangesData } from '../../types.ts';

export interface Notice {
	/** Único y estable entre pasadas: sirve para recordar lo leído. */
	id: string;
	kind: 'aviso' | 'novedad';
	title: string;
	detail: string;
	/** ISO 8601. */
	time: string;
	/** A dónde lleva al tocarla (ruta de la web o URL externa). */
	href?: string;
}

/** Las novedades de la web que se enseñan (de la última semana). */
export const MAX_CHANGES = 8;
/** Lo leído que se recuerda (los ids más recientes). */
export const MAX_SEEN = 100;

export function buildNotices(wall: WallData | null, changes: ChangesData | null): Notice[] {
	const alerts: Notice[] = (wall?.alerts ?? []).map((a) => ({
		id: `a:${a.kind}:${a.time}:${a.title}`,
		kind: 'aviso',
		title: a.title,
		detail: a.detail,
		time: a.time,
		href: a.kind === 'terremoto' ? '/geo' : '/imp'
	}));
	const news: Notice[] = (changes?.items ?? []).slice(0, MAX_CHANGES).map((c) => ({
		id: `n:${c.number}`,
		kind: 'novedad',
		title: c.title,
		detail: `Novedad de Arc #${c.number}`,
		time: c.mergedAt,
		href: '/novedades'
	}));
	return [...alerts, ...news].sort((a, b) => b.time.localeCompare(a.time));
}

/** Las que no se han leído. */
export const unread = (list: Notice[], seen: Iterable<string>) => {
	const s = new Set(seen);
	return list.filter((n) => !s.has(n.id));
};

/** Lo leído tras marcar `ids`: sin repetir y solo los últimos MAX_SEEN. */
export function markSeen(seen: string[], ids: string[]): string[] {
	const out = [...seen.filter((s) => !ids.includes(s)), ...ids];
	return out.slice(-MAX_SEEN);
}

/**
 * Las que merecen un aviso flotante («toast»): avisos nuevos desde la última vez que se miró. Las novedades de
 * la web no saltan: se ven al abrir el centro. La primera vez (`known` vacío) no salta nada, para no inundar.
 */
export function toastsFor(list: Notice[], known: Set<string>, first: boolean): Notice[] {
	if (first) return [];
	return list.filter((n) => n.kind === 'aviso' && !known.has(n.id)).slice(0, 3);
}
