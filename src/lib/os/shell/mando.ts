// Aspecto «Mando» de Arc OS (centro de mando): el nivel de alerta global y el estado de las fuentes en vivo
// que enseñan su barra de arriba y su franja de abajo. Sale de lo que ya cargan los widgets (/data/muro.json y
// /data/status.json): ni datos nuevos ni IA. Lógica pura.
import type { SourceStatus } from '../../data.ts';
import type { WallData } from '../../exp/muro.ts';

export interface AlertLevel {
	/** De 1 (normal) a 5 (máximo). */
	level: 1 | 2 | 3 | 4 | 5;
	label: string;
	/** Por qué, en frases cortas (el título del indicador). */
	reasons: string[];
}

export const LEVELS = ['Normal', 'Vigilancia', 'Elevado', 'Alto', 'Máximo'] as const;

/** Medios que cubren un titular para que cuente como «tema grande» (y como «enorme»). */
export const BIG_STORY = { big: 5, huge: 8 };

/**
 * Nivel de alerta global: cada aviso grave de las últimas horas (los del muro: terremoto fuerte o tema enorme
 * en IMP, los mismos que los P1 al móvil) suma 2; el titular más cubierto suma 1 si es grande y 2 si es enorme.
 * 0 → 1 Normal · 1 → 2 · 2–3 → 3 · 4–5 → 4 · 6 o más → 5.
 */
export function alertLevel(wall: Pick<WallData, 'alerts' | 'headlines'> | null | undefined): AlertLevel {
	const alerts = wall?.alerts ?? [];
	const top = Math.max(0, ...(wall?.headlines ?? []).map((h) => h.sources));
	const reasons: string[] = [];
	let score = 2 * alerts.length;
	for (const a of alerts.slice(0, 3)) reasons.push(a.title);
	if (alerts.length > 3) reasons.push(`y ${alerts.length - 3} avisos más`);
	if (top >= BIG_STORY.huge) score += 2;
	else if (top >= BIG_STORY.big) score += 1;
	if (top >= BIG_STORY.big) reasons.push(`Tema principal en ${top} medios`);
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
	{ id: 'imp', label: 'IMP', sources: ['imp', 'news'] },
	{ id: 'geo', label: 'GEO', sources: ['quakes', 'gdacs', 'hazards', 'navwarn'] },
	{ id: 'mkt', label: 'MERC', sources: ['crypto', 'finnhub', 'uscurve', 'vix'] },
	{ id: 'mac', label: 'MACRO', sources: ['ecb', 'eurostat', 'bls', 'fred'] }
] as const;

const LIVE = new Set<SourceStatus['state']>(['ok', 'cached']);

/** Piloto de un grupo: verde si todas van, ámbar si alguna tira de copia vieja o falla, rojo si ninguna va. */
export function feedHealth(status: SourceStatus[], names: readonly string[]): Health {
	const mine = status.filter((s) => names.includes(s.name) && s.state !== 'off');
	if (!mine.length) return 'sin-datos';
	const live = mine.filter((s) => LIVE.has(s.state)).length;
	return live === mine.length ? 'ok' : live === 0 ? 'caido' : 'degradado';
}

export function feeds(status: SourceStatus[]): Feed[] {
	return FEEDS.map((f) => {
		const at = status
			.filter((s) => (f.sources as readonly string[]).includes(s.name) && s.fetchedAt)
			.map((s) => s.fetchedAt!)
			.sort()
			.at(-1);
		return { id: f.id, label: f.label, health: feedHealth(status, f.sources), at: at ?? null };
	});
}

/** «87/92»: cuántas fuentes van (ok o copia reciente) de las que deberían ir (sin contar las que no tienen clave). */
export function sourcesLive(status: SourceStatus[]): { live: number; total: number } {
	const on = status.filter((s) => s.state !== 'off');
	return { live: on.filter((s) => LIVE.has(s.state)).length, total: on.length };
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
