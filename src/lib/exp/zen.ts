// Zen (experiencia /x/zen): una cosa cada vez, en grande y explicada. Lógica pura: arma la baraja de tarjetas
// alternando noticias (IMP) y cifras del día, y redacta el cambio de cada cifra en una frase sencilla.
import { lookup } from '../glossary.ts';
import { nf, period } from '../format.ts';
import type { Figure } from './figures.ts';

export interface ZenNews {
	kind: 'news';
	key: string;
	title: string;
	titleEs?: string;
	lang?: 'en';
	url: string;
	sources: string[];
	/** Un término del glosario que aparece en el titular, para entenderlo. */
	term?: { term: string; def: string };
}

export interface ZenFigure {
	kind: 'figure';
	key: string;
	figure: Figure;
	sentence: string;
}

export type ZenCard = ZenNews | ZenFigure;

const UNITS: Record<string, string> = { '%': 'puntos', pb: 'puntos básicos', $: 'dólares', pts: 'puntos' };

/** «Ha bajado 0,05 puntos desde el dato anterior (sep 26).» */
export function changeSentence(f: Pick<Figure, 'change' | 'decimals' | 'unit' | 't'>): string {
	const when = `Dato de ${period(f.t)}.`;
	if (f.change === null) return when;
	if (Math.abs(f.change) < 10 ** -f.decimals / 2) return `Sin cambios desde el dato anterior. ${when}`;
	const verb = f.change > 0 ? 'Ha subido' : 'Ha bajado';
	return `${verb} ${nf(Math.abs(f.change), f.decimals)} ${UNITS[f.unit] ?? ''} desde el dato anterior. ${when}`.replace(/\s+/g, ' ');
}

interface Top {
	k: string;
	title: string;
	titleEs?: string;
	lang?: 'en';
	url: string;
	sources: string[];
}

/** Noticia, cifra, noticia, cifra… y lo que sobre de una de las dos, al final. */
export function zenCards(top: Top[], figures: Figure[]): ZenCard[] {
	const news: ZenCard[] = top.map((t) => {
		const g = lookup(t.titleEs ?? t.title);
		return { kind: 'news', key: `n-${t.k}`, title: t.title, titleEs: t.titleEs, lang: t.lang, url: t.url, sources: t.sources, term: g ? { term: g.term, def: g.def } : undefined };
	});
	const figs: ZenCard[] = figures.map((f) => ({ kind: 'figure', key: `f-${f.id}`, figure: f, sentence: changeSentence(f) }));
	const out: ZenCard[] = [];
	for (let i = 0; i < Math.max(news.length, figs.length); i++) {
		if (news[i]) out.push(news[i]);
		if (figs[i]) out.push(figs[i]);
	}
	return out;
}
