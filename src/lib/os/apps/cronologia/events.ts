// Línea de tiempo (Arc OS): cada fuente se normaliza a sucesos {t, lane, title, weight, href}. `weight` va
// de 0 a 1 y decide el tamaño del punto. Lógica pura: recibe el `data` de cada static/data/<nombre>.json.
import type { Czib } from '../../../czib.ts';
import { BANKS, MEETINGS, type Meeting } from '../../../meetings.ts';
import type { NavWarning } from '../../../navwarn.ts';
import type { AdvisoriesData, Earnings, GdacsEvent, ImpData, NewsData, Quake, ReleaseCalData } from '../../../types.ts';
import type { EventLane } from './lanes.ts';
import { zoned } from './scale.ts';

export interface TlEvent {
	/** Clave única (para el {#each} y para no repetir). */
	id: string;
	/** Instante en ms. */
	t: number;
	lane: EventLane;
	title: string;
	/** Detalle corto: medios, magnitud, organismo… */
	meta?: string;
	/** 0–1: tamaño del punto. */
	weight: number;
	/** Vista de la terminal que lo abre («/geo»). */
	href: string;
	/** Enlace a la fuente original, si lo hay. */
	url?: string;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ms = (iso: string | null | undefined) => {
	if (!iso) return NaN;
	const t = Date.parse(iso);
	return Number.isFinite(t) ? t : NaN;
};
/** «2026-10-14» → mediodía UTC de ese día (los históricos diarios no tienen hora). */
const noon = (date: string) => ms(`${date}T12:00:00Z`);
const valid = (e: TlEvent) => Number.isFinite(e.t) && !!e.title;

/**
 * IMP: un suceso por tema, en el primer momento en que se vio (la hora de `first` si es del top de ahora; si
 * no, el mediodía del primer día en que salió). Tamaño: raíz de la puntuación máxima frente a la mayor.
 */
export function fromImp(d: ImpData | null | undefined): TlEvent[] {
	if (!d) return [];
	const byKey = new Map<string, { t: number; title: string; url: string; score: number; sources: number }>();
	const days = [...(d.days ?? [])].sort((a, b) => a.date.localeCompare(b.date));
	for (const day of days) {
		for (const e of day.items ?? []) {
			const prev = byKey.get(e.k);
			const title = e.titleEs ?? e.title;
			if (!prev) byKey.set(e.k, { t: noon(day.date), title, url: e.url, score: e.score, sources: e.sources?.length ?? 0 });
			else if (e.score > prev.score) Object.assign(prev, { title, url: e.url, score: e.score, sources: Math.max(prev.sources, e.sources?.length ?? 0) });
		}
	}
	for (const e of d.current ?? []) {
		const t = ms(e.first) || ms(e.time);
		const prev = byKey.get(e.k);
		const title = e.titleEs ?? e.title;
		if (!prev) byKey.set(e.k, { t, title, url: e.url, score: e.score, sources: e.sources?.length ?? 0 });
		else {
			// El top de ahora sabe la hora exacta: manda sobre el mediodía del histórico si es del mismo día o antes.
			if (Number.isFinite(t) && t < prev.t + 12 * 3_600_000) prev.t = Math.min(prev.t, t);
			if (e.score > prev.score) Object.assign(prev, { title, url: e.url, score: e.score });
		}
	}
	const max = Math.max(1, ...[...byKey.values()].map((v) => v.score));
	return [...byKey.entries()]
		.map(([k, v]): TlEvent => ({
			id: `imp:${k}`,
			t: v.t,
			lane: 'imp',
			title: v.title,
			meta: `${v.score.toLocaleString('es-ES', { maximumFractionDigits: 1 })} puntos${v.sources ? ` · ${v.sources} medios` : ''}`,
			weight: clamp01(Math.sqrt(v.score / max)),
			href: '/imp',
			url: v.url
		}))
		.filter(valid);
}

/** Terremotos de USGS: tamaño por magnitud (4,5 → pequeño, 8 → máximo). */
export function fromQuakes(list: Quake[] | null | undefined): TlEvent[] {
	return (list ?? [])
		.map((q): TlEvent => ({
			id: `usgs:${q.id}`,
			t: ms(q.time),
			lane: 'tierra',
			title: `Terremoto M${q.mag.toFixed(1)} · ${q.place}`,
			meta: `USGS${q.alert ? ` · alerta ${ALERT[q.alert] ?? q.alert}` : ''}${q.tsunami ? ' · tsunami' : ''}`,
			weight: clamp01((q.mag - 4.5) / 3.5),
			href: '/geo',
			url: q.url
		}))
		.filter(valid);
}

const ALERT: Record<string, string> = { green: 'verde', yellow: 'amarilla', orange: 'naranja', red: 'roja' };

/** Alertas de GDACS: roja grande, naranja mediana; los terremotos que ya da USGS se quedan (otra fuente). */
export function fromGdacs(list: GdacsEvent[] | null | undefined): TlEvent[] {
	return (list ?? [])
		.map((g): TlEvent => ({
			id: `gdacs:${g.id}`,
			t: ms(g.from) || ms(g.updated),
			lane: 'tierra',
			title: `${g.kind}${g.name ? ` · ${g.name}` : g.country ? ` · ${g.country}` : ''}`,
			meta: `GDACS · alerta ${ALERT[g.level]}${g.severity ? ` · ${g.severity}` : ''}`,
			weight: g.level === 'red' ? 1 : 0.6,
			href: '/geo',
			url: g.url
		}))
		.filter(valid);
}

/** Avisos de viaje que han cambiado de nivel (cuándo se vio el cambio): más grande si sube a 3 o 4. */
export function fromAdvisories(d: AdvisoriesData | null | undefined): TlEvent[] {
	return (d?.items ?? [])
		.filter((a) => a.changedAt && a.prevLevel)
		.map((a): TlEvent => ({
			id: `adv:${a.name}:${a.changedAt}`,
			t: ms(a.changedAt),
			lane: 'avisos',
			title: `Aviso de viaje · ${a.name}: nivel ${a.prevLevel} → ${a.level}`,
			meta: 'Departamento de Estado de EE. UU.',
			weight: a.level >= 3 ? 0.8 : 0.4,
			href: '/geo',
			url: a.url
		}))
		.filter(valid);
}

/** Boletines de espacio aéreo en conflicto de la EASA: la última revisión (o la emisión). */
export function fromCzib(d: { items?: Czib[] } | null | undefined): TlEvent[] {
	return (d?.items ?? [])
		.map((c): TlEvent => ({
			id: `czib:${c.id}`,
			t: noon(c.revised ?? c.issued),
			lane: 'avisos',
			title: `Espacio aéreo · ${c.area}`,
			meta: `EASA · ${c.id}${c.revised ? ' (revisado)' : ''}`,
			weight: 0.6,
			href: '/geo',
			url: c.url
		}))
		.filter(valid);
}

/** Avisos a navegantes (NGA): pequeños, salvo minas o maniobras. */
export function fromNavwarn(d: { items?: NavWarning[] } | null | undefined): TlEvent[] {
	return (d?.items ?? [])
		.map((w): TlEvent => ({
			id: `nav:${w.id}`,
			t: ms(w.issued),
			lane: 'avisos',
			title: `${w.kind} · ${w.region}`,
			meta: `NGA · ${w.id}`,
			weight: /mina|militar|misil|disparo/i.test(w.kind) ? 0.5 : 0.25,
			href: '/geo'
		}))
		.filter(valid);
}

/** Publicaciones de datos (próximas y de los últimos días). Las de la terminal (con tema) pesan más. */
export function fromReleases(d: ReleaseCalData | null | undefined): TlEvent[] {
	const seen = new Set<string>();
	return [...(d?.past ?? []), ...(d?.events ?? [])]
		.map((r): TlEvent => ({
			id: `rel:${r.source}:${r.date}:${r.title}`,
			t: ms(r.date),
			lane: 'datos',
			title: r.title,
			meta: `${r.source}${r.allDay ? ' · sin hora' : ''}`,
			weight: r.topic ? 0.7 : 0.35,
			href: '/cal',
			url: r.url
		}))
		.filter((e) => valid(e) && !seen.has(e.id) && !!seen.add(e.id));
}

/** Hora aproximada de los resultados en Nueva York: antes de la apertura, durante la sesión o tras el cierre. */
const EARN_HOUR: Record<string, string> = { bmo: '08:00', amc: '16:30', dmh: '12:00' };

/** Resultados de Finnhub: tamaño por las ventas esperadas (escala logarítmica, de 100 M$ a 100 000 M$). */
export function fromEarnings(list: Earnings[] | null | undefined): TlEvent[] {
	return (list ?? [])
		.map((e): TlEvent => {
			const rev = e.revenueEstimate ?? 0;
			const w = rev > 0 ? (Math.log10(rev) - 8) / 3 : 0.1;
			return {
				id: `earn:${e.symbol}:${e.date}`,
				t: zoned(e.date, EARN_HOUR[e.hour] ?? '12:00', 'America/New_York'),
				lane: 'agenda',
				title: `Resultados de ${e.symbol}${e.quarter ? ` (T${e.quarter}${e.year ? ` ${e.year}` : ''})` : ''}`,
				meta: e.hour === 'bmo' ? 'Antes de la apertura' : e.hour === 'amc' ? 'Tras el cierre' : 'Finnhub',
				weight: clamp01(Math.max(0.1, w)),
				href: `/s?sym=${encodeURIComponent(e.symbol)}`
			};
		})
		.filter(valid);
}

/** Reuniones del BCE (14:15 de Fráncfort) y de la Fed (14:00 de Washington). Las de proyecciones pesan más. */
export function fromMeetings(list: Meeting[] = MEETINGS): TlEvent[] {
	return list.map(
		(m): TlEvent => ({
			id: `mtg:${m.bank}:${m.date}`,
			t: m.bank === 'ecb' ? zoned(m.date, '14:15', 'Europe/Berlin') : zoned(m.date, '14:00', 'America/New_York'),
			lane: 'bancos',
			title: `Decisión de tipos ${BANKS[m.bank].of}`,
			meta: m.sep ? `${BANKS[m.bank].long} · con proyecciones` : BANKS[m.bank].long,
			weight: m.sep ? 1 : 0.85,
			href: '/btmm',
			url: BANKS[m.bank].url
		})
	);
}

/** Discursos de banqueros centrales (BIS): pequeños. */
export function fromSpeeches(d: NewsData | null | undefined): TlEvent[] {
	return (d?.items ?? [])
		.map((s): TlEvent => ({
			id: `sp:${s.url}`,
			t: ms(s.time),
			lane: 'bancos',
			title: s.titleEs ?? s.title,
			meta: s.source ? `Discurso · ${s.source}` : 'Discurso',
			weight: 0.25,
			href: '/eco',
			url: s.url
		}))
		.filter(valid);
}

/** Lo que llega de static/data (cada uno puede faltar). */
export interface Sources {
	imp?: ImpData | null;
	quakes?: Quake[] | null;
	gdacs?: GdacsEvent[] | null;
	advisories?: AdvisoriesData | null;
	czib?: { items?: Czib[] } | null;
	navwarn?: { items?: NavWarning[] } | null;
	releases?: ReleaseCalData | null;
	finnhub?: { earnings?: Earnings[] } | null;
	speeches?: NewsData | null;
}

/** Todos los sucesos, por instante. Si una fuente viene rota, se salta y siguen las demás. */
export function allEvents(s: Sources, meetings: Meeting[] = MEETINGS): TlEvent[] {
	const parts: (() => TlEvent[])[] = [
		() => fromImp(s.imp),
		() => fromQuakes(s.quakes),
		() => fromGdacs(s.gdacs),
		() => fromAdvisories(s.advisories),
		() => fromCzib(s.czib),
		() => fromNavwarn(s.navwarn),
		() => fromReleases(s.releases),
		() => fromEarnings(s.finnhub?.earnings),
		() => fromMeetings(meetings),
		() => fromSpeeches(s.speeches)
	];
	return parts
		.flatMap((f) => {
			try {
				return f();
			} catch {
				return [];
			}
		})
		.sort((a, b) => a.t - b.t);
}
