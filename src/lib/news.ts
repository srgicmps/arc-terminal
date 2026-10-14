import type { Ticker } from './commands.ts';
import type { NewsItem } from './types.ts';

// Secciones de titulares (static/data/news-<clave>.json).
export const NEWS_SECTIONS = [
	{ key: 'es', label: 'España' },
	{ key: 'eco', label: 'Economía' },
	{ key: 'geo', label: 'Geopolítica' },
	{ key: 'ws', label: 'Mercados' },
	{ key: 'tech', label: 'Tecnología' },
	{ key: 'ai', label: 'IA' },
	{ key: 'gov', label: 'Gobiernos' },
	{ key: 'intl', label: 'Organismos' }
] as const;

/** «eco» → «Economía», para la etiqueta de cada titular. */
export function sectionLabel(item: NewsItem & { section?: string }): string | undefined {
	return NEWS_SECTIONS.find((s) => s.key === item.section)?.label;
}

// ---------- «En las noticias»: titulares que nombran un valor ----------

/** Un titular con la sección de la que sale («eco», «ws»…). */
export interface Mention extends NewsItem {
	section: string;
}

/** Quita las tildes sin cambiar mayúsculas: «Telefónica» → «Telefonica». */
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Expresión para un nombre: palabra entera y sin tildes. Las letras dan igual en mayúscula o minúscula,
 * salvo la primera si el nombre empieza por mayúscula («Meta» sí, «meta» no).
 */
function namePattern(name: string): RegExp {
	const chars = Array.from(plain(name.trim()));
	const body = chars
		.map((c, i) => {
			if (/\s/.test(c)) return '\\s+';
			const lo = c.toLowerCase();
			const up = c.toUpperCase();
			if (lo === up) return escape(c);
			if (i === 0 && c === up) return escape(c);
			return `[${lo}${up}]`;
		})
		.join('')
		.replace(/(\\s\+)+/g, '\\s+');
	return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'u');
}

/** Nombres con los que se busca un valor: el suyo (sin «(ETF)») y sus alias. */
export function names(ticker: Pick<Ticker, 'name' | 'aliases'>): string[] {
	return [ticker.name.replace(/\s*\(.*\)\s*$/, ''), ...(ticker.aliases ?? [])].filter((n) => n.trim());
}

/** Los titulares que nombran el valor, por palabra completa y sin tildes. */
export function mentions<T extends NewsItem>(items: T[], ticker: Pick<Ticker, 'name' | 'aliases'>): T[] {
	const patterns = names(ticker).map(namePattern);
	return items.filter((item) => {
		const title = plain(item.title);
		return patterns.some((re) => re.test(title));
	});
}
