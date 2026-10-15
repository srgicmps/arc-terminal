// Stockfish en un Web Worker, hablando UCI. El worker (unos 7 MB de WebAssembly) se crea la primera vez que
// hace falta, es decir, al entrar en CHESS, y no al cargar la web. Las búsquedas van de una en una: si llega
// otra, la anterior se para y su resultado se descarta.
import type { Color, Uci } from './game.ts';
import { parseBestMove, parseInfo, positionCommand, strengthCommands, type Info, type Level } from './uci.ts';

/** Lo mínimo de un Worker que usamos: así los tests pueden pasar uno de mentira. */
export interface EngineWorker {
	postMessage(message: string): void;
	onmessage: ((e: { data: unknown }) => void) | null;
	onerror?: ((e: unknown) => void) | null;
	terminate(): void;
}

export interface SearchResult {
	best: Uci | null;
	/** Última valoración de la variante principal (desde el lado de las blancas). */
	info: Info | null;
}

export class Engine {
	private worker: EngineWorker | null = null;
	private ready: Promise<void> | null = null;
	private listeners = new Set<(line: string) => void>();
	/** Búsqueda en curso: se resuelve con su «bestmove». */
	private current: {
		resolve: (r: SearchResult | null) => void;
		/** Acaba la búsqueda sin esperar al motor: con error (worker caído) o con null (destroy). */
		abort: (error?: unknown) => void;
		done: Promise<void>;
	} | null = null;
	/** Sube con cada búsqueda y con cada stop(): una búsqueda que aún arrancaba sabe que ya no cuenta. */
	private gen = 0;

	constructor(private create: () => EngineWorker) {}

	private send(cmd: string) {
		this.worker?.postMessage(cmd);
	}

	/** Espera a una línea que cumpla `test`. */
	private waitFor(test: (line: string) => boolean): Promise<string> {
		return new Promise((resolve) => {
			const fn = (line: string) => {
				if (!test(line)) return;
				this.listeners.delete(fn);
				resolve(line);
			};
			this.listeners.add(fn);
		});
	}

	/** Arranca el motor (una vez). Se puede llamar antes de tiempo para que vaya cargando. */
	init(): Promise<void> {
		if (this.ready) return this.ready;
		const ready = new Promise<void>((resolve, reject) => {
			try {
				this.worker = this.create();
			} catch (error) {
				reject(error);
				return;
			}
			this.worker.onmessage = (e) => {
				for (const line of String(e.data).split('\n')) for (const fn of [...this.listeners]) fn(line.trim());
			};
			this.worker.onerror = (e) => {
				reject(e);
				this.crash(e);
			};
			this.waitFor((l) => l === 'uciok')
				.then(() => {
					this.send('isready');
					return this.waitFor((l) => l === 'readyok');
				})
				.then(() => resolve());
			this.send('uci');
		});
		this.ready = ready;
		// Si falla (navegador sin WebAssembly…), la próxima vez se vuelve a intentar. Solo si nadie ha
		// arrancado ya otro motor entretanto: si no, se cerraría el nuevo.
		ready.catch(() => {
			if (this.ready !== ready) return;
			this.ready = null;
			this.worker?.terminate();
			this.worker = null;
		});
		return ready;
	}

	/**
	 * Busca la mejor jugada tras `moves` con la fuerza de `level`. `onInfo` recibe las valoraciones según
	 * avanza. Devuelve null si otra búsqueda o `stop()` la han cortado.
	 */
	async search(
		moves: readonly Uci[],
		turn: Color,
		level: Level,
		onInfo?: (info: Info) => void
	): Promise<SearchResult | null> {
		const gen = ++this.gen;
		await this.halt();
		await this.init();
		if (gen !== this.gen) return null;
		let resolve!: (r: SearchResult | null) => void;
		let reject!: (error: unknown) => void;
		const result = new Promise<SearchResult | null>((ok, ko) => ((resolve = ok), (reject = ko)));
		let finished!: () => void;
		const done = new Promise<void>((r) => (finished = r));
		const job = {
			resolve,
			done,
			abort: (error?: unknown) => {
				this.listeners.delete(fn);
				finished();
				if (error === undefined) resolve(null);
				else reject(error);
			}
		};
		this.current = job;

		let last: Info | null = null;
		let cancelled = false;
		job.resolve = (r) => {
			// stop() llama aquí con null: la búsqueda sigue hasta su «bestmove», pero ya no cuenta.
			if (r === null) cancelled = true;
			else resolve(r);
		};
		const fn = (line: string) => {
			const info = parseInfo(line, turn);
			if (info) {
				last = info;
				if (!cancelled) onInfo?.(info);
				return;
			}
			const best = parseBestMove(line);
			if (best === undefined) return;
			this.listeners.delete(fn);
			if (this.current === job) this.current = null;
			finished();
			resolve(cancelled ? null : { best, info: last });
		};
		this.listeners.add(fn);
		for (const cmd of strengthCommands(level)) this.send(cmd);
		this.send(positionCommand(moves));
		this.send(`go movetime ${level.movetime}`);
		return result;
	}

	/** Para la búsqueda en curso (si hay) y espera a que el motor quede libre. */
	async stop() {
		this.gen++;
		await this.halt();
	}

	private async halt() {
		const job = this.current;
		if (!job) return;
		job.resolve(null);
		this.send('stop');
		await job.done;
	}

	/**
	 * El worker ha fallado (WebAssembly sin memoria en el móvil…): la búsqueda en curso falla en vez de
	 * quedarse esperando para siempre su «bestmove», y la próxima vuelve a arrancar el motor.
	 */
	private crash(error: unknown) {
		const job = this.current;
		this.current = null;
		this.listeners.clear();
		this.worker?.terminate();
		this.worker = null;
		this.ready = null;
		job?.abort(error ?? new Error('el motor se ha parado'));
	}

	/** Para todo y cierra el worker (al salir de CHESS). La búsqueda en curso devuelve null. */
	destroy() {
		this.gen++;
		const job = this.current;
		this.current = null;
		job?.abort();
		this.listeners.clear();
		this.worker?.terminate();
		this.worker = null;
		this.ready = null;
	}
}

/** Archivos de Stockfish en static/engine/, tal cual los publica el paquete `stockfish` de nmrugg. */
export const ENGINE_FILE = 'engine/stockfish-17.1-lite-single-03e3232.js';
export const ENGINE_SOURCE = 'https://github.com/nmrugg/stockfish.js';
