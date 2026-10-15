// El Expediente de una entidad: resumen (con plantillas, sin IA), datos clave, cronología, relaciones y
// enlaces a las vistas de Arc. Y su exportación a Markdown y JSON. Puro, con tests.
import type { CountryProfile } from '../../../country.ts';
import { COUNTRIES } from '../../../countries.ts';
import { LEADERS } from '../../../leaders.ts';
import { BANKS, upcoming, type Bank } from '../../../meetings.ts';
import { TICKERS } from '../../../tickers.ts';
import type { LeaderAgenda } from '../../../types.ts';
import { neighbors, whyText } from './graph.ts';
import { kindLabel, nodeId, tickerCountry, type Graph, type IntelNode, type IntelRef, type Kind } from './model.ts';

export interface Fact {
	label: string;
	value: string;
	/** Periodo o fuente, en pequeño. */
	note?: string;
}

export interface Related {
	id: string;
	kind: Kind;
	label: string;
	w: number;
	why: string;
}

export interface Dossier {
	id: string;
	kind: Kind;
	kindLabel: string;
	label: string;
	sub: string;
	summary: string;
	facts: Fact[];
	timeline: IntelRef[];
	/** Las más fuertes (hasta 40). */
	related: Related[];
	/** Con cuántas entidades se enlaza en total (puede ser más que related.length). */
	relatedTotal: number;
	at?: [number, number];
	/** Vistas de Arc donde seguir: ruta interna o enlace externo. */
	links: { label: string; href: string }[];
}

export interface DossierExtra {
	profile?: CountryProfile | null;
	agenda?: LeaderAgenda | null;
	/** «AAAA-MM-DD» de hoy (Madrid), para la próxima reunión de un banco. */
	today?: string;
}

const num = (v: number, unit = '') => `${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })}${unit ? (unit.startsWith('%') ? ' %' : ` ${unit}`) : ''}`;

function countryFacts(code: string, g: Graph, x: DossierExtra): Fact[] {
	const c = COUNTRIES.find((k) => k.code === code);
	if (!c) return [];
	const facts: Fact[] = [
		{ label: 'Códigos', value: `${c.code} · ${c.iso3}` },
		{ label: 'Moneda', value: c.currency + (c.euro ? ' (euro)' : '') },
		{ label: 'Banco central', value: c.euro ? 'BCE' : c.code === 'US' ? 'Fed' : '—' }
	];
	const leaders = neighbors(g, nodeId('country', code), { kinds: ['leader'] }).filter((n) => n.edge.why.cargo);
	if (leaders.length) facts.push({ label: 'Líderes que sigue Arc', value: leaders.map((l) => l.node.label).join(', ') });
	const p = x.profile;
	if (p) {
		for (const k of p.kpis) facts.push({ label: k.label, value: num(k.value, k.unit), note: `${k.t} · ${k.source}` });
		for (const r of [p.policy, p.bond, p.premium]) if (r) facts.push({ label: r.label, value: num(r.value, r.unit), note: `${r.t} · ${r.source}` });
		if (p.fiscal?.debt != null) facts.push({ label: 'Deuda pública (FMI)', value: num(p.fiscal.debt, '% PIB'), note: String(p.fiscal.year) });
	}
	return facts;
}

function leaderFacts(id: string, x: DossierExtra): Fact[] {
	const l = LEADERS.find((k) => k.id === id);
	if (!l) return [];
	const [role, place] = l.role.split('·').map((s) => s.trim());
	const facts: Fact[] = [{ label: 'Cargo', value: role }];
	if (place) facts.push({ label: 'Dónde', value: place });
	facts.push({ label: 'Lo último', value: l.recentLabel });
	for (const e of (x.agenda?.events ?? []).slice(0, 4)) facts.push({ label: 'Agenda', value: e.title, note: `${e.date}${e.place ? ` · ${e.place}` : ''}` });
	return facts;
}

function bankFacts(b: Bank, x: DossierExtra): Fact[] {
	const info = BANKS[b];
	const facts: Fact[] = [{ label: 'Nombre', value: info.long }];
	const next = x.today ? upcoming(x.today, b)[0] : undefined;
	if (next) facts.push({ label: 'Próxima reunión', value: next.date, note: next.sep ? 'con proyecciones' : undefined });
	const chair = LEADERS.find((l) => l.role.includes(info.long));
	if (chair) facts.push({ label: 'Preside', value: chair.name });
	return facts;
}

function tickerFacts(code: string): Fact[] {
	const t = TICKERS.find((k) => k.code === code);
	if (!t) return [];
	const c = tickerCountry(t);
	const facts: Fact[] = [
		{ label: 'Código', value: t.code },
		{ label: 'Símbolo', value: t.tv }
	];
	if (c) facts.push({ label: 'País', value: COUNTRIES.find((k) => k.code === c)?.name ?? c });
	if (t.cik) facts.push({ label: 'CIK (SEC)', value: t.cik });
	if (t.aliases?.length) facts.push({ label: 'También', value: t.aliases.join(', ') });
	return facts;
}

function dataFacts(n: IntelNode): Fact[] {
	const facts: Fact[] = [{ label: 'Qué es', value: n.sub }];
	if (n.date) facts.push({ label: 'Fecha', value: n.date });
	return facts;
}

function linksOf(n: IntelNode): Dossier['links'] {
	const news = { label: 'Titulares en NEWS', href: `/news?q=${encodeURIComponent(n.kind === 'ticker' ? n.key : n.label)}` };
	switch (n.kind) {
		case 'country':
			return [{ label: 'Ficha en PAIS', href: `/pais?c=${n.key}` }, news];
		case 'leader':
			return [{ label: 'Agenda en LIDER', href: `/lider?id=${n.key}` }, news];
		case 'ticker':
			return [{ label: 'Ficha del valor', href: `/s?sym=${encodeURIComponent(n.key)}` }, news];
		case 'bank':
			return [{ label: 'Tipos en ECO', href: '/eco' }, news];
		default:
			return n.url ? [{ label: 'Fuente original', href: n.url }] : [];
	}
}

/** El resumen, en una o dos frases con los datos del grafo. `total`: enlaces de verdad (related puede ir cortada). */
export function summaryOf(n: IntelNode, related: Related[], refs: number, total = related.length): string {
	const parts: string[] = [];
	const what = n.kind === 'country' || n.kind === 'leader' || n.kind === 'bank' || n.kind === 'ticker' ? `${n.label} (${kindLabel(n.kind).toLowerCase()})` : `${kindLabel(n.kind)}: ${n.label}`;
	if (n.mentions) parts.push(`${what} sale en ${n.mentions} ${n.mentions === 1 ? 'titular' : 'titulares'} de ahora.`);
	else parts.push(`${what}: ${refs ? `${refs} ${refs === 1 ? 'referencia' : 'referencias'} en los datos de Arc.` : 'sin titulares recientes.'}`);
	const live = related.filter((r) => r.why.includes('titulares') || r.why.includes('IMP') || r.why.includes('sanción') || r.why.includes('suceso'));
	if (live.length) {
		const top = live.slice(0, 3).map((r) => r.label);
		parts.push(`Enlazada con ${total} ${total === 1 ? 'entidad' : 'entidades'}; las más fuertes: ${top.join(', ')}.`);
	} else if (total) parts.push(`Enlazada con ${total} ${total === 1 ? 'entidad' : 'entidades'}.`);
	return parts.join(' ');
}

/** El Expediente de un nodo, o null si no existe. */
export function dossier(g: Graph, id: string, extra: DossierExtra = {}): Dossier | null {
	const n = g.nodes.get(id);
	if (!n) return null;
	const all = neighbors(g, id);
	const related: Related[] = all.slice(0, 40).map(({ node, edge }) => ({ id: node.id, kind: node.kind, label: node.label, w: Math.round(edge.w * 10) / 10, why: whyText(edge) }));
	const refs = g.refs.get(id) ?? [];
	const facts =
		n.kind === 'country' ? countryFacts(n.key, g, extra) : n.kind === 'leader' ? leaderFacts(n.key, extra) : n.kind === 'bank' ? bankFacts(n.key as Bank, extra) : n.kind === 'ticker' ? tickerFacts(n.key) : dataFacts(n);
	return {
		id,
		kind: n.kind,
		kindLabel: kindLabel(n.kind),
		label: n.label,
		sub: n.sub,
		summary: summaryOf(n, related, refs.length, all.length),
		facts,
		timeline: refs.slice(0, 60),
		related,
		relatedTotal: all.length,
		at: n.at,
		links: linksOf(n)
	};
}

const REF_KIND: Record<IntelRef['kind'], string> = { news: 'Titular', imp: 'IMP', sanction: 'Sanción', event: 'Suceso' };
export const refKind = (k: IntelRef['kind']) => REF_KIND[k];

/** Celdas de Markdown: sin barras ni saltos de línea que rompan la tabla. */
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/**
 * Un enlace de Markdown que no se rompe: corchetes del texto escapados, la URL entre <> (así valen espacios y
 * paréntesis) y, si no hay URL, solo el texto.
 */
export function mdLink(text: string, url: string): string {
	const t = cell(text).replace(/[[\]]/g, (c) => `\\${c}`);
	const u = url.trim().replace(/[<>\s]/g, (c) => encodeURIComponent(c));
	return u ? `[${t}](<${u}>)` : t;
}

/** El Expediente en Markdown, para descargar o pegar. `site`: la web, para que los enlaces internos funcionen fuera. */
export function toMarkdown(d: Dossier, generated: string, site = ''): string {
	const href = (h: string) => (h.startsWith('/') ? site + h : h);
	const out = [`# ${d.label}`, '', `*${d.kindLabel} · ${d.sub}*`, '', d.summary, ''];
	if (d.at) out.push(`Ubicación: ${d.at[0].toFixed(2)}, ${d.at[1].toFixed(2)}`, '');
	if (d.facts.length) {
		out.push('## Datos clave', '', '| Dato | Valor | Nota |', '|---|---|---|');
		for (const f of d.facts) out.push(`| ${cell(f.label)} | ${cell(f.value)} | ${cell(f.note ?? '')} |`);
		out.push('');
	}
	if (d.timeline.length) {
		out.push('## Cronología', '');
		for (const r of d.timeline) out.push(`- ${r.time ? r.time.slice(0, 10) + ' · ' : ''}${refKind(r.kind)} · ${mdLink(r.title, r.url)} — ${cell(r.source)}`);
		out.push('');
	}
	if (d.related.length) {
		out.push('## Relaciones', '', ...(d.relatedTotal > d.related.length ? [`Las ${d.related.length} más fuertes de ${d.relatedTotal}.`, ''] : []), '| Entidad | Tipo | Peso | Por qué |', '|---|---|---|---|');
		for (const r of d.related) out.push(`| ${cell(r.label)} | ${kindLabel(r.kind)} | ${r.w} | ${cell(r.why)} |`);
		out.push('');
	}
	if (d.links.length) {
		out.push('## En Arc', '');
		for (const l of d.links) out.push(`- ${mdLink(l.label, href(l.href))}`);
		out.push('');
	}
	out.push(`---`, `Expediente de Arc Terminal · ${generated}`, '');
	return out.join('\n');
}

/** El Expediente en JSON (con fecha de creación). */
export function toJson(d: Dossier, generated: string): string {
	return JSON.stringify({ generated, ...d }, null, 2);
}

/** Nombre de archivo para descargarlo: «expediente-espana.md». */
export function fileName(d: Dossier, ext: 'md' | 'json'): string {
	const slug = d.label
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 48);
	return `expediente-${slug || 'entidad'}.${ext}`;
}
