// Modelos en tendencia de Hugging Face (/api/models?sort=trendingScore).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hfmodels, parseModels } from '../sources/hfmodels.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllEnvs());

/** Un modelo con la forma de la API (cifras inventadas para el test). */
const model = (id: string, over: Record<string, unknown> = {}) => ({
	_id: 'x',
	id,
	modelId: id,
	likes: 120,
	trendingScore: 50,
	private: false,
	downloads: 3400,
	tags: ['transformers'],
	pipeline_tag: 'text-generation',
	library_name: 'transformers',
	createdAt: '2026-10-10T08:00:00.000Z',
	...over
});

describe('parseModels', () => {
	it('separa autor y nombre, y conserva el orden de tendencia', () => {
		const out = parseModels([model('acme/Big-7B'), model('lab/vision', { pipeline_tag: 'image-text-to-text' })]);
		expect(out.map((m) => m.id)).toEqual(['acme/Big-7B', 'lab/vision']);
		expect(out[0]).toMatchObject({
			author: 'acme',
			name: 'Big-7B',
			task: 'text-generation',
			likes: 120,
			downloads: 3400,
			url: 'https://huggingface.co/acme/Big-7B',
			created: '2026-10-10T08:00:00.000Z'
		});
	});

	it('quita repetidos, privados y sin autor; aguanta campos que faltan', () => {
		const out = parseModels([
			model('a/b'),
			model('a/b'),
			model('c/d', { private: true }),
			{ id: 'solo' },
			{ id: 'e/f' },
			null
		]);
		expect(out.map((m) => m.id)).toEqual(['a/b', 'e/f']);
		expect(out[1]).toMatchObject({ task: '', likes: 0, downloads: 0, created: '' });
	});
});

describe('hfmodels', () => {
	it('pide la tendencia y manda el token solo si existe', async () => {
		const fetch = mockFetch(() => Array.from({ length: 6 }, (_, i) => model(`a/m${i}`)));
		expect(await hfmodels.fetch(undefined)).toHaveLength(6);
		expect(String(fetch.mock.calls[0][0])).toContain('sort=trendingScore');
		expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBeNull();

		vi.stubEnv('HF_TOKEN', 'hf_prueba');
		await hfmodels.fetch(undefined);
		expect(new Headers(fetch.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer hf_prueba');
	});
});
