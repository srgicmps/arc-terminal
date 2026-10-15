// Muestreador de la pestaña «Recursos»: toma una muestra por segundo de lo que el navegador deja medir y la guarda en
// buffers circulares (resources.ts). Se para solo cuando la pestaña no se ve (document.hidden) y al cerrarse.
import { busy, fps, rate, Ring, WINDOW } from './resources.ts';

export type Key = 'fps' | 'busy' | 'heap' | 'net' | 'storage' | 'dom' | 'wins' | 'fresh' | 'stale';
const KEYS: Key[] = ['fps', 'busy', 'heap', 'net', 'storage', 'dom', 'wins', 'fresh', 'stale'];

type Memory = { usedJSHeapSize: number; jsHeapSizeLimit: number };

/** Lo que viene de fuera del navegador: ventanas abiertas y fuentes frescas/caducadas (status.json). */
export interface Inputs {
	wins: () => number;
	sources: () => { fresh: number; stale: number } | null;
}

const supports = (t: string) => typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes ?? []).includes(t);

export class Sampler {
	/** Copia de cada serie tras cada muestra (lo que pintan las gráficas). */
	series = $state<Record<Key, number[]>>(Object.fromEntries(KEYS.map((k) => [k, []])) as unknown as Record<Key, number[]>);
	running = $state(false);
	/** Pausa pedida por la persona: no se reanuda al volver a verse la pestaña. */
	paused = $state(false);
	/** Qué deja medir este navegador. */
	readonly can = {
		longtask: supports('longtask'),
		resource: supports('resource'),
		memory: typeof performance !== 'undefined' && !!(performance as Performance & { memory?: Memory }).memory,
		storage: typeof navigator !== 'undefined' && !!navigator.storage?.estimate
	};
	heapLimit = $state(0);
	quota = $state(0);
	requests = $state(0);

	private rings = Object.fromEntries(KEYS.map((k) => [k, new Ring(WINDOW)])) as Record<Key, Ring>;
	private timer: ReturnType<typeof setInterval> | null = null;
	private raf = 0;
	private frames = 0;
	private longMs = 0;
	private netBytes = 0;
	private netSeen = 0;
	private lastT = 0;
	private storage = 0;
	private storageAt = 0;
	private observers: PerformanceObserver[] = [];

	constructor(private inputs: Inputs) {}

	/** Arranca (si la pestaña se ve) y escucha si deja de verse. Devuelve la función para pararlo del todo. */
	mount(): () => void {
		const onVis = () => (document.hidden ? this.stop() : !this.paused && this.start());
		document.addEventListener('visibilitychange', onVis);
		if (!document.hidden) this.start();
		return () => {
			document.removeEventListener('visibilitychange', onVis);
			this.stop();
		};
	}

	/** Pausar o seguir a mano. */
	toggle() {
		this.paused = !this.paused;
		if (this.paused) this.stop();
		else if (!document.hidden) this.start();
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.frames = 0;
		this.longMs = 0;
		this.netBytes = 0;
		this.netSeen = 0;
		this.lastT = performance.now();
		this.observe();
		const loop = () => {
			this.frames++;
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
		this.timer = setInterval(() => this.sample(), 1000);
		this.sample();
	}

	stop() {
		if (!this.running) return;
		this.running = false;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		cancelAnimationFrame(this.raf);
		for (const o of this.observers) o.disconnect();
		this.observers = [];
	}

	private observe() {
		try {
			if (this.can.longtask) {
				const o = new PerformanceObserver((l) => {
					for (const e of l.getEntries()) this.longMs += e.duration;
				});
				o.observe({ type: 'longtask' });
				this.observers.push(o);
			}
			if (this.can.resource) {
				const o = new PerformanceObserver((l) => {
					for (const e of l.getEntries() as PerformanceResourceTiming[]) {
						this.netBytes += e.transferSize ?? 0;
						this.requests++;
					}
				});
				o.observe({ type: 'resource' });
				this.observers.push(o);
			}
		} catch {}
	}

	private sample() {
		const t = performance.now();
		const ms = t - this.lastT;
		const first = ms < 200; // recién arrancado: aún no hay intervalo que medir
		this.lastT = t;

		const v: Partial<Record<Key, number>> = {};
		if (!first) {
			v.fps = fps(this.frames, ms);
			if (this.can.longtask) v.busy = busy(this.longMs, ms);
			if (this.can.resource) v.net = rate(this.netSeen, this.netBytes, ms);
		}
		this.frames = 0;
		this.longMs = 0;
		this.netSeen = this.netBytes;

		const mem = (performance as Performance & { memory?: Memory }).memory;
		if (mem) {
			v.heap = mem.usedJSHeapSize;
			this.heapLimit = mem.jsHeapSizeLimit;
		}
		if (this.can.storage) {
			// La cuota no cambia cada segundo: se pregunta cada 5 s y entre medias se repite el último valor.
			if (t - this.storageAt > 5000) {
				this.storageAt = t;
				navigator.storage
					.estimate()
					.then((e) => {
						this.storage = e.usage ?? 0;
						this.quota = e.quota ?? 0;
					})
					.catch(() => {});
			}
			v.storage = this.storage;
		}
		v.dom = document.getElementsByTagName('*').length;
		v.wins = this.inputs.wins();
		const src = this.inputs.sources();
		if (src) {
			v.fresh = src.fresh;
			v.stale = src.stale;
		}

		const next = { ...this.series };
		for (const k of KEYS) {
			const x = v[k];
			if (x === undefined) continue;
			this.rings[k].push(x);
			next[k] = this.rings[k].values();
		}
		this.series = next;
	}
}
