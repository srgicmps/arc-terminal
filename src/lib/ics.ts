// Agenda suscribible (.ics, RFC 5545) para el calendario del móvil: decisiones de los bancos centrales,
// publicaciones de datos macro y resultados de grandes empresas. La genera src/routes/agenda.ics/+server.ts al
// construir la web en la Action, así que se renueva con cada publicación.
// Las horas van en UTC (sufijo Z): cada calendario las pasa a la zona del móvil sin ambigüedad, también en los
// cambios de hora. En la descripción se escribe además la hora de Madrid.
import { CB, type CbMeeting } from './cb-calendar.ts';
import { madridDate } from './meetings.ts';
import type { Earnings, ReleaseEvent } from './types.ts';

export interface IcsEvent {
	uid: string;
	title: string;
	/** Instante ISO (UTC) o, si `allDay`, el día «AAAA-MM-DD». */
	start: string;
	allDay: boolean;
	/** Minutos (solo con hora). */
	minutes?: number;
	description?: string;
	url?: string;
}

/**
 * Sufijo de los UID. Es el dominio antiguo a propósito: si cambiara, los calendarios ya suscritos
 * duplicarían los eventos. Solo identifica, no es un enlace.
 */
const DOMAIN = 'srgicmps.github.io';
const MADRID = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

/** «14:15 (hora de Madrid)». */
export const madridTime = (iso: string) => `${MADRID.format(new Date(iso))} (hora de Madrid)`;

/** Texto escapado para un valor del .ics: barra, punto y coma, coma y saltos de línea. */
export function escape(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Parte una línea en trozos de 75 octetos como mucho; las siguientes empiezan por un espacio. */
export function fold(line: string): string {
	const bytes = new TextEncoder();
	const out: string[] = [];
	let cur = '';
	for (const ch of line) {
		const limit = out.length ? 74 : 75;
		if (bytes.encode(cur + ch).length > limit) {
			out.push(cur);
			cur = ch;
		} else cur += ch;
	}
	out.push(cur);
	return out.join('\r\n ');
}

/** «2026-10-29T13:15:00.000Z» → «20261029T131500Z». */
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (date: string) => date.slice(0, 10).replace(/-/g, '');
function nextDay(date: string): string {
	const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/** Identificador estable a partir de un texto: así el calendario actualiza el evento en vez de duplicarlo. */
export const slug = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export function calendar(events: IcsEvent[], now: string, name = 'Arc Terminal · Agenda'): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Arc Terminal//Agenda//ES',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escape(name)}`,
		'X-WR-TIMEZONE:Europe/Madrid',
		'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
		'X-PUBLISHED-TTL:PT6H'
	];
	for (const e of events) {
		lines.push('BEGIN:VEVENT', `UID:${e.uid}@${DOMAIN}`, `DTSTAMP:${stamp(now)}`);
		if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(nextDay(e.start))}`);
		else lines.push(`DTSTART:${stamp(e.start)}`, `DURATION:PT${e.minutes ?? 30}M`);
		lines.push(`SUMMARY:${escape(e.title)}`, 'TRANSP:TRANSPARENT');
		if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
		if (e.url) lines.push(`URL:${e.url}`);
		lines.push('END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}

/** Decisión de tipos de un banco central. */
export function meetingEvent(m: CbMeeting): IcsEvent {
	const cb = CB[m.bank];
	const extra = m.report ? (m.bank === 'fed' ? ' (con proyecciones)' : ' (con informe)') : '';
	return {
		uid: `cb-${m.bank}-${m.date}`,
		title: `${cb.name}: decisión de tipos${extra}`,
		start: m.at ?? m.date,
		allDay: !m.at,
		description: [cb.long, m.at ? `Anuncio: ${madridTime(m.at)}` : 'Sin hora fija de anuncio'].join('\n'),
		url: cb.url
	};
}

/** Publicación de un dato macro (calendarios de Eurostat, BLS, INE, BEA…). */
export function releaseEvent(r: ReleaseEvent): IcsEvent {
	// Un dato «de día completo» llega como la medianoche de Madrid en UTC (el 30 → «29T22:00Z»): el día, en Madrid.
	const date = madridDate(Date.parse(r.date));
	return {
		uid: `dato-${slug(r.source)}-${date}-${slug(r.title)}`,
		title: `${r.source}: ${r.title}`,
		start: r.allDay ? date : r.date,
		allDay: r.allDay,
		minutes: 15,
		description: r.allDay ? `Dato de ${r.source}, sin hora publicada` : `Dato de ${r.source}: ${madridTime(r.date)}`,
		url: r.url
	};
}

const WHEN: Record<string, string> = { bmo: 'antes de la apertura', amc: 'tras el cierre', dmh: 'durante la sesión' };

/** Resultados de una empresa (Finnhub solo da el día y si es antes o después de la sesión de Nueva York). */
export function earningsEvent(e: Earnings): IcsEvent {
	const q = e.quarter && e.year ? ` T${e.quarter} ${e.year}` : '';
	const when = WHEN[e.hour];
	return {
		uid: `res-${slug(e.symbol)}-${e.date}`,
		title: `Resultados ${e.symbol}${q}`,
		start: e.date,
		allDay: true,
		description: when ? `Publica ${when} de Wall Street` : undefined
	};
}
