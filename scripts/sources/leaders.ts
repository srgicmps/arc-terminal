// Agenda pública de los líderes que sigue LIDER (src/lib/leaders.ts). Cada uno tiene su lector; si
// una agenda falla, ese líder sale sin agenda (solo con lo último que ha hecho) y los demás siguen.
// - Sánchez: la agenda del presidente en lamoncloa.gob.es es una página HTML por día, sin RSS.
// - Trump: Roll Call Factba.se publica la agenda de la Casa Blanca en JSON, con la hora de Washington.
import type { AgendaEvent, LeaderAgenda } from '../../src/lib/types.ts';
import { getJson, getText, list, madridDate, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;
const DAY = 86_400_000;

/** Diferencia en ms entre la hora local de `tz` y UTC en el instante `t`. */
function tzOffset(t: number, tz: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(t));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t;
}

/** «2026-10-15» y «08:00» en la zona `tz` → instante ISO en UTC (bien también en los cambios de hora). */
export function zoned(date: string, time: string, tz: string): string {
	const [y, mo, d] = date.split('-').map(Number);
	const [h, mi] = time.split(':').map(Number);
	const guess = Date.UTC(y, mo - 1, d, h, mi);
	let t = guess - tzOffset(guess, tz);
	t = guess - tzOffset(t, tz);
	return new Date(t).toISOString();
}

/** Días (AAAA-MM-DD) entre ayer y pasado mañana, para quedarse solo con eso. */
function window(now: number): { from: string; to: string } {
	const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
	return { from: iso(now - DAY), to: iso(now + 2 * DAY) };
}

// ---------- Sánchez (La Moncloa) ----------

export const moncloaUrl = (yyyymmdd: string) =>
	`https://www.lamoncloa.gob.es/presidente/agenda/Paginas/agenda.aspx?d=${yyyymmdd}`;

/**
 * Lee la agenda de un día. La página dice «Agenda del Presidente - 13.10.2026 Pedro Sánchez Presidente
 * del Gobierno 09:30 h. Preside la reunión del Consejo de Ministros, que se celebra en … 12:00 h. …» y
 * termina en «Imprimir». Si no hay actos, pone «No se han encontrado eventos».
 */
export function parseMoncloa(html: string, date: string): AgendaEvent[] {
	const text = plain(html, 1_000_000);
	const [d, m, y] = [date.slice(8, 10), date.slice(5, 7), date.slice(0, 4)];
	const start = text.indexOf(`Agenda del Presidente - ${d}.${m}.${y}`);
	if (start < 0) throw new Error(`la agenda de La Moncloa no tiene el formato esperado (${date})`);
	const end = text.indexOf('Imprimir', start);
	const body = text.slice(start, end < 0 ? undefined : end);
	if (/No se han encontrado eventos/i.test(body)) return [];
	const events: AgendaEvent[] = [];
	const re = /(\d{1,2}):(\d{2})\s*h\.\s*(.+?)(?=\s\d{1,2}:\d{2}\s*h\.|\s*\/\/|$)/g;
	for (const [, hh, mm, what] of body.matchAll(re)) {
		const title = what.trim().replace(/\s*\/\/.*$/, '');
		// «…, que se celebra en el Complejo de la Moncloa.» o «…, en Bruselas (Bélgica).»
		const place = title.match(/,\s(?:que se celebra\s)?en\s(?:el\s|la\s)?([^,.]+)\.?$/)?.[1] ?? '';
		events.push({ start: zoned(date, `${hh.padStart(2, '0')}:${mm}`, 'Europe/Madrid'), date, title: plain(title, 240), place: plain(place, 80) });
	}
	return events;
}

/** Agenda de ayer, hoy y mañana (días de Madrid). */
async function moncloa(): Promise<AgendaEvent[]> {
	const days = [-1, 0, 1].map((offset) => madridDate(offset));
	const pages = await Promise.all(days.map((d) => getText(moncloaUrl(d))));
	return pages.flatMap((html, i) => parseMoncloa(html, `${days[i].slice(0, 4)}-${days[i].slice(4, 6)}-${days[i].slice(6, 8)}`));
}

// ---------- Trump (Factba.se) ----------

export const FACTBASE = 'https://media-cdn.factba.se/rss/json/trump/calendar-full.json';

export function parseFactbase(body: unknown, now = Date.now()): AgendaEvent[] {
	const { from, to } = window(now);
	return list(body as Raw[])
		.filter((e) => typeof e?.date === 'string' && e.date >= from && e.date <= to)
		.map((e) => ({
			start: /^\d{2}:\d{2}/.test(e.time ?? '') ? zoned(e.date, e.time, 'America/New_York') : null,
			date: e.date,
			title: plain(e.details, 200).replace(/^TBD:\s*/i, ''),
			place: plain(e.location, 80)
		}))
		.filter((e) => e.title)
		.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}

// ---------- Todos ----------

interface Reader {
	id: string;
	source: { name: string; url: string };
	read: () => Promise<AgendaEvent[]>;
}

const READERS: Reader[] = [
	{
		id: 'sanchez',
		source: { name: 'La Moncloa', url: 'https://www.lamoncloa.gob.es/presidente/agenda/Paginas/agenda.aspx' },
		read: moncloa
	},
	{
		id: 'trump',
		source: { name: 'Roll Call Factba.se', url: 'https://rollcall.com/factbase/trump/topic/calendar/' },
		read: async () => parseFactbase(await getJson(FACTBASE))
	}
];

export const leaders: Source<LeaderAgenda[]> = {
	name: 'leaders',
	label: 'Agenda de los líderes · La Moncloa y Roll Call Factba.se',
	maxAgeMinutes: 30,
	async fetch(previous) {
		const out = await Promise.all(
			READERS.map(async ({ id, source, read }): Promise<LeaderAgenda> => {
				try {
					return { id, source, events: await read() };
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.log(`  leaders · ${id}: ${message}`);
					// Si falla, la agenda de la vez anterior sigue valiendo para hoy.
					const old = previous?.find((p) => p.id === id);
					return { id, source, events: old?.events ?? null, error: message };
				}
			})
		);
		if (out.every((l) => l.events === null)) throw new Error('no se ha podido leer ninguna agenda');
		return out;
	}
};
