// Red de bitcoin (mempool.space): comisiones y mempool de los próximos bloques, potencia de minado y halving.
import { describe, expect, it } from 'vitest';
import { nextHalving, parseBitcoin } from '../sources/bitcoin.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');

describe('bitcoin', () => {
	it('junta comisiones, mempool, potencia y próximo halving', () => {
		const blocks = [
			{ blockVSize: 997_000, nTx: 3000, medianFee: 2.1 },
			{ blockVSize: 997_000, nTx: 2800, medianFee: 1.5 },
			{ blockVSize: 600_000, nTx: 1000, medianFee: 1.01 }
		];
		expect(parseBitcoin(blocks, { currentHashrate: 1.013e21 }, '971470\n', NOW)).toEqual({
			feeFast: 2.1,
			feeHalfHour: 1.01,
			mempoolTx: 6800,
			mempoolVmb: 2.6,
			hashrate: 1013,
			height: 971470,
			halving: { height: 1050000, blocks: 78530, date: new Date(NOW + 78530 * 600_000).toISOString() }
		});
	});

	it('sin bloques ni potencia, solo la altura y el halving; sin altura, error', () => {
		expect(parseBitcoin([], {}, '840000', NOW)).toMatchObject({ feeFast: null, mempoolTx: null, hashrate: null, height: 840000 });
		expect(() => parseBitcoin([], {}, 'error')).toThrow('altura');
	});

	it('justo en un halving, el siguiente es el de dentro de 210 000 bloques', () => {
		expect(nextHalving(840000, NOW).height).toBe(1050000);
	});
});
