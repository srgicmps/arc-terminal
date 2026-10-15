// Aspecto «Mando» de Arc OS (centro de mando): el nivel de alerta global y el estado de las fuentes en vivo
// que enseñan su barra de arriba y su franja de abajo. Sale de lo que ya cargan los widgets (/data/muro.json y
// /data/status.json): ni datos nuevos ni IA. Lógica pura.
import type { SourceStatus } from '../../data.ts';
import { WALL_ALERT, type WallData } from '../../exp/muro.ts';
import { NEWS_SECTIONS } from '../../news.ts';

export interface AlertLevel {
	/** De 1 (normal) a 5 (máximo); 0 si no hay datos (no se puede decir que todo vaya bien). */
	level: 0 | 1 | 2 | 3 | 4 | 5;
	label: string;
	/** Por qué, en frases cortas (el título del indicador). */
	reasons: string[];
}

export const LEVELS = ['Normal', 'Vigilancia', 'Elevado', 'Alto', 'Máximo'] as const;

/** Medios que cubren un titular para que cuente como «tema grande» (y como «enorme»). */
export const BIG_STORY = { big: 5, huge: 8, hours: 24 };

const HOUR = 3_600_000;

/**
 * Nivel de alerta global: cada aviso grave de las últimas horas (los del muro: terremoto fuerte o tema enorme
 * en IMP, los mismos que los P1 al móvil) suma 2; el titular más cubierto del día suma 1 si es grande y 2 si es
 * enorme (si no es ya uno de los avisos: la misma historia no cuenta dos veces).
 * 0 → 1 Normal · 1 → 2 · 2–3 → 3 · 4–5 → 4 · 6 o más → 5. Sin muro, nivel 0 «Sin datos».
 * Con `now`, los avisos y los temas se vuelven a filtrar por hora: un muro.json viejo (si se paran las Actions)
 * no deja la barra en «Alto» días después.
 */
export function alertLevel(wall: Pick<WallData, 'alerts' | 'headlines'> | null | undefined, now?: number): AlertLevel {
	if (!wall) return { level: 0, label: 'Sin datos', reasons: ['Aún no han llegado los avisos (muro.json)'] };
	const fresh = (iso: string, hours: number) => {
		if (now === undefined) return true;
		const t = Date.parse(iso);
		return Number.isFinite(t) && t >= now - hours * HOUR && t <= now + 60_000;
	};
	const alerts = (wall.alerts ?? []).filter((a) => fresh(a.time, WALL_ALERT.hours));
	const titles = new Set(alerts.map((a) => a.title));
	const best = (wall.headlines ?? [])
		.filter((h) => fresh(h.first, BIG_STORY.hours) && !titles.has(h.title))
		.reduce((m, h) => Math.max(m, h.sources), 0);
	const reasons: string[] = [];
	let score = 2 * alerts.length;
	for (const a of alerts.slice(0, 3)) reasons.push(a.title);
	if (alerts.length > 3) reasons.push(`y ${alerts.length - 3} avisos más`);
	if (best >= BIG_STORY.huge) score += 2;
	else if (best >= BIG_STORY.big) score += 1;
	if (best >= BIG_STORY.big) reasons.push(`Tema principal en ${best} medios`);
	const level = (score === 0 ? 1 : score === 1 ? 2 : score <= 3 ? 3 : score <= 5 ? 4 : 5) as AlertLevel['level'];
	if (!reasons.length) reasons.push('Sin avisos graves en las últimas horas');
	return { level, label: LEVELS[level - 1], reasons };
}

export type Health = 'ok' | 'degradado' | 'caido' | 'sin-datos';

export interface Feed {
	id: string;
	label: string;
	health: Health;
	/** La descarga más reciente del grupo (ISO 8601). */
	at: string | null;
}

/** Los grupos de fuentes que la franja enseña con su piloto (nombres de scripts/sources). */
export const FEEDS = [
	{ id: 'imp', label: 'IMP', sources: ['imp', ...NEWS_SECTIONS.map((n) => `news-${n.key}`)] },
	{ id: 'geo', label: 'GEO', sources: ['quakes', 'gdacs', 'hazards', 'navwarn'] },
	{ id: 'mkt', label: 'MERC', sources: ['crypto', 'finnhub', 'uscurve', 'vix'] },
	{ id: 'mac', label: 'MACRO', sources: ['ecb', 'eurostat', 'bls', 'fred'] }
] as const;

const LIVE = new Set<SourceStatus['state']>(['ok', 'cached']);

/**
 * Va: descargada o con copia reciente, y (con `now`) sin pasarse de dos veces su ritmo más media hora. Si se
 * paran las Actions, status.json se queda con «ok» y los pilotos tienen que dejar de estar en verde.
 */
export function isLive(s: SourceStatus, now?: number): boolean {
	if (!LIVE.has(s.state)) return false;
	if (now === undefined || !s.fetchedAt) return true;
	const t = Date.parse(s.fetchedAt);
	return !Number.isFinite(t) || now - t <= (2 * (s.maxAgeMinutes ?? 30) + 30) * 60_000;
}

/** Piloto de un grupo: verde si todas van, ámbar si alguna tira de copia vieja o falla, rojo si ninguna va. */
export function feedHealth(status: SourceStatus[], names: readonly string[], now?: number): Health {
	const mine = status.filter((s) => names.includes(s.name) && s.state !== 'off');
	if (!mine.length) return 'sin-datos';
	const live = mine.filter((s) => isLive(s, now)).length;
	return live === mine.length ? 'ok' : live === 0 ? 'caido' : 'degradado';
}

export function feeds(status: SourceStatus[], now?: number): Feed[] {
	return FEEDS.map((f) => {
		const at = status
			.filter((s) => (f.sources as readonly string[]).includes(s.name) && s.fetchedAt)
			.map((s) => s.fetchedAt!)
			.sort()
			.at(-1);
		return { id: f.id, label: f.label, health: feedHealth(status, f.sources, now), at: at ?? null };
	});
}

/** «87/92»: cuántas fuentes van (ok o copia reciente) de las que deberían ir (sin contar las que no tienen clave). */
export function sourcesLive(status: SourceStatus[], now?: number): { live: number; total: number } {
	const on = status.filter((s) => s.state !== 'off');
	return { live: on.filter((s) => isLive(s, now)).length, total: on.length };
}

/** «14:05:09» en esa zona horaria. */
export function hms(tz: string, now: number): string {
	return new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
}

/** Fecha corta en mayúsculas al estilo de un parte: «15 OCT 2026». */
export function dateTag(tz: string, now: number): string {
	const p = new Intl.DateTimeFormat('es-ES', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(now);
	const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
	return `${get('day')} ${get('month').replace('.', '').toUpperCase()} ${get('year')}`;
}
