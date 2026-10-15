// Calendario de Arc OS: la rejilla del mes y qué hay cada día. Lógica pura (con tests); los datos llegan de
// /data/os-cal.json (festivos, publicaciones, resultados) y de tu cuenta (tus eventos y tus alarmas).
import type { Alarm } from '../clock/alarms.ts';

export interface CalFeed {
	holidays: { date: string; name: string; scope: string }[];
	releases: { date: string; allDay: boolean; title: string; source: string }[];
	earnings: { date: string; symbol: string; hour: string }[];
}

/** Un evento tuyo (clave arc-os-events, en la cuenta). */
export interface MyEvent {
	id: string;
	/** «2026-10-15» */
	date: string;
	/** «09:30» o vacío (todo el día). */
	time: string;
	title: string;
}

export const EVENTS_KEY = 'arc-os-events';
export const MAX_EVENTS = 300;

export const isEvents = (v: unknown): v is MyEvent[] =>
	Array.isArray(v) && v.every((e) => e && typeof e.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === 'string' && typeof e.time === 'string');

export type Kind = 'fiesta' | 'dato' | 'resultado' | 'alarma' | 'tuyo';

export interface DayItem {
	kind: Kind;
	time: string;
	text: string;
	/** Solo los tuyos: para borrarlos. */
	id?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** «2026-10-15» en hora local. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Las 6 semanas (42 días, de lunes a domingo) que enseña el mes. */
export function monthGrid(year: number, month: number): Date[] {
	const first = new Date(year, month, 1);
	const back = (first.getDay() + 6) % 7;
	return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - back + i));
}

const HOUR: Record<string, string> = { bmo: 'antes de abrir', amc: 'al cierre', dmh: 'en sesión' };

/**
 * Todo lo de un día, por hora (lo de todo el día, arriba). `mine`: valores de MIS para filtrar los resultados.
 * Las alarmas salen de hoy en adelante (en los días pasados no se sabe si existían).
 */
export function dayItems(day: string, feed: CalFeed | null, events: MyEvent[], alarms: Alarm[], mine: Set<string> | null, now = new Date()): DayItem[] {
	const out: DayItem[] = [];
	const today = isoDay(now);
	const weekday = new Date(`${day}T12:00:00`).getDay();
	for (const h of feed?.holidays ?? []) if (h.date === day) out.push({ kind: 'fiesta', time: '', text: `${h.name}${h.scope === 'IB' ? ' (Baleares)' : ''}` });
	for (const r of feed?.releases ?? []) {
		// Las de todo el día llegan como «AAAA-MM-DDT00:00:00Z»: el día es el escrito, no el de tu zona horaria
		// (en América, pasado a hora local, caerían el día antes).
		const d = new Date(r.date);
		if ((r.allDay ? r.date.slice(0, 10) : isoDay(d)) === day) out.push({ kind: 'dato', time: r.allDay ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`, text: `${r.title} · ${r.source}` });
	}
	for (const e of feed?.earnings ?? [])
		if (e.date === day && (!mine || mine.has(e.symbol))) out.push({ kind: 'resultado', time: '', text: `Resultados ${e.symbol}${HOUR[e.hour] ? ` · ${HOUR[e.hour]}` : ''}` });
	if (day >= today)
		for (const a of alarms)
			if (a.on && (a.days.length ? a.days.includes(weekday) : day === nextOnce(a, now))) out.push({ kind: 'alarma', time: a.time, text: a.label || 'Alarma' });
	for (const e of events) if (e.date === day) out.push({ kind: 'tuyo', time: e.time, text: e.title, id: e.id });
	return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Una alarma de una sola vez suena hoy si aún no ha pasado la hora; si no, mañana. */
function nextOnce(a: Alarm, now: Date): string {
	const [h, m] = a.time.split(':').map(Number);
	const d = new Date(now);
	if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) d.setDate(d.getDate() + 1);
	return isoDay(d);
}

/** Los tipos que hay un día (los puntos de la rejilla del mes). */
export const kindsOf = (items: DayItem[]) => [...new Set(items.map((i) => i.kind))];

/** Código de MIS sin la bolsa («NASDAQ:NVDA» → «NVDA»). */
export const bareSymbol = (code: string) => code.split(':').pop()!.toUpperCase();
