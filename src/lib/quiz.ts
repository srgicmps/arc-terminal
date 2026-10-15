// F24 «Test de la semana» (TEST): cinco preguntas hechas con los datos y titulares de la semana, sin IA.
// Sin deporte (decisión de Sergi).
// Se generan al construir la web con reglas fijas y un sorteo que depende solo de la semana: todos los de casa
// ven las mismas preguntas en el mismo orden. Cada uno guarda su puntuación en su cuenta (clave arc-quiz).
import { findCountries } from './countries.ts';
import type { ImpEntry, Quake } from './types.ts';
import type { WeekMarket } from './week.ts';

export interface Question {
	id: string;
	/** Tema, para la etiqueta: «Titulares», «Mercados», «Mundo». */
	topic: string;
	q: string;
	options: string[];
	answer: number;
	/** Lo que se enseña al contestar. */
	explain: string;
	url?: string;
}

export interface Quiz {
	/** «2026-W42». */
	week: string;
	questions: Question[];
}

/** Semana ISO de una fecha: «2026-W42». */
export function isoWeek(t: number): string {
	const d = new Date(t);
	const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const dow = day.getUTCDay() || 7;
	day.setUTCDate(day.getUTCDate() + 4 - dow);
	const year = day.getUTCFullYear();
	const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
	return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Generador pseudoaleatorio con semilla (mulberry32): mismo texto, misma secuencia. */
export function seeded(text: string): () => number {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return () => {
		h = (h + 0x6d2b79f5) | 0;
		let t = Math.imul(h ^ (h >>> 15), 1 | h);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** Junta la respuesta y tres distractores distintos, y los baraja. Sin tres distractores, no hay pregunta. */
function options(correct: string, pool: string[], rnd: () => number): { options: string[]; answer: number } | null {
	const wrong = shuffle([...new Set(pool.filter((p) => p !== correct))], rnd).slice(0, 3);
	if (wrong.length < 3) return null;
	const all = shuffle([correct, ...wrong], rnd);
	return { options: all, answer: all.indexOf(correct) };
}

/** Países de reserva para los distractores, si los titulares no dan bastantes. */
const FALLBACK_COUNTRIES = ['Francia', 'Alemania', 'China', 'Japón', 'Brasil', 'India', 'Italia', 'México', 'Rusia', 'Reino Unido'];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** «Completa el titular»: tapa el país que nombra un titular importante de la semana. */
export function headlineQuestions(top: ImpEntry[], rnd: () => number, max = 2): Question[] {
	const titled = top.map((e) => ({ e, title: e.titleEs ?? e.title }));
	const named = titled.map((t) => ({ ...t, countries: findCountries(t.title) }));
	const pool = [...new Set([...named.flatMap((n) => n.countries.map((c) => c.name)), ...FALLBACK_COUNTRIES])];
	const out: Question[] = [];
	for (const n of named) {
		if (out.length >= max) break;
		const c = n.countries[0];
		if (!c) continue;
		// El nombre tal y como sale en el titular (en español o uno de sus alias).
		const spelled = [c.name, ...(c.aliases ?? [])].find((a) => new RegExp(`(?<![\\p{L}])${escape(a)}(?![\\p{L}])`, 'u').test(n.title));
		if (!spelled) continue;
		const blank = n.title.replace(new RegExp(`(?<![\\p{L}])${escape(spelled)}(?![\\p{L}])`, 'u'), '___');
		const o = options(c.name, pool, rnd);
		if (!o) continue;
		out.push({
			id: `h-${n.e.k}`,
			topic: 'Titulares',
			q: `Completa este titular de la semana: «${blank}»`,
			...o,
			explain: `Era ${c.name}. Lo contaron ${n.e.sources.length} ${n.e.sources.length === 1 ? 'medio' : 'medios'}.`,
			url: n.e.url
		});
	}
	return out;
}

/** «¿Subió o bajó…?»: con la variación en 7 días de un mercado. «Mucho» es más de un 2 % (o 10 pb en tipos). */
export function marketQuestion(markets: WeekMarket[], rnd: () => number): Question | null {
	const usable = markets.filter((m) => m.change !== null && m.change !== 0);
	if (!usable.length) return null;
	const m = usable[Math.floor(rnd() * usable.length)];
	const big = m.kind === 'pb' ? 10 : 2;
	const ch = m.change!;
	const answer = ch > 0 ? (ch > big ? 0 : 1) : ch < -big ? 3 : 2;
	const unit = m.kind === 'pb' ? ' pb' : ' %';
	const shown = `${ch > 0 ? '+' : ''}${ch.toLocaleString('es-ES', { maximumFractionDigits: m.kind === 'pb' ? 0 : 1 })}${unit}`;
	return {
		id: `m-${m.label}`,
		topic: 'Mercados',
		q: `En los últimos 7 días, ¿qué hizo ${m.label}?`,
		options: [0, 1, 2, 3].map((i) => labelFor(i, big, m.kind)),
		answer,
		explain: `Se movió ${shown} en la semana (${m.source}).`
	};
}

function labelFor(i: number, big: number, kind: 'pct' | 'pb'): string {
	const u = kind === 'pb' ? ` ${big} pb` : ` un ${big} %`;
	return [`Subió más de${u}`, `Subió, pero menos de${u}`, `Bajó, pero menos de${u}`, `Bajó más de${u}`][i];
}

/** Dónde fue el terremoto más fuerte de los últimos 7 días (con el país en español si se reconoce). */
export function quakeQuestion(quakes: Quake[], now: number, rnd: () => number): Question | null {
	const week = quakes.filter((q) => Date.parse(q.time) >= now - 7 * 86_400_000);
	if (!week.length) return null;
	const where = (q: Quake) => findCountries(q.place)[0]?.name ?? q.place.split(',').at(-1)!.trim();
	const strongest = [...week].sort((a, b) => b.mag - a.mag)[0];
	const correct = where(strongest);
	const o = options(correct, [...week.map(where), 'Japón', 'Chile', 'Indonesia', 'México', 'Turquía', 'Perú'], rnd);
	if (!o) return null;
	return {
		id: `q-${strongest.id}`,
		topic: 'Mundo',
		q: '¿Dónde fue el terremoto más fuerte de la semana?',
		...o,
		explain: `Magnitud ${strongest.mag.toLocaleString('es-ES', { maximumFractionDigits: 1 })}: ${strongest.place} (USGS).`,
		url: strongest.url
	};
}

/** Las cinco preguntas de la semana: tres de titulares, una de mercados y una del mundo, o lo que haya. */
export function buildQuiz(
	input: { top: ImpEntry[]; markets: WeekMarket[]; quakes: Quake[] },
	now: number,
	size = 5
): Quiz {
	const week = isoWeek(now);
	const rnd = seeded(week);
	const headlines = headlineQuestions(input.top, rnd, 4);
	const market = marketQuestion(input.markets, rnd);
	const quake = quakeQuestion(input.quakes, now, rnd);
	const picked = [...headlines.slice(0, 2), market, quake, ...headlines.slice(2)].filter((q): q is Question => !!q);
	return { week, questions: picked.slice(0, size) };
}

/** Nota de la semana en palabras. */
export function verdict(score: number, total: number): string {
	if (!total) return '';
	const r = score / total;
	if (r === 1) return '¡Pleno! Estás al día de todo.';
	if (r >= 0.6) return 'Muy bien: estás bastante al día.';
	if (r >= 0.4) return 'No está mal. Echa un vistazo a SEMANA.';
	return 'Semana movida: repasa SEMANA e IMP.';
}
