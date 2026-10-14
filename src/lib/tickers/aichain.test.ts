import { describe, expect, it } from 'vitest';
import { AI_CHAIN } from './aichain.ts';

describe('cesta de la cadena de la IA', () => {
	it('cada valor lleva bolsa y símbolo de TradingView, sin repetirse', () => {
		const all = AI_CHAIN.flatMap((l) => l.symbols.map((s) => s.tv));
		for (const tv of all) expect(tv).toMatch(/^(NASDAQ|NYSE):[A-Z.]+$/);
		expect(new Set(all).size).toBe(all.length);
		expect(AI_CHAIN.every((l) => l.symbols.length > 0)).toBe(true);
	});
});
