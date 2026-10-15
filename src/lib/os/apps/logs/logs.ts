// Centro de registros de Arc OS: junta en una sola lista (como el Visor de eventos) lo que ya publica la web
// (status.json, status-history.json, notify-log.json), los avisos del centro de notificaciones y lo que ha pasado
// en esta sesión. Lógica pura, con tests: normalizar, filtrar, resumir y exportar a CSV.
import { toCsv } from '../../../csv.ts';
import type { SourceHistory, SourceStatus } from '../../../data.ts';
import { ageMinutes, staleAfter } from '../../../freshness.ts';
import { hasWords } from '../../../search.ts';

export type Level = 'info' | 'aviso' | 'error';
/** De qué parte sale: fuentes de datos, avisos al móvil, centro de notificaciones o esta sesión. */
export type Kind = 'fuente' | 'movil' | 'sistema' | 'sesion';

export interface LogLine {
	/** Único en la lista (para el {#each}). */
	id: string;
	/** ISO 8601, o null si no se sabe (una fuente que nunca se ha descargado). */
	t: string | null;
	level: Level;
	kind: Kind;
	/** Lo que sale en la columna «Origen» (nombre de la fuente, «Móvil», «Sesión»…). */
	origin: string;
	msg: string;
}

export const LEVEL_TEXT: Record<Level, string> = { info: 'Info', aviso: 'Aviso', error: 'Error' };

const STATE_MSG: Record<SourceStatus['state'], string> = {
	ok: 'Descargada',
	cached: 'Al día (copia reciente)',
	stale: 'Falló: se usa la copia anterior',
	error: 'Sin datos',
	off: 'Sin clave'
};

/** Una línea por fuente: hora de la última descarga, estado, error y nivel. Si va con retraso, «caducada». */
export function fromStatus(list: SourceStatus[], now: number): LogLine[] {
	return list.map((s) => {
		const limit = staleAfter(s.maxAgeMinutes);
		const age = ageMinutes(s.fetchedAt, now);
		const old = (s.state === 'ok' || s.state === 'cached') && limit !== null && age !== null && age > limit;
		const level: Level = s.state === 'error' ? 'error' : s.state === 'stale' || old ? 'aviso' : 'info';
		let msg = old ? 'Caducada: lleva más del doble de lo normal sin refrescarse' : STATE_MSG[s.state];
		if (s.state === 'off' && s.requires) msg += ` (${s.requires})`;
		if (s.error) msg += ` · ${s.error}`;
		return { id: `src:${s.name}`, t: s.fetchedAt, level, kind: 'fuente', origin: s.label || s.name, msg };
	});
}

/**
 * Los cambios de estado de los últimos 7 días (status-history.json): cuándo falló o se cayó cada fuente y cuándo
 * se recuperó. Los tramos «en marcha» que no siguen a un fallo no se apuntan (serían cientos de líneas iguales).
 */
export function fromHistory(hist: SourceHistory[], labels: Record<string, string>): LogLine[] {
	const out: LogLine[] = [];
	for (const h of hist) {
		const spans = Array.isArray(h?.history) ? h.history : [];
		spans.forEach((sp, i) => {
			const prev = spans[i - 1]?.state;
			const good = sp.state === 'ok' || sp.state === 'cached';
			const wasBad = prev === 'stale' || prev === 'error';
			if (good && !wasBad) return;
			if (sp.state === 'off') return;
			const runs = Math.max(1, Math.floor(Number(sp.runs) || 1));
			const msg = good
				? 'Se recupera'
				: `${sp.state === 'error' ? 'Se cae: sin datos' : 'Empieza a fallar: copia anterior'} (${runs} ${runs === 1 ? 'pasada' : 'pasadas'})`;
			out.push({
				id: `hist:${h.name}:${sp.t}`,
				t: sp.t,
				level: good ? 'info' : sp.state === 'error' ? 'error' : 'aviso',
				kind: 'fuente',
				origin: labels[h.name] ?? h.name,
				msg
			});
		});
	}
	return out;
}

/** Una entrada de notify-log.json (público: id, hora, resultado y nivel; nunca el tema de ntfy). */
export interface NotifyEntry {
	k: string;
	t: string;
	s: 'sent' | 'failed' | 'baseline';
	p?: 1 | 2 | 3 | 4;
}

/** Qué es cada aviso según el principio de su id (scripts/alerts/rules.ts). */
const TOPIC: Record<string, string> = {
	quake: 'Terremoto', rate: 'Tipos oficiales', imp: 'Titular importante', strait: 'Estrecho', war: 'Guerra',
	conflict: 'Conflicto', macro: 'Dato macro', mkt: 'Mercados', eia: 'Petróleo (EIA)', vix: 'VIX', 'vix-inv': 'VIX',
	auction: 'Subasta del Tesoro', fedreg: 'Federal Register', gas: 'Gas', diesel: 'Diésel', vote: 'Elecciones',
	'vote-result': 'Elecciones', ai: 'IA', stock: 'Valor', hy: 'Bonos high yield', liquidity: 'Liquidez',
	poly: 'Polymarket', earn: 'Resultados', down: 'Fuente caída', luz: 'Luz', manana: 'Mañana', dst: 'Cambio de hora',
	launch: 'Lanzamiento', morning: 'Resumen de la mañana', evening: 'Resumen de la tarde', casa: 'En casa'
};

const RESULT: Record<NotifyEntry['s'], string> = { sent: 'Enviado', failed: 'No se pudo enviar', baseline: 'Visto sin enviar' };

export function fromNotifyLog(entries: unknown): LogLine[] {
	if (!Array.isArray(entries)) return [];
	return entries
		.filter((e): e is NotifyEntry => !!e && typeof e.k === 'string' && typeof e.t === 'string')
		.map((e, i) => {
			const head = e.k.split(':')[0];
			const topic = TOPIC[head] ?? head;
			const level: Level = e.s === 'failed' ? 'error' : e.p === 1 && e.s === 'sent' ? 'aviso' : 'info';
			return {
				id: `ntfy:${i}:${e.k}`,
				t: e.t,
				level,
				kind: 'movil',
				origin: e.p ? `Móvil · P${e.p}` : 'Móvil',
				msg: `${RESULT[e.s] ?? e.s}: ${topic} · ${e.k}`
			};
		});
}

/** Lo que enseña el centro de notificaciones de Arc OS (avisos gordos y novedades de la web). */
export function fromNotices(list: { id: string; kind: 'aviso' | 'novedad'; title: string; detail: string; time: string }[]): LogLine[] {
	return list.map((n) => ({
		id: `not:${n.id}`,
		t: n.time,
		level: n.kind === 'aviso' ? 'aviso' : 'info',
		kind: 'sistema',
		origin: n.kind === 'aviso' ? 'Notificaciones' : 'Novedades',
		msg: n.detail ? `${n.title} · ${n.detail}` : n.title
	}));
}

/** Un hecho de esta sesión (session.svelte.ts). */
export interface SessionEvent {
	t: string;
	what: 'abre' | 'cierra';
	app: string;
}

export function fromSession(list: SessionEvent[]): LogLine[] {
	return list.map((e, i) => ({
		id: `ses:${i}:${e.t}`,
		t: e.t,
		level: 'info',
		kind: 'sesion',
		origin: 'Sesión',
		msg: `${e.what === 'abre' ? 'Abre' : 'Cierra'} ${e.app}`
	}));
}

/** Lo más reciente arriba; lo que no tiene hora, al final. */
export function sortLines(lines: LogLine[]): LogLine[] {
	return [...lines].sort((a, b) => (b.t ?? '').localeCompare(a.t ?? ''));
}

export type Range = 'hoy' | '7d' | 'todo';

/** Desde cuándo (ms) entra una línea en el intervalo; -Infinity si es «todo». Hoy: desde las 00:00 locales. */
export function rangeStart(range: Range, now: number): number {
	if (range === 'todo') return -Infinity;
	if (range === '7d') return now - 7 * 86_400_000;
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export interface Filter {
	/** Niveles que se ven (vacío: todos). */
	levels: Level[];
	/** Clases de origen (la pestaña): vacío, todas. */
	kinds: Kind[];
	/** Origen concreto («» = todos). */
	origin: string;
	/** queryWords de lo escrito en el buscador. */
	words: string[];
	range: Range;
	now: number;
}

export function filterLines(lines: LogLine[], f: Filter): LogLine[] {
	const from = rangeStart(f.range, f.now);
	return lines.filter((l) => {
		if (f.levels.length && !f.levels.includes(l.level)) return false;
		if (f.kinds.length && !f.kinds.includes(l.kind)) return false;
		if (f.origin && l.origin !== f.origin) return false;
		if (from > -Infinity) {
			const t = l.t ? Date.parse(l.t) : NaN;
			// Una fuente sin hora (nunca descargada) sigue siendo su estado actual: se enseña siempre.
			if (Number.isFinite(t) ? t < from : l.kind !== 'fuente') return false;
		}
		return !f.words.length || hasWords(`${l.origin} ${l.msg} ${LEVEL_TEXT[l.level]}`, f.words);
	});
}

/** Los orígenes que hay, por orden alfabético (para el desplegable). */
export const origins = (lines: LogLine[]) => [...new Set(lines.map((l) => l.origin))].sort((a, b) => a.localeCompare(b, 'es'));

/** Cifras de arriba: errores y avisos de la lista que se ve, y fuentes al día de status.json. */
export function summarize(lines: LogLine[], status: SourceStatus[], now: number) {
	const errors = lines.filter((l) => l.level === 'error').length;
	const warnings = lines.filter((l) => l.level === 'aviso').length;
	const active = status.filter((s) => s.state !== 'off');
	const fresh = fromStatus(active, now).filter((l) => l.level === 'info').length;
	return { errors, warnings, fresh, active: active.length };
}

/** Hora para la tabla: «14:05» si es de hoy, «12/10 14:05» si no, «—» si no hay. */
export function timeText(t: string | null, now: number): string {
	const ms = t ? Date.parse(t) : NaN;
	if (!Number.isFinite(ms)) return '—';
	const d = new Date(ms);
	const hm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
	return ms >= rangeStart('hoy', now) ? hm : `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

/** CSV para Excel (separador «;», BOM): hora ISO completa, nivel, origen y mensaje. */
export function linesCsv(lines: LogLine[]): string {
	return toCsv([['Hora', 'Nivel', 'Origen', 'Mensaje'], ...lines.map((l) => [l.t ?? '', LEVEL_TEXT[l.level], l.origin, l.msg])]);
}
