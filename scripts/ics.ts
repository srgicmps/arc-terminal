// Lector mínimo de calendarios iCalendar (.ics): solo los eventos, con su fecha en UTC y su título.
// Lo usan los calendarios de publicación de Eurostat, BLS e INE (scripts/sources/releases-cal.ts).

export interface IcsEvent {
	/** Inicio en ISO UTC («2026-10-30T10:00:00.000Z»); los de día entero, a las 00:00 de Madrid. */
	start: string;
	/** Si el evento no tiene hora (día entero). */
	allDay: boolean;
	summary: string;
	description: string;
	url: string;
}

/** Desdobla las líneas largas (las que siguen empiezan por espacio o tabulador). */
function unfold(text: string): string[] {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\n[ \t]/g, '')
		.split('\n');
}

/** Quita los escapes de los textos: «\,» «\;» «\n». */
const unescape = (v: string) =>
	v
		.replace(/\\n/gi, ' ')
		.replace(/\\([,;\\])/g, '$1')
		.trim();

/**
 * Minutos que la zona `tz` va por delante de UTC en ese instante (Europa/Madrid en verano: 120).
 * Con Intl, sin librerías de zonas horarias.
 */
function offsetMinutes(utc: Date, tz: string): number {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
			.formatToParts(utc)
			.map((p) => [p.type, p.value])
	);
	const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
	return Math.round((asUtc - utc.getTime()) / 60_000);
}

/** Hora local de `tz` a UTC (dos pasadas, por si cae justo en el cambio de hora). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
	const guess = Date.UTC(y, mo - 1, d, h, mi);
	let t = guess - offsetMinutes(new Date(guess), tz) * 60_000;
	t = guess - offsetMinutes(new Date(t), tz) * 60_000;
	return new Date(t);
}

/** «DTSTART;TZID=Europe/Madrid:20261030T090000» y variantes → Date. */
export function parseIcsDate(
	params: string,
	value: string,
	defaultTz = 'Europe/Madrid'
): { date: Date; allDay: boolean } | null {
	const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
	if (!m) return null;
	const [, y, mo, d, h, mi, , z] = m;
	if (h === undefined) return { date: zonedToUtc(+y, +mo, +d, 0, 0, 'Europe/Madrid'), allDay: true };
	if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), allDay: false };
	const tz = /TZID=([^;:]+)/.exec(params)?.[1]?.replace(/"/g, '') ?? defaultTz;
	try {
		return { date: zonedToUtc(+y, +mo, +d, +h, +mi, tz), allDay: false };
	} catch {
		// Zona que Intl no conoce: se toma la de por defecto.
		return { date: zonedToUtc(+y, +mo, +d, +h, +mi, defaultTz), allDay: false };
	}
}

/** Eventos de un .ics. `defaultTz`: la zona de las horas sin TZID ni «Z» (la del organismo). */
export function parseIcs(text: string, defaultTz = 'Europe/Madrid'): IcsEvent[] {
	const events: IcsEvent[] = [];
	let cur: Partial<IcsEvent> | null = null;
	for (const line of unfold(text)) {
		if (line.startsWith('BEGIN:VEVENT')) cur = { summary: '', description: '', url: '' };
		else if (line.startsWith('END:VEVENT')) {
			if (cur?.start && cur.summary) events.push(cur as IcsEvent);
			cur = null;
		} else if (cur) {
			const i = line.indexOf(':');
			if (i < 0) continue;
			const [name, ...params] = line.slice(0, i).split(';');
			const value = line.slice(i + 1);
			const key = name.toUpperCase();
			if (key === 'DTSTART') {
				const parsed = parseIcsDate(params.join(';'), value, defaultTz);
				if (parsed) {
					cur.start = parsed.date.toISOString();
					cur.allDay = parsed.allDay;
				}
			} else if (key === 'SUMMARY') cur.summary = unescape(value);
			else if (key === 'DESCRIPTION') cur.description = unescape(value).slice(0, 300);
			else if (key === 'URL') cur.url = value.trim();
		}
	}
	return events;
}
