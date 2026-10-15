// Pestaña «Recursos» del Monitor del sistema: lógica pura (buffer circular, tasas, formato y trazado). Con tests.

/** Segundos que se ven en cada gráfica (una muestra por segundo). */
export const WINDOW = 90;

/** Buffer circular de tamaño fijo: guarda las últimas `size` muestras sin crecer. */
export class Ring {
	private buf: number[];
	private start = 0;
	length = 0;

	constructor(readonly size: number) {
		this.buf = new Array<number>(size).fill(0);
	}

	push(v: number) {
		if (this.length < this.size) {
			this.buf[(this.start + this.length) % this.size] = v;
			this.length++;
		} else {
			this.buf[this.start] = v;
			this.start = (this.start + 1) % this.size;
		}
	}

	/** De la más antigua a la más reciente. */
	values(): number[] {
		const out: number[] = [];
		for (let i = 0; i < this.length; i++) out.push(this.buf[(this.start + i) % this.size]);
		return out;
	}

	last(): number | null {
		return this.length ? this.buf[(this.start + this.length - 1) % this.size] : null;
	}

	clear() {
		this.start = 0;
		this.length = 0;
	}
}

/** Tasa por segundo entre dos lecturas de un contador (nunca negativa: si el contador se reinicia, 0). */
export function rate(prev: number, next: number, ms: number): number {
	if (ms <= 0 || next < prev) return 0;
	return ((next - prev) * 1000) / ms;
}

/** Fotogramas por segundo a partir de los que se han pintado en un intervalo. */
export const fps = (frames: number, ms: number) => (ms > 0 ? Math.min(240, Math.round((frames * 1000) / ms)) : 0);

/** % del intervalo que el hilo principal ha estado bloqueado por tareas largas (0–100). */
export const busy = (longMs: number, ms: number) => (ms > 0 ? Math.max(0, Math.min(100, Math.round((longMs / ms) * 100))) : 0);

const nf = (v: number, d = 1) => v.toLocaleString('es-ES', { maximumFractionDigits: d });

/** «512 B», «3,4 KB», «12 MB», «1,2 GB». */
export function bytes(b: number): string {
	if (!Number.isFinite(b) || b < 0) return '—';
	if (b < 1024) return `${Math.round(b)} B`;
	if (b < 1048576) return `${nf(b / 1024)} KB`;
	if (b < 1073741824) return `${nf(b / 1048576)} MB`;
	return `${nf(b / 1073741824, 2)} GB`;
}

export const perSec = (b: number) => `${bytes(b)}/s`;

/** «1.234» (enteros con separador de miles). */
export const count = (n: number) => Math.round(n).toLocaleString('es-ES');

export const pct = (p: number) => `${nf(p, p < 10 ? 1 : 0)} %`;

/** Tope «redondo» del eje Y para que la gráfica no salte a cada muestra: 1, 2 o 5 × 10ⁿ por encima del máximo. */
export function niceMax(values: number[], floor = 1): number {
	const m = Math.max(floor, ...values);
	const p = 10 ** Math.floor(Math.log10(m));
	for (const k of [1, 2, 5, 10]) if (k * p >= m) return k * p;
	return 10 * p;
}

/**
 * Trazos SVG de una gráfica de área en una caja `w` × `h`, alineada a la derecha (lo más reciente al borde) y con
 * `slots` huecos en horizontal. Devuelve la línea y el área cerrada; vacíos si no hay muestras.
 */
export function paths(values: number[], max: number, w: number, h: number, slots = WINDOW): { line: string; area: string } {
	if (!values.length || max <= 0) return { line: '', area: '' };
	const step = w / Math.max(1, slots - 1);
	const x0 = w - (values.length - 1) * step;
	const y = (v: number) => +(h - (Math.max(0, Math.min(v, max)) / max) * h).toFixed(1);
	const pts = values.map((v, i) => `${+(x0 + i * step).toFixed(1)},${y(v)}`);
	const line = `M${pts.join('L')}`;
	const area = `${line}L${w},${h}L${+x0.toFixed(1)},${h}Z`;
	return { line, area };
}
