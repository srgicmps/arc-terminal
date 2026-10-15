import { describe, expect, it } from 'vitest';
import { Engine, type EngineWorker } from './engine.ts';
import {
	HINT,
	LEVELS,
	formatScore,
	parseBestMove,
	parseInfo,
	positionCommand,
	scoreToBar,
	strengthCommands
} from './uci.ts';

describe('UCI', () => {
	it('órdenes de fuerza y posición', () => {
		expect(strengthCommands(LEVELS[0])).toEqual([
			'setoption name UCI_LimitStrength value true',
			'setoption name UCI_Elo value 1350'
		]);
		expect(strengthCommands(HINT)).toEqual(['setoption name UCI_LimitStrength value false']);
		expect(positionCommand([])).toBe('position startpos');
		expect(positionCommand(['e2e4', 'e7e5'])).toBe('position startpos moves e2e4 e7e5');
	});

	it('lee las líneas info desde el lado de las blancas', () => {
		const line = 'info depth 12 seldepth 19 multipv 1 score cp -33 nodes 90775 nps 521695 time 174 pv e7e5 g1f3';
		expect(parseInfo(line, 'b')).toEqual({ depth: 12, score: { cp: 33 }, pv: ['e7e5', 'g1f3'] });
		expect(parseInfo(line, 'w')?.score).toEqual({ cp: -33 });
		expect(parseInfo('info depth 20 score mate 3 pv h5f7', 'w')?.score).toEqual({ mate: 3 });
		expect(parseInfo('info depth 20 score mate 2 pv a1a2', 'b')?.score).toEqual({ mate: -2 });
	});

	it('descarta lo que no es la variante principal definitiva', () => {
		expect(parseInfo('info depth 5 multipv 2 score cp 10 pv e2e4', 'w')).toBeNull();
		expect(parseInfo('info depth 5 score cp 10 lowerbound pv e2e4', 'w')).toBeNull();
		expect(parseInfo('info string NNUE evaluation using nn.nnue', 'w')).toBeNull();
	});

	it('lee bestmove', () => {
		expect(parseBestMove('bestmove d7d5 ponder e4d5')).toBe('d7d5');
		expect(parseBestMove('bestmove (none)')).toBeNull();
		expect(parseBestMove('readyok')).toBeUndefined();
	});

	it('barra y texto de la valoración', () => {
		expect(scoreToBar({ cp: 0 })).toBe(0.5);
		expect(scoreToBar({ cp: 100 })).toBeCloseTo(0.59, 2);
		expect(scoreToBar({ cp: -5000 })).toBeCloseTo(scoreToBar({ cp: -1000 }));
		expect(scoreToBar({ mate: -1 })).toBe(0);
		expect(formatScore({ cp: 38 })).toBe('+0,4');
		expect(formatScore({ cp: -120 })).toBe('−1,2');
		expect(formatScore({ cp: 2 })).toBe('0,0');
		expect(formatScore({ mate: -2 })).toBe('−M2');
	});
});

/** Un Stockfish de mentira: contesta al instante (o al recibir «stop») y apunta lo que recibe. */
function fakeWorker(answer = 'bestmove e7e5 ponder g1f3', hold = false) {
	const sent: string[] = [];
	const w: EngineWorker = {
		onmessage: null,
		terminate() {},
		postMessage(cmd) {
			sent.push(cmd);
			const reply = (data: string) => queueMicrotask(() => w.onmessage?.({ data }));
			if (cmd === 'uci') reply('id name Stockfish\nuciok');
			else if (cmd === 'isready') reply('readyok');
			else if (cmd.startsWith('go') && !hold) {
				reply('info depth 10 multipv 1 score cp 20 pv e7e5 g1f3');
				reply(answer);
			} else if (cmd === 'stop') reply('bestmove a7a6');
		}
	};
	return { w, sent };
}

describe('Engine', () => {
	it('arranca, fija la fuerza, busca y devuelve la jugada con su valoración', async () => {
		const { w, sent } = fakeWorker();
		const engine = new Engine(() => w);
		const infos: number[] = [];
		const r = await engine.search(['e2e4'], 'b', LEVELS[1], (i) => infos.push(i.depth));
		expect(r).toEqual({ best: 'e7e5', info: { depth: 10, score: { cp: -20 }, pv: ['e7e5', 'g1f3'] } });
		expect(infos).toEqual([10]);
		expect(sent).toEqual([
			'uci',
			'isready',
			'setoption name UCI_LimitStrength value true',
			'setoption name UCI_Elo value 1600',
			'position startpos moves e2e4',
			'go movetime 800'
		]);
	});

	it('una búsqueda nueva para la anterior, que devuelve null', async () => {
		const { w, sent } = fakeWorker('bestmove e7e5', true);
		const engine = new Engine(() => w);
		const first = engine.search([], 'w', HINT);
		await new Promise((r) => setTimeout(r, 0));
		const second = engine.search(['e2e4'], 'b', HINT);
		expect(await first).toBeNull();
		expect(sent).toContain('stop');
		await engine.stop();
		expect(await second).toBeNull();
	});

	it('si el worker falla a mitad de búsqueda, la búsqueda falla (no se queda colgada) y luego se reintenta', async () => {
		const { w } = fakeWorker('bestmove e7e5', true);
		let created = 0;
		const engine = new Engine(() => (created++, w));
		const search = engine.search([], 'w', HINT);
		await new Promise((r) => setTimeout(r, 0));
		w.onerror?.(new Error('sin memoria'));
		await expect(search).rejects.toThrow('sin memoria');
		// La siguiente arranca un motor nuevo.
		const again = engine.search([], 'w', HINT);
		await new Promise((r) => setTimeout(r, 0));
		expect(created).toBe(2);
		await engine.stop();
		expect(await again).toBeNull();
	});

	it('destroy acaba la búsqueda en curso con null', async () => {
		const { w } = fakeWorker('bestmove e7e5', true);
		const engine = new Engine(() => w);
		const search = engine.search([], 'w', HINT);
		await new Promise((r) => setTimeout(r, 0));
		engine.destroy();
		expect(await search).toBeNull();
	});

	it('si el worker no se puede crear, init falla y se puede reintentar', async () => {
		let tries = 0;
		const engine = new Engine(() => {
			tries++;
			throw new Error('sin WebAssembly');
		});
		await expect(engine.init()).rejects.toThrow('sin WebAssembly');
		await expect(engine.init()).rejects.toThrow();
		expect(tries).toBe(2);
	});
});
