// Modelos en tendencia de Hugging Face (https://huggingface.co/models?sort=trending): los que más
// interés están ganando estos días. API pública; el token HF_TOKEN es opcional, como en hfpapers.
import type { HfModel } from '../../src/lib/types.ts';
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** Convierte la respuesta de /api/models en nuestra lista, en el orden de tendencia que da la API. */
export function parseModels(body: unknown, max = 15): HfModel[] {
	const seen = new Set<string>();
	return list(body as Raw[])
		.map((m): HfModel | null => {
			const id = plain(m?.id ?? m?.modelId, 200);
			if (!id || !id.includes('/') || seen.has(id) || m?.private) return null;
			seen.add(id);
			const [author, ...rest] = id.split('/');
			return {
				id,
				author,
				name: rest.join('/'),
				task: plain(m?.pipeline_tag, 60),
				likes: Number(m?.likes ?? 0) || 0,
				downloads: Number(m?.downloads ?? 0) || 0,
				url: `https://huggingface.co/${id.split('/').map(encodeURIComponent).join('/')}`,
				created: String(m?.createdAt ?? '')
			};
		})
		.filter((m): m is HfModel => m !== null)
		.slice(0, max);
}

export const hfmodels: Source<HfModel[]> = {
	name: 'hfmodels',
	label: 'Modelos en tendencia · Hugging Face',
	// La tendencia cambia despacio y, sin token, Hugging Face limita las peticiones por IP.
	maxAgeMinutes: 360,
	minItems: 5,
	async fetch() {
		const token = process.env.HF_TOKEN;
		const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
		return parseModels(await getJson('https://huggingface.co/api/models?sort=trendingScore&limit=15', { headers }));
	}
};
