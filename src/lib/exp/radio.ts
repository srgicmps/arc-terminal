// Radio (experiencia 6): un informativo hablado con lo de hoy. Se arma en bloques (titulares, mercados,
// economía, agenda, tus valores); cada bloque tiene lo que se lee en voz alta y lo que se ve en grande a la vez.
// La parte común se calcula al construir la web (/data/radio.json); la personal (tus valores), en el
// navegador. Lógica pura, sin Svelte, para probarla con Vitest. La voz es la del navegador (Web Speech).
import { earningsLine, myEarnings } from '../myearnings.ts';
import { TOPIC_LABEL } from '../nextrelease.ts';
import { trend } from '../summary.ts';
import type { Earnings, ImpCurrent, Point, Quote, ReleaseEvent } from '../types.ts';

export interface Line {
	text: string;
	lang?: 'es' | 'en';
}

export interface Item {
	label: string;
	value?: string;
	tone?: 'up' | 'down';
}

export interface Segment {
	id: string;
	title: string;
	/** La vista que amplía este bloque (ruta de la web, sin la base). */
	route: string;
	lines: Line[];
	items: Item[];
}

const nf = (v: number, d: number) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Series del bloque de mercados: id del catálogo de G, cómo se dice y cómo se mide el cambio. */
export const MARKET_SERIES = [
	{ id: 'uscurve-10A', name: 'el bono de Estados Unidos a 10 años', short: 'Bono EE. UU. 10 años', kind: 'rate' },
	{ id: 'bond10-de', name: 'el bono alemán a 10 años', short: 'Bund 10 años', kind: 'rate' },
	{ id: 'eurusd', name: 'el euro', short: 'EUR/USD', kind: 'fx' },
	{ id: 'wti', name: 'el petróleo WTI', short: 'Petróleo WTI', kind: 'price' },
	{ id: 'vix', name: 'el VIX, el índice del miedo', short: 'VIX', kind: 'price' }
] as const;

/** Series del bloque de economía, con su nombre para trend() de summary.ts. */
export const MACRO_SERIES = [
	{ id: 'ipc-es', label: 'La inflación en España' },
	{ id: 'inflation-ea', label: 'La de la zona euro' },
	{ id: 'cpi-us', label: 'La de Estados Unidos' },
	{ id: 'unemployment-es', label: 'El paro en España' },
	{ id: 'ecb-dfr', label: 'El tipo de depósito del BCE', decimals: 2 }
] as const;

/** «sube 5 puntos básicos», «baja un 1,2 %»… con el dato de antes y el de ahora. */
export function moveOf(kind: 'rate' | 'fx' | 'price', prev: number, last: number): { said: string; shown: string; tone?: 'up' | 'down' } {
	if (kind === 'rate') {
		const bp = Math.round((last - prev) * 100);
		const tone = bp > 0 ? 'up' : bp < 0 ? 'down' : undefined;
		const said = bp ? `${bp > 0 ? 'sube' : 'baja'} ${Math.abs(bp)} ${Math.abs(bp) === 1 ? 'punto básico' : 'puntos básicos'}` : 'sin cambios';
		return { said, shown: bp ? `${bp > 0 ? '+' : '−'}${Math.abs(bp)} pb` : '=', tone };
	}
	const pct = prev ? ((last - prev) / prev) * 100 : 0;
	const r = Math.round(pct * 10) / 10;
	const tone = r > 0 ? 'up' : r < 0 ? 'down' : undefined;
	const said = r ? `${r > 0 ? 'sube' : 'baja'} un ${nf(Math.abs(r), 1)} %` : 'sin apenas cambios';
	return { said, shown: r ? `${r > 0 ? '+' : '−'}${nf(Math.abs(r), 1)} %` : '=', tone };
}

export interface ProgramInput {
	now: number;
	headlines: Pick<ImpCurrent, 'title' | 'titleEs' | 'lang' | 'sources'>[];
	/** Puntos de cada serie que hace falta (los dos últimos bastan). */
	series: Record<string, Point[]>;
	/** Publicaciones de datos de hoy (día de Madrid). */
	releases: ReleaseEvent[];
}

const madridDay = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now);

/** La parte común del programa. Los bloques sin datos no salen. */
export function buildProgram({ now, headlines, series, releases }: ProgramInput): Segment[] {
	const out: Segment[] = [];
	const date = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(now);
	const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(now));
	const hello = hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
	out.push({ id: 'intro', title: 'Arc Radio', route: '/', lines: [{ text: `${hello}. Es ${date}. Esto es lo que hay que saber.` }], items: [{ label: date }] });

	const top = headlines.slice(0, 5);
	if (top.length)
		out.push({
			id: 'imp',
			title: 'Lo más importante',
			route: '/imp',
			// Un titular que sigue en inglés se lee entero con voz inglesa, sin la entradilla en español.
			lines: top.map((h, i) =>
				h.titleEs || h.lang !== 'en'
					? { text: `${i === 0 ? 'Primero' : i === top.length - 1 ? 'Y por último' : 'Además'}: ${h.titleEs ?? h.title}.`, lang: 'es' as const }
					: { text: `${h.title}.`, lang: 'en' as const }
			),
			items: top.map((h) => ({ label: h.titleEs ?? h.title, value: `${h.sources.length} medios` }))
		});

	const markets = MARKET_SERIES.flatMap((s) => {
		const p = series[s.id];
		if (!p || p.length < 2) return [];
		const last = p.at(-1)!.v;
		const m = moveOf(s.kind, p.at(-2)!.v, last);
		const value = s.kind === 'rate' ? `${nf(last, 2)} %` : nf(last, s.kind === 'fx' ? 4 : 2);
		const said = s.kind === 'fx' ? `${nf(last, 2)} dólares` : value;
		return [{ line: `${s.name}, ${said}, ${m.said}.`, item: { label: s.short, value: `${value}  ${m.shown}`, tone: m.tone } }];
	});
	if (markets.length)
		out.push({
			id: 'markets',
			title: 'Mercados',
			route: '/ws',
			lines: [{ text: 'En los mercados, frente al cierre anterior:' }, ...markets.map((m) => ({ text: m.line.charAt(0).toUpperCase() + m.line.slice(1) }))],
			items: markets.map((m) => m.item)
		});

	const macro = MACRO_SERIES.flatMap((s) => {
		const phrase = trend(s.label, series[s.id], 'decimals' in s ? s.decimals : 1);
		return phrase ? [{ phrase, label: s.label.replace(/^(La|El|La de la|La de) /, ''), value: series[s.id]!.at(-1)! }] : [];
	});
	if (macro.length)
		out.push({
			id: 'eco',
			title: 'Economía',
			route: '/eco',
			lines: macro.map((m) => ({ text: `${m.phrase}.` })),
			items: macro.map((m) => ({ label: m.phrase.replace(/ (sube|baja|sin cambios|en)\b.*/, ''), value: `${nf(m.value.v, 1)} % · ${m.value.t}` }))
		});

	const today = madridDay(now);
	const todays = releases.filter((r) => madridDay(Date.parse(r.date)) === today);
	if (todays.length) {
		const name = (r: ReleaseEvent) => (r.topic && TOPIC_LABEL[r.topic]) || r.title;
		const time = (r: ReleaseEvent) =>
			r.allDay ? '' : new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(Date.parse(r.date));
		out.push({
			id: 'agenda',
			title: 'Hoy se publica',
			route: '/cal',
			lines: [{ text: `Hoy se publica: ${todays.map((r) => `${name(r)}${time(r) ? `, a las ${time(r)}` : ''}`).join('; ')}.` }],
			items: todays.map((r) => ({ label: name(r), value: time(r) || r.source }))
		});
	}
	return out;
}

/** El bloque de tus valores (lista de MIS): cómo van hoy y si presentan resultados pronto. Null si no hay nada. */
export function personalSegment(codes: string[], quotes: Quote[], earnings: Earnings[], now: number): Segment | null {
	const today = madridDay(now);
	const mine = codes
		.map((c) => quotes.find((q) => q.symbol === c.replace(/^.*:/, '').toUpperCase()))
		.filter((q): q is Quote => !!q && q.changePct != null);
	const results = myEarnings(earnings, codes, today).filter((e) => e.date <= madridDay(now + 2 * 86_400_000));
	if (!mine.length && !results.length) return null;
	const lines: Line[] = mine.map((q) => ({
		text: `${q.symbol}, ${q.changePct! > 0 ? 'sube' : q.changePct! < 0 ? 'baja' : 'sin cambios'}${q.changePct ? ` un ${nf(Math.abs(q.changePct), 1)} %` : ''}.`
	}));
	for (const e of results) lines.push({ text: `${earningsLine(e, today).replace(' · ', ' presenta ')}.` });
	return {
		id: 'mine',
		title: 'Tus valores',
		route: '/mis',
		lines: [{ text: 'Tus valores.' }, ...lines],
		items: [
			...mine.map((q) => ({
				label: q.symbol,
				value: `${nf(q.price, 2)}  ${q.changePct! > 0 ? '+' : q.changePct! < 0 ? '−' : ''}${nf(Math.abs(q.changePct!), 1)} %`,
				tone: q.changePct! > 0 ? ('up' as const) : q.changePct! < 0 ? ('down' as const) : undefined
			})),
			...results.map((e) => ({ label: earningsLine(e, today) }))
		]
	};
}

export const OUTRO: Segment = { id: 'outro', title: 'Fin', route: '/', lines: [{ text: 'Eso es todo. Buen día.' }], items: [] };

/** Velocidades de la voz. */
export const RATES = ['0.9', '1', '1.15', '1.3'] as const;
