// Agrupa los titulares que cuentan la misma noticia en varios medios: se queda el más reciente y los
// demás pasan a `also` («+3 medios» en NewsList). Lo usa scripts/sources/news.ts.
//
// Dos titulares son la misma noticia si sus palabras se parecen (índice de Jaccard ≥ 0,5: palabras en
// común / palabras distintas entre los dos) y salieron con menos de 12 h de diferencia. Antes de
// comparar, los títulos se normalizan: minúsculas, sin tildes, sin signos y sin palabras vacías.
import type { NewsItem } from '../src/lib/types.ts';

/** Palabras vacías en castellano y en inglés: no dicen de qué va la noticia. */
const STOPWORDS = new Set(
	`a al algo ante bajo como con contra cual de del desde donde durante e el ella ellas ellos en entre era es esa
	ese eso esta este esto estos estas ha han hasta hay la las le les lo los mas me mi muy no nos o os para pero por
	que se segun sera ser si sin sobre son su sus tambien te tras tu un una unas uno unos y ya
	about after against an and are as at be been but by can could did do does for from had has have he her his how
	if in into is it its just more new no not of on or our out over says she so than that the their them they this
	to up us was we were what when who why will with would you`.split(/\s+/)
);

/** «El BCE sube los tipos al 2,5 %» → {bce, sube, tipos, 2, 5}. */
export function normalize(title: string): Set<string> {
	const words = title
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.split(' ')
		.filter((w) => w && !STOPWORDS.has(w));
	return new Set(words);
}

function common(a: Set<string>, b: Set<string>): number {
	let n = 0;
	for (const w of a) if (b.has(w)) n++;
	return n;
}

/** Palabras en común / palabras distintas entre los dos (de 0 a 1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
	if (!a.size || !b.size) return 0;
	const n = common(a, b);
	return n / (a.size + b.size - n);
}

export interface ClusterOptions {
	/** Parecido mínimo (Jaccard). */
	threshold?: number;
	/** Diferencia máxima entre las horas de publicación. */
	windowHours?: number;
}

/**
 * Agrupa los titulares repetidos. `items` tiene que venir ordenado del más reciente al más antiguo: el
 * primero de cada grupo es el que se queda, y los de otros medios van a su `also`. Un repetido del mismo
 * medio (una actualización del titular) se descarta. Pide además 2 palabras en común como mínimo, para
 * que dos titulares de 3 palabras no se junten por una sola.
 */
export function cluster(items: NewsItem[], { threshold = 0.5, windowHours = 12 }: ClusterOptions = {}): NewsItem[] {
	const window = windowHours * 3_600_000;
	const groups: { item: NewsItem; words: Set<string>[]; time: number | null }[] = [];
	for (const item of items) {
		const words = normalize(item.title);
		const time = item.time ? Date.parse(item.time) : null;
		const group = groups.find(
			(g) =>
				// Sin fecha no se puede saber si es la misma noticia: solo se agrupa con otro sin fecha.
				(g.time === null ? time === null : time !== null && Math.abs(g.time - time) <= window) &&
				g.words.some((w) => common(w, words) >= 2 && jaccard(w, words) >= threshold)
		);
		if (!group) {
			groups.push({ item: { ...item }, words: [words], time });
			continue;
		}
		group.words.push(words);
		const also = group.item.also ?? [];
		if (item.source !== group.item.source && !also.some((a) => a.source === item.source))
			group.item.also = [...also, { source: item.source, url: item.url }];
	}
	return groups.map((g) => g.item);
}
