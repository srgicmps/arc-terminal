// Vigilancia (Arc OS): tus «objetivos» (países, valores, líderes y palabras). Qué es cada uno, cómo se escribe,
// cómo se reconoce en un titular y cómo se guarda. Lógica pura, sin Svelte ni navegador, para probarla.
import { findEntity } from '../../../entities.ts';
import { BANKS } from '../../../meetings.ts';
import { COUNTRIES, findCountries, findCountry } from '../../../countries.ts';
import { LEADERS } from '../../../leaders.ts';
import { namePattern, names, plain } from '../../../news.ts';
import { fold } from '../../../search.ts';
import { TICKERS } from '../../../tickers.ts';
import { cleanWord } from '../../../useralerts.ts';

export type TargetKind = 'country' | 'ticker' | 'leader' | 'word';

/** Un objetivo: el tipo y su id (código ISO del país, código del valor, id del líder o la palabra tal cual). */
export interface Target {
	kind: TargetKind;
	id: string;
}

/** Tope de objetivos: cabe de sobra en los topes de la cuenta (cloud/prefs.ts). */
export const MAX_TARGETS = 24;

export const KIND_LABEL: Record<TargetKind, string> = { country: 'País', ticker: 'Valor', leader: 'Líder', word: 'Tema' };

export const keyOf = (t: Target) => `${t.kind}:${t.id}`;

const country = (id: string) => COUNTRIES.find((c) => c.code === id);
const ticker = (id: string) => TICKERS.find((t) => t.code === id);
const leader = (id: string) => LEADERS.find((l) => l.id === id);

/** El objetivo comprobado (que exista), o null. Las palabras pasan por cleanWord, como las de AVISOS. */
export function cleanTarget(raw: unknown): Target | null {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
	if (!o || typeof o.id !== 'string') return null;
	switch (o.kind) {
		case 'country':
			return country(o.id) ? { kind: 'country', id: o.id } : null;
		case 'ticker':
			return ticker(o.id) ? { kind: 'ticker', id: o.id } : null;
		case 'leader':
			return leader(o.id) ? { kind: 'leader', id: o.id } : null;
		case 'word': {
			const w = cleanWord(o.id);
			return w ? { kind: 'word', id: w } : null;
		}
		default:
			return null;
	}
}

/** Una lista de objetivos limpia: sin repetidos (las palabras, sin mirar mayúsculas ni tildes) y con tope. */
export function cleanTargets(raw: unknown, max = MAX_TARGETS): Target[] {
	if (!Array.isArray(raw)) return [];
	const out: Target[] = [];
	const seen = new Set<string>();
	for (const r of raw) {
		const t = cleanTarget(r);
		const k = t && (t.kind === 'word' ? `word:${fold(t.id)}` : keyOf(t));
		if (t && k && !seen.has(k)) {
			seen.add(k);
			out.push(t);
		}
	}
	return out.slice(0, max);
}

/** Lo escrito en el buscador → un objetivo: un valor, un líder, un país o, si no es nada de eso, una palabra. */
export function targetFromQuery(query: string): Target | null {
	const q = query.trim();
	if (!q) return null;
	const e = findEntity(q);
	if (e?.kind === 'ticker') return { kind: 'ticker', id: e.ticker.code };
	if (e?.kind === 'leader') return { kind: 'leader', id: e.leader.id };
	if (e?.kind === 'country') return { kind: 'country', id: e.country.code };
	// Un banco central se vigila por su nombre corto («BCE», «Fed»).
	if (e?.kind === 'bank') return { kind: 'word', id: BANKS[e.bank].name };
	const w = cleanWord(q);
	return w ? { kind: 'word', id: w } : null;
}

/** Sugerencias mientras se escribe (por el principio del nombre o del código), sin repetir. */
export function suggest(query: string, limit = 6): Target[] {
	const q = fold(query.trim());
	if (q.length < 2) return [];
	const starts = (s: string) => fold(s).startsWith(q) || fold(s).split(/\s+/).some((w) => w.startsWith(q));
	const out: Target[] = [
		...TICKERS.filter((t) => fold(t.code) === q || starts(t.name) || (t.aliases ?? []).some(starts)).map((t) => ({ kind: 'ticker' as const, id: t.code })),
		...COUNTRIES.filter((c) => fold(c.code) === q || starts(c.name) || (c.aliases ?? []).some((a) => fold(a).startsWith(q))).map((c) => ({ kind: 'country' as const, id: c.code })),
		...LEADERS.filter((l) => starts(l.name) || l.aliases.some(starts)).map((l) => ({ kind: 'leader' as const, id: l.id }))
	];
	const exact = targetFromQuery(query);
	if (exact && !out.some((t) => keyOf(t) === keyOf(exact))) out.unshift(exact);
	return out.slice(0, limit);
}

/** Cómo se llama en la tarjeta: «Japón», «NVIDIA (NVDA)», «Christine Lagarde», «aranceles». */
export function labelOf(t: Target): string {
	if (t.kind === 'country') return country(t.id)?.name ?? t.id;
	if (t.kind === 'ticker') {
		const k = ticker(t.id);
		return k && fold(k.name) !== fold(k.code) ? `${k.name.replace(/\s*\(.*\)\s*$/, '')} · ${k.code}` : t.id;
	}
	if (t.kind === 'leader') return leader(t.id)?.name ?? t.id;
	return t.id;
}

/**
 * ¿Lo nombra este texto? Países con findCountries (los nombres largos ganan: «Corea del Norte» no es «Corea»),
 * valores por su nombre y alias (y el código si tiene 3 letras o más), líderes por el nombre o el apellido, y
 * palabras enteras sin mirar tildes ni mayúsculas (salvo la inicial del nombre corto de un banco: «Fed», no «fed»).
 */
export function matcher(t: Target): (text: string) => boolean {
	if (t.kind === 'country') return (text) => findCountries(text).some((c) => c.code === t.id);
	let pats: RegExp[] = [];
	if (t.kind === 'ticker') {
		const k = ticker(t.id);
		pats = k ? names(k).map(namePattern) : [];
		// El código tal cual, en mayúsculas («AMD», no «amd»).
		if (k && k.code.length >= 3) pats.push(new RegExp(`(?<![\\p{L}\\p{N}])${k.code.replace('.', '\\.')}(?![\\p{L}\\p{N}])`, 'u'));
	} else if (t.kind === 'leader') {
		const l = leader(t.id);
		const last = l?.name.split(' ').slice(-1)[0];
		pats = l ? [l.name, ...(last && last.length >= 4 ? [last] : [])].map(namePattern) : [];
	} else {
		// El nombre corto de un banco central («Fed», «BCE») mira la mayúscula inicial: «fed» es un verbo en inglés.
		const bank = /^\p{Lu}/u.test(t.id) && Object.values(BANKS).some((b) => b.name === t.id);
		pats = [namePattern(bank ? t.id : t.id.toLowerCase())];
	}
	return (text) => {
		const p = plain(text);
		return pats.some((re) => re.test(p));
	};
}

/** El país de un objetivo, si lo tiene (para los sucesos de GEO): el país o el del líder. */
export function countryOf(t: Target): string | null {
	if (t.kind === 'country') return t.id;
	if (t.kind === 'leader') {
		const role = leader(t.id)?.role ?? '';
		const c = findCountry(role.split('·').slice(-1)[0]?.trim());
		return c?.code ?? null;
	}
	return null;
}

/** El símbolo de EE. UU. de un valor («NASDAQ:NVDA» → «NVDA»), para tus valores de AVISOS; null si no es de allí. */
export function usSymbol(t: Target): string | null {
	if (t.kind !== 'ticker') return null;
	const k = ticker(t.id);
	const [ex, sym] = (k?.tv ?? '').split(':');
	return k && /^(NASDAQ|NYSE|AMEX|NYSEARCA)$/.test(ex) && /^[A-Z0-9.]{1,12}$/.test(sym) && !k.name.includes('(ETF)') ? sym : null;
}

/** La palabra con la que se vigila en AVISOS lo que no es un valor de EE. UU.: el nombre del país, del líder o la palabra. */
export function alertWord(t: Target): string | null {
	if (t.kind === 'country') return country(t.id)?.name ?? null;
	if (t.kind === 'leader') return leader(t.id)?.name ?? null;
	if (t.kind === 'ticker') return ticker(t.id)?.name.replace(/\s*\(.*\)\s*$/, '') ?? null;
	return cleanWord(t.id);
}

/** Lo que se hace en AVISOS: el valor en tus valores (mis) o una palabra vigilada (words). */
export function alertPlan(t: Target): { kind: 'mis'; value: string } | { kind: 'word'; value: string } | null {
	const sym = usSymbol(t);
	if (sym) return { kind: 'mis', value: sym };
	const w = alertWord(t);
	return w ? { kind: 'word', value: w } : null;
}

/** ¿Ya está en tus avisos? */
export function inAlerts(t: Target, cfg: { mis: string[]; words: string[] }): boolean {
	const plan = alertPlan(t);
	if (!plan) return false;
	return plan.kind === 'mis' ? cfg.mis.includes(plan.value) : cfg.words.some((w) => fold(w) === fold(plan.value));
}

/**
 * Objetivos de ejemplo cuando no hay ninguno: tus valores de MIS y tus países favoritos (PAIS ☆). Si no hay nada,
 * unos generales (EE. UU., China, NVDA, la Fed y los aranceles).
 */
export function examples(mis: readonly string[], favCountries: readonly string[], max = 6): Target[] {
	const fromMis = mis.map((code) => {
		const c = code.includes(':') ? code.split(':')[1] : code;
		return TICKERS.find((t) => t.code === c.toUpperCase() || t.tv === code.toUpperCase());
	});
	const mine = cleanTargets([
		...favCountries.map((id) => ({ kind: 'country', id })),
		...fromMis.flatMap((t) => (t ? [{ kind: 'ticker', id: t.code }] : []))
	]);
	if (mine.length) return mine.slice(0, max);
	return cleanTargets([
		{ kind: 'country', id: 'US' },
		{ kind: 'country', id: 'CN' },
		{ kind: 'ticker', id: 'NVDA' },
		{ kind: 'leader', id: 'lagarde' },
		{ kind: 'word', id: 'aranceles' }
	]).slice(0, max);
}

