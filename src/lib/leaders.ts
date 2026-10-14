// LIDER: qué hacen ahora los líderes que se siguen. Para añadir uno (Von der Leyen, Lagarde…), una
// entrada aquí y, si tiene agenda pública, su lector en scripts/sources/leaders.ts.
import { norm } from './cmdline.ts';
import { madridNow } from './power.ts';
import type { AgendaEvent, FedRegDoc, NewsItem } from './types.ts';

export interface Leader {
	/** Va en la URL: /lider?id=lagarde. */
	id: string;
	name: string;
	role: string;
	/** Otras formas de buscarlo en la barra («LIDER Lagarde», «LIDER BCE»). Sin tildes ni mayúsculas. */
	aliases: string[];
	/**
	 * Titulares que cuentan como «lo último»: de qué sección (news-gov, news-eco…), de qué medio y, si
	 * hace falta, qué texto tienen que llevar.
	 */
	news: { section: 'gov' | 'eco'; source: string; match?: RegExp }[];
	/** Si los documentos presidenciales del Federal Register son suyos. */
	fedreg?: boolean;
	/** De dónde sale «Lo último», para la cabecera del panel. */
	recentLabel: string;
}

export const LEADERS: Leader[] = [
	{
		id: 'sanchez',
		name: 'Pedro Sánchez',
		role: 'Presidente del Gobierno · España',
		aliases: ['sánchez', 'pedro sánchez', 'moncloa'],
		news: [{ section: 'gov', source: 'La Moncloa', match: /\b(presidente del gobierno|s[aá]nchez)\b/i }],
		recentLabel: 'Comunicados de La Moncloa'
	},
	{
		id: 'trump',
		name: 'Donald Trump',
		role: 'Presidente · Estados Unidos',
		aliases: ['trump', 'donald trump', 'casa blanca'],
		news: [{ section: 'gov', source: 'Casa Blanca' }],
		fedreg: true,
		recentLabel: 'Casa Blanca y Federal Register'
	},
	{
		id: 'lagarde',
		name: 'Christine Lagarde',
		role: 'Presidenta · Banco Central Europeo',
		aliases: ['lagarde', 'christine lagarde', 'bce'],
		news: [{ section: 'eco', source: 'BCE', match: /\bLagarde\b/i }],
		recentLabel: 'Discursos y entrevistas del BCE'
	},
	{
		id: 'powell',
		name: 'Jerome Powell',
		// Su mandato de presidente acababa en mayo de 2026; sigue en la Junta de Gobernadores (hasta 2028).
		role: 'Reserva Federal · Estados Unidos',
		aliases: ['powell', 'jerome powell', 'fed', 'reserva federal'],
		news: [{ section: 'gov', source: 'Reserva Federal', match: /\bPowell\b/i }],
		recentLabel: 'Comunicados de la Reserva Federal'
	},
	{
		id: 'vonderleyen',
		name: 'Ursula von der Leyen',
		role: 'Presidenta · Comisión Europea',
		aliases: ['von der leyen', 'ursula von der leyen', 'comisión europea'],
		news: [{ section: 'gov', source: 'Comisión Europea', match: /\bvon der Leyen\b/i }],
		recentLabel: 'Comunicados de la Comisión Europea'
	}
];

/** El líder de un texto: su id, su nombre, un alias o el principio del nombre («lag»). */
export function findLeader(text: string | null | undefined): Leader | undefined {
	const q = norm(text ?? '').trim();
	if (!q) return undefined;
	const names = (l: Leader) => [l.id, l.name, ...l.aliases].map(norm);
	return (
		LEADERS.find((l) => names(l).includes(q)) ??
		(q.length >= 3 ? LEADERS.find((l) => names(l).some((n) => n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q)))) : undefined)
	);
}

/** Día de Madrid (AAAA-MM-DD) de un instante. */
const madridDay = (t: number) => madridNow(t).day;

/**
 * Los actos de hoy en hora de Madrid. Los que no tienen hora cuentan si son de hoy en el día del
 * propio líder. Primero los que no tienen hora, luego por hora.
 */
export function today(events: AgendaEvent[], now: number): AgendaEvent[] {
	const day = madridDay(now);
	return events
		.filter((e) => (e.start ? madridDay(Date.parse(e.start)) === day : e.date === day))
		.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}

/** El acto en curso (empezó hace menos de 2 h y no ha empezado otro) y el siguiente. */
export function nowNext(events: AgendaEvent[], now: number): { current: AgendaEvent | null; next: AgendaEvent | null } {
	const timed = events.filter((e) => e.start).sort((a, b) => a.start!.localeCompare(b.start!));
	const started = timed.filter((e) => Date.parse(e.start!) <= now);
	const last = started.at(-1) ?? null;
	const current = last && now - Date.parse(last.start!) < 2 * 3600_000 ? last : null;
	const next = timed.find((e) => Date.parse(e.start!) > now) ?? null;
	return { current, next };
}

/** Lo último que ha hecho: sus comunicados y, si toca, sus documentos del Federal Register. */
export function recent(
	leader: Leader,
	sections: Partial<Record<'gov' | 'eco', NewsItem[]>>,
	fedreg: FedRegDoc[] = [],
	max = 8
): NewsItem[] {
	const news = leader.news.flatMap((n) =>
		(sections[n.section] ?? []).filter((item) => item.source === n.source && (!n.match || n.match.test(`${item.title} ${item.summary}`)))
	);
	const docs: NewsItem[] = leader.fedreg
		? fedreg.map((d) => ({ title: d.title, url: d.url, source: 'Federal Register', time: `${d.date}T12:00:00Z`, summary: '' }))
		: [];
	return [...news, ...docs].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? '')).slice(0, max);
}
