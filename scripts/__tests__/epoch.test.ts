// Epoch AI: modelos frontera, los más recientes primero, y el récord de cómputo.
import { describe, expect, it } from 'vitest';
import { parseFrontier } from '../sources/epoch.ts';

const csv = [
	'Model,Publication date,Organization,Training compute (FLOP),Training compute notes,Link,Country (of organization)',
	'GPT-6 Astra,2026-09-03,OpenAI,9.4e+26,"per OpenAI, ""100,000 GB200s""",https://openai.com/x,United States of America',
	'Grok 4,2025-07-09,xAI,5.0000000000001e+26,nota,https://x.ai/news/grok-4,United States of America',
	'Modelo sin cómputo,2026-10-01,"Google DeepMind,Google",,,,"United Kingdom,United States of America"',
	'Sin fecha,,Lab,1e25,,,'
].join('\n');

describe('parseFrontier', () => {
	it('ordena por fecha, quita las filas sin fecha y elige el récord', () => {
		const { models, record } = parseFrontier(csv);
		expect(models.map((m) => m.name)).toEqual(['Modelo sin cómputo', 'GPT-6 Astra', 'Grok 4']);
		expect(models[0]).toEqual({
			name: 'Modelo sin cómputo',
			org: 'Google DeepMind',
			date: '2026-10-01',
			flop: null,
			country: 'United Kingdom',
			url: 'https://epoch.ai/data/ai-models'
		});
		expect(record?.name).toBe('GPT-6 Astra');
		expect(record?.flop).toBe(9.4e26);
	});

	it('se queda con los más recientes', () => {
		expect(parseFrontier(csv, 1).models.map((m) => m.name)).toEqual(['Modelo sin cómputo']);
	});
});
