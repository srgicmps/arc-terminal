import { describe, expect, it } from 'vitest';
import { parseAiModels } from './aimodels.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;

describe('parseAiModels', () => {
	it('se queda con los del último mes, del más nuevo al más antiguo, con el precio por millón', () => {
		const models = parseAiModels(
			[
				{ id: 'old/model', name: 'Old: Model', created: day('2026-08-01'), pricing: { prompt: '0.000001', completion: '0.000002' } },
				{ id: 'anthropic/claude-x', name: 'Anthropic: Claude X', created: day('2026-10-10'), context_length: 200000, pricing: { prompt: '0.000003', completion: '0.000015' } },
				{ id: 'meta/llama-z', name: 'Meta: Llama Z', created: day('2026-10-12'), pricing: { prompt: '0', completion: '0' } },
				{ id: 'meta/llama-z:free', name: 'Meta: Llama Z (free)', created: day('2026-10-12'), pricing: { prompt: '0', completion: '0' } }
			],
			NOW
		);
		expect(models.map((m) => m.id)).toEqual(['meta/llama-z', 'anthropic/claude-x']);
		expect(models[1]).toEqual({
			id: 'anthropic/claude-x',
			name: 'Claude X',
			lab: 'anthropic',
			date: '2026-10-10',
			context: 200000,
			input: 3,
			output: 15,
			url: 'https://openrouter.ai/anthropic/claude-x'
		});
		expect(models[0]).toMatchObject({ input: 0, output: 0, context: null });
	});
});
