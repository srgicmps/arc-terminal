// Papers del día de Hugging Face (https://huggingface.co/papers): la lista de arXiv que la comunidad
// vota cada día. API pública, sin clave ni registro.
import type { Paper } from '../../src/lib/types.ts';
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** «Ana Pérez», «Bo Li», «Carla Ruiz» → «A. Pérez, B. Li et al.» */
export function shortAuthors(authors: unknown, max = 2): string {
	const names = list(authors as Raw[])
		.map((a) => plain(a?.name, 80))
		.filter(Boolean)
		.map((name) => {
			const parts = name.split(' ');
			if (parts.length < 2) return name;
			const last = parts.pop();
			return `${parts[0].charAt(0)}. ${last}`;
		});
	const shown = names.slice(0, max).join(', ');
	return names.length > max ? `${shown} et al.` : shown;
}

/** Convierte la respuesta de /api/daily_papers en nuestra lista, ordenada por votos. */
export function parsePapers(body: unknown, max = 30): Paper[] {
	const seen = new Set<string>();
	return list(body as Raw[])
		.map((entry): Paper | null => {
			const p = entry?.paper ?? {};
			const id = String(p.id ?? '').trim();
			const title = plain(p.title ?? entry?.title, 300);
			if (!id || !title || seen.has(id)) return null;
			seen.add(id);
			return {
				id,
				title,
				authors: shortAuthors(p.authors),
				upvotes: Number(p.upvotes ?? 0) || 0,
				comments: Number(entry?.numComments ?? 0) || 0,
				url: `https://huggingface.co/papers/${encodeURIComponent(id)}`,
				arxiv: `https://arxiv.org/abs/${encodeURIComponent(id)}`,
				time: String(entry?.publishedAt ?? p.submittedOnDailyAt ?? p.publishedAt ?? ''),
				summary: plain(p.ai_summary || p.summary || entry?.summary, 300)
			};
		})
		.filter((p): p is Paper => p !== null)
		.sort((a, b) => b.upvotes - a.upvotes)
		.slice(0, max);
}

export const hfpapers: Source<Paper[]> = {
	name: 'hfpapers',
	label: 'Papers del día · Hugging Face',
	// La lista cambia pocas veces al día y los votos, poco a poco.
	maxAgeMinutes: 120,
	async fetch() {
		return parsePapers(await getJson('https://huggingface.co/api/daily_papers?limit=50'));
	}
};
