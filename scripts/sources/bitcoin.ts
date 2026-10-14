// Red de bitcoin según mempool.space (API pública, sin clave): comisiones, transacciones esperando,
// potencia de minado y próximo halving. mempool.space limita por IP: son tres consultas seguidas (no a
// la vez) una vez por hora. https://mempool.space/docs/api
import type { BitcoinNet } from '../../src/lib/types.ts';
import { getJson, getText, list, num, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const API = 'https://mempool.space/api';
/** Bloques entre halvings y minutos por bloque (objetivo de la red). */
const HALVING_EVERY = 210_000;
const BLOCK_MIN = 10;

/** Próximo halving a partir de la altura actual. */
export function nextHalving(height: number, now = Date.now()): BitcoinNet['halving'] {
	const at = (Math.floor(height / HALVING_EVERY) + 1) * HALVING_EVERY;
	const blocks = at - height;
	return { height: at, blocks, date: new Date(now + blocks * BLOCK_MIN * 60_000).toISOString() };
}

/**
 * Junta las tres respuestas: /v1/fees/mempool-blocks (los próximos bloques que se minarían, con sus
 * comisiones y transacciones: de ahí salen comisiones y mempool), /v1/mining/hashrate/3d y /blocks/tip/height.
 */
export function parseBitcoin(blocks: Raw, hashrate: Raw, tip: string, now = Date.now()): BitcoinNet {
	const height = Number(String(tip).trim());
	if (!Number.isInteger(height) || height <= 0) throw new Error('mempool.space no da la altura del último bloque');
	const bs = list<Raw>(blocks);
	const sum = (k: string) => (bs.length ? bs.reduce((a, b) => a + (num(b?.[k]) ?? 0), 0) : null);
	const vsize = sum('blockVSize');
	const h = num(hashrate?.currentHashrate);
	return {
		feeFast: num(bs[0]?.medianFee),
		feeHalfHour: num(bs[2]?.medianFee),
		mempoolTx: sum('nTx'),
		mempoolVmb: vsize === null ? null : Math.round(vsize / 1e5) / 10,
		hashrate: h === null ? null : Math.round(h / 1e18),
		height,
		halving: nextHalving(height, now)
	};
}

export const bitcoin: Source<BitcoinNet> = {
	name: 'bitcoin',
	label: 'Red de bitcoin: comisiones, mempool, minado y halving · mempool.space',
	maxAgeMinutes: 60,
	async fetch() {
		// Una detrás de otra, sin ráfagas.
		const blocks = await getJson<Raw>(`${API}/v1/fees/mempool-blocks`);
		const hashrate = await getJson<Raw>(`${API}/v1/mining/hashrate/3d`).catch(() => null);
		const tip = await getText(`${API}/blocks/tip/height`);
		return parseBitcoin(blocks, hashrate ?? {}, tip);
	}
};
