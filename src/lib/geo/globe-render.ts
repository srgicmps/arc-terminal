// Dibujo del globo 3D en un <canvas> 2D (sin WebGL: va en cualquier navegador y no pesa). Lo carga Globe.svelte con
// import() solo al abrir el globo, así que ni esto ni las costas de world.ts pesan en el resto de vistas.
// Arrastrar gira (con inercia), rueda o pellizco acercan, gira solo despacio cuando nadie lo toca y se para si no
// se ve o si el sistema pide menos movimiento. Las cuentas están en globe.ts.
import { LAND } from '../world.ts';
import {
	isDark,
	pulseOf,
	rgbOf,
	subsolar,
	withAlpha,
	clampLat,
	landDots,
	lonDelta,
	parseRings,
	pick,
	pointPx,
	rotate,
	styleOf,
	wrapLon,
	type GlobePoint,
	type View
} from './globe.ts';

export interface GlobeOptions {
	/** Colores ya resueltos de los tokens (sin «--»): bg, panel, raise, line, muted, fg, amber… */
	colors: Record<string, string>;
	reduced: boolean;
	onPick: (p: GlobePoint | null) => void;
}

export interface Globe {
	setPoints(points: GlobePoint[], selected: string | null, flash?: Set<string>): void;
	setColors(colors: Record<string, string>): void;
	/** Gira hasta dejar el punto en el centro. */
	focus(p: { lat: number; lon: number }): void;
	/** Gira o acerca con el teclado: grados y factor de zoom. */
	nudge(dLon: number, dLat: number, zoom?: number): void;
	destroy(): void;
}

/** Grados por milisegundo del giro solo: una vuelta cada dos minutos. */
const AUTO = 360 / 120_000;
/** Tras tocarlo, cuánto espera para volver a girar solo. */
const IDLE = 4000;

/** Lado del lienzo de la sombra: pequeño, se estira suavizado; 9.216 píxeles por fotograma. */
const SHADE = 96;

/** Estrellas del fondo oscuro: [x, y] en fracción del lienzo y brillo. Fijas (semilla), para que no bailen. */
const STARS: [number, number, number][] = (() => {
	let seed = 7;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	return Array.from({ length: 160 }, () => [rnd(), rnd(), 0.15 + rnd() * 0.45] as [number, number, number]);
})();

/** Número estable a partir de un id, para que cada punto lata con su propio desfase. */
const hash = (s: string) => {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
};

let dotsCache: [number, number][] | null = null;
let ringsCache: [number, number][][] | null = null;

/** Trama de tierra: se pinta LAND en un lienzo pequeño fuera de la pantalla y se mira qué píxeles son tierra. */
function makeDots(): [number, number][] {
	if (dotsCache) return dotsCache;
	const W = 720;
	const H = 360;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const g = c.getContext('2d', { willReadFrequently: true });
	if (!g) return (dotsCache = []);
	g.scale(W / 360, H / 180);
	g.fill(new Path2D(LAND));
	const px = g.getImageData(0, 0, W, H).data;
	const isLand = (lat: number, lon: number) => {
		const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
		const y = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
		return px[(y * W + x) * 4 + 3] > 127;
	};
	return (dotsCache = landDots(isLand, 16000));
}

export function createGlobe(canvas: HTMLCanvasElement, opts: GlobeOptions): Globe {
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Sin canvas 2D');
	const dots = makeDots();
	const rings = (ringsCache ??= parseRings(LAND));

	let colors = opts.colors;
	let points: GlobePoint[] = [];
	let selected: string | null = null;
	let flash = new Set<string>();
	// Empieza mirando a Europa y África, un poco desde el norte.
	const view: View = { lon: 10, lat: 25 };
	let zoom = 1;
	let w = 0;
	let h = 0;
	let dpr = 1;
	let vLon = 0;
	let vLat = 0;
	let lastTouch = -Infinity;
	let fly: { from: View; to: View; t0: number } | null = null;
	let raf = 0;
	let visible = true;
	let last = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const radius = () => (Math.min(w, h) / 2) * 0.88 * zoom;
	let pulsing = false;
	// La hora del Sol, al abrir y cada minuto.
	let sunAt = subsolar(new Date());
	const sunTimer = setInterval(() => (sunAt = subsolar(new Date())), 60_000);
	const shadeCanvas = document.createElement('canvas');
	shadeCanvas.width = shadeCanvas.height = SHADE;
	const shadeCtx = shadeCanvas.getContext('2d');
	const shadeImg = shadeCtx?.createImageData(SHADE, SHADE);

	function resize() {
		const r = canvas.getBoundingClientRect();
		dpr = Math.min(2, window.devicePixelRatio || 1);
		w = r.width;
		h = r.height;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		draw(performance.now());
	}

	function shape(s: string, x: number, y: number, r: number) {
		ctx!.beginPath();
		if (s === 'diamond') {
			ctx!.moveTo(x, y - r * 1.3);
			ctx!.lineTo(x + r * 1.3, y);
			ctx!.lineTo(x, y + r * 1.3);
			ctx!.lineTo(x - r * 1.3, y);
			ctx!.closePath();
		} else if (s === 'square') ctx!.rect(x - r, y - r, r * 2, r * 2);
		else if (s === 'triangle') {
			ctx!.moveTo(x, y - r * 1.2);
			ctx!.lineTo(x + r * 1.1, y + r * 0.8);
			ctx!.lineTo(x - r * 1.1, y + r * 0.8);
			ctx!.closePath();
		} else ctx!.arc(x, y, r, 0, Math.PI * 2);
	}

	function draw(now: number) {
		const g = ctx!;
		const R = radius();
		const cx = w / 2;
		const cy = h / 2;
		const dark = isDark(colors.bg);
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, w, h);

		// Estrellas, solo con fondo oscuro: fijas, se desplazan un poco al girar (paralaje).
		if (dark) {
			g.fillStyle = colors.fg;
			const shift = (view.lon / 360) * w * 0.15;
			for (const [sx, sy, a] of STARS) {
				const x = (((sx * w + shift) % w) + w) % w;
				const y = sy * h;
				if (Math.hypot(x - cx, y - cy) < R * 1.12) continue;
				g.globalAlpha = a;
				g.fillRect(x, y, 1, 1);
			}
			g.globalAlpha = 1;
		}

		// Atmósfera: halo del color de acento que se apaga hacia fuera.
		const halo = g.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.12);
		halo.addColorStop(0, withAlpha(colors.amber, dark ? 0.42 : 0.3));
		halo.addColorStop(0.35, withAlpha(colors.amber, dark ? 0.14 : 0.1));
		halo.addColorStop(1, withAlpha(colors.amber, 0));
		g.fillStyle = halo;
		g.beginPath();
		g.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
		g.fill();

		// Esfera.
		g.beginPath();
		g.arc(cx, cy, R, 0, Math.PI * 2);
		g.fillStyle = colors.panel;
		g.fill();

		// Meridianos y paralelos cada 30°, muy tenues.
		g.globalAlpha = 0.4;
		g.lineWidth = 1;
		g.strokeStyle = colors.line;
		g.beginPath();
		for (let lon = -180; lon < 180; lon += 30)
			line(Array.from({ length: 37 }, (_, i) => [i * 5 - 90, lon] as [number, number]));
		for (let lat = -60; lat <= 60; lat += 30)
			line(Array.from({ length: 73 }, (_, i) => [lat, i * 5 - 180] as [number, number]));
		g.stroke();
		g.globalAlpha = 1;

		// Tierra: trama de puntos en el color de acento; los del borde, más tenues (dan volumen).
		const ds = Math.max(1.3, R / 170);
		const front = new Path2D();
		const limb = new Path2D();
		for (const [lat, lon] of dots) {
			const q = rotate(lat, lon, view);
			if (q.z <= 0) continue;
			(q.z > 0.35 ? front : limb).rect(cx + q.x * R - ds / 2, cy - q.y * R - ds / 2, ds, ds);
		}
		g.fillStyle = colors.amber;
		g.globalAlpha = 0.5;
		g.fill(limb);
		g.globalAlpha = 0.9;
		g.fill(front);
		g.globalAlpha = 1;

		// Costas: 1 px, solo los tramos de la cara visible.
		g.globalAlpha = 0.6;
		g.beginPath();
		for (const ring of rings) line(ring);
		g.strokeStyle = colors['amber-dim'];
		g.stroke();
		g.globalAlpha = 1;

		// Luz y sombra: la noche de verdad (según la hora) y el borde un poco más oscuro.
		shade();
		g.save();
		g.beginPath();
		g.arc(cx, cy, R, 0, Math.PI * 2);
		g.clip();
		g.drawImage(shadeCanvas, cx - R, cy - R, R * 2, R * 2);
		g.restore();
		g.beginPath();
		g.arc(cx, cy, R, 0, Math.PI * 2);
		g.strokeStyle = withAlpha(colors.amber, 0.35);
		g.stroke();

		// Puntos de las capas: de detrás hacia delante, el elegido el último. Encima de la sombra: se ven de noche.
		const vis = points
			.map((p) => ({ p, q: rotate(p.lat, p.lon, view) }))
			.filter((v) => v.q.z > 0.02)
			.sort((a, b) => (a.p.id === selected ? 1 : b.p.id === selected ? -1 : a.q.z - b.q.z));
		pulsing = false;
		for (const { p, q } of vis) {
			const st = styleOf(p.layer);
			const x = cx + q.x * R;
			const y = cy - q.y * R;
			const r = pointPx(p.r, R) * (0.6 + 0.4 * q.z);
			const on = p.id === selected;
			const depth = 0.35 + 0.65 * Math.min(1, q.z * 2);
			// Ondas que se expanden: más amplias y dobles en lo grave; sin animación si se pide menos movimiento.
			const level = pulseOf(p, flash.has(p.id));
			if (level && !opts.reduced) {
				pulsing = true;
				const period = level === 2 ? 1700 : 2600;
				const off = hash(p.id) % period;
				for (let n = 0; n < level; n++) {
					const k = ((now + off + (n * period) / 2) % period) / period;
					g.globalAlpha = depth * (1 - k) * (level === 2 ? 0.75 : 0.45);
					g.beginPath();
					g.arc(x, y, r + 1 + k * (level === 2 ? 18 : 10), 0, Math.PI * 2);
					g.strokeStyle = colors.amber;
					g.lineWidth = 1;
					g.stroke();
				}
			}
			g.globalAlpha = depth;
			shape(st.shape, x, y, r);
			const fill = p.strong ? 'amber-edge' : st.fill;
			if (fill) {
				g.fillStyle = colors[fill];
				g.fill();
			}
			g.setLineDash(st.dash ? [2, 2] : []);
			g.lineWidth = on ? 2 : 1;
			g.strokeStyle = on ? colors.fg : colors[p.strong ? 'amber' : (st.stroke ?? st.fill ?? 'amber')];
			g.stroke();
			g.setLineDash([]);
		}
		g.globalAlpha = 1;
	}

	/**
	 * Sombra de la esfera en un lienzo pequeño (96 × 96 px, se estira con suavizado): la noche según el punto
	 * subsolar, con un crepúsculo suave, y un oscurecido leve hacia el borde. Con fondo claro, la sombra usa el
	 * color del texto (oscuro) y más suave.
	 */
	function shade() {
		const N = SHADE;
		const sc = shadeCtx;
		if (!sc) return;
		const sun = rotate(sunAt.lat, sunAt.lon, view);
		const dark = isDark(colors.bg);
		const [r, gr, b] = rgbOf(dark ? colors.bg : colors.fg) ?? [0, 0, 0];
		const night = dark ? 0.62 : 0.28;
		const img = shadeImg!;
		const d = img.data;
		for (let j = 0; j < N; j++) {
			const y = 1 - (2 * (j + 0.5)) / N;
			for (let i = 0; i < N; i++) {
				const x = (2 * (i + 0.5)) / N - 1;
				const o = (j * N + i) * 4;
				// Fuera del círculo, el valor del borde: al estirar no se cuela un halo claro (luego se recorta).
				const r2 = Math.min(1, x * x + y * y);
				const z = Math.sqrt(1 - r2);
				const light = x * sun.x + y * sun.y + z * sun.z;
				// 0 de día, 1 de noche cerrada; el crepúsculo ocupa unos 12°.
				const t = Math.min(1, Math.max(0, (0.1 - light) / 0.3));
				const nightK = t * t * (3 - 2 * t);
				const edge = (1 - z) * (1 - z) * 0.35;
				d[o] = r;
				d[o + 1] = gr;
				d[o + 2] = b;
				d[o + 3] = Math.round(255 * Math.min(0.85, nightK * night + edge));
			}
		}
		sc.putImageData(img, 0, 0);
	}

	/** Añade al trazo actual una línea de [lat, lon], cortada donde pasa por detrás del globo. */
	function line(pts: [number, number][]) {
		const R = radius();
		let pen = false;
		for (const [lat, lon] of pts) {
			const q = rotate(lat, lon, view);
			if (q.z <= 0) {
				pen = false;
				continue;
			}
			const x = w / 2 + q.x * R;
			const y = h / 2 - q.y * R;
			if (pen) ctx!.lineTo(x, y);
			else ctx!.moveTo(x, y);
			pen = true;
		}
	}

	// Bucle de animación: solo corre si hay algo que mover y el globo se ve.
	const moving = (now: number) =>
		!!fly ||
		Math.abs(vLon) + Math.abs(vLat) > 0.0005 ||
		(!opts.reduced && ((now - lastTouch > IDLE && !selected) || flash.size > 0 || pulsing));

	function frame(now: number) {
		raf = 0;
		const dt = Math.min(64, last ? now - last : 16);
		last = now;
		if (fly) {
			const k = Math.min(1, (now - fly.t0) / 700);
			const e = 1 - Math.pow(1 - k, 3);
			view.lon = wrapLon(fly.from.lon + lonDelta(fly.from.lon, fly.to.lon) * e);
			view.lat = fly.from.lat + (fly.to.lat - fly.from.lat) * e;
			if (k >= 1) fly = null;
		} else if (dragging === null && Math.abs(vLon) + Math.abs(vLat) > 0.0005) {
			view.lon = wrapLon(view.lon + vLon * dt);
			view.lat = clampLat(view.lat + vLat * dt);
			const decay = Math.pow(0.94, dt / 16);
			vLon *= decay;
			vLat *= decay;
		} else if (!opts.reduced && dragging === null && !selected && now - lastTouch > IDLE) {
			view.lon = wrapLon(view.lon + AUTO * dt);
		}
		draw(now);
		schedule();
	}

	function schedule() {
		if (raf || !visible || document.hidden) return;
		const now = performance.now();
		if (moving(now)) raf = requestAnimationFrame(frame);
		else {
			last = 0;
			// Vuelve a mirar cuando toque arrancar el giro solo.
			clearTimeout(timer);
			if (!opts.reduced && !selected) timer = setTimeout(schedule, Math.max(50, IDLE - (now - lastTouch)));
		}
	}
	const kick = () => {
		if (!raf) draw(performance.now());
		schedule();
	};

	// Arrastrar, soltar con inercia, pellizcar y tocar.
	const ptrs = new Map<number, { x: number; y: number }>();
	let dragging: number | null = null;
	let moved = 0;
	let pinch = 0;
	let lastMove = { t: 0, x: 0, y: 0 };

	function down(e: PointerEvent) {
		canvas.setPointerCapture(e.pointerId);
		ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (ptrs.size === 1) {
			dragging = e.pointerId;
			moved = 0;
			vLon = vLat = 0;
			fly = null;
			lastMove = { t: e.timeStamp, x: e.clientX, y: e.clientY };
		} else if (ptrs.size === 2) {
			const [a, b] = [...ptrs.values()];
			pinch = Math.hypot(a.x - b.x, a.y - b.y);
			moved = 99;
		}
		lastTouch = performance.now();
	}

	function move(e: PointerEvent) {
		const prev = ptrs.get(e.pointerId);
		if (!prev) return;
		ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
		lastTouch = performance.now();
		if (ptrs.size === 2) {
			const [a, b] = [...ptrs.values()];
			const d = Math.hypot(a.x - b.x, a.y - b.y);
			if (pinch) setZoom(zoom * (d / pinch));
			pinch = d;
			return;
		}
		if (e.pointerId !== dragging) return;
		const dx = e.clientX - prev.x;
		const dy = e.clientY - prev.y;
		moved += Math.abs(dx) + Math.abs(dy);
		const k = 180 / Math.PI / radius();
		view.lon = wrapLon(view.lon - dx * k);
		view.lat = clampLat(view.lat + dy * k);
		const dt = Math.max(1, e.timeStamp - lastMove.t);
		vLon = (-(e.clientX - lastMove.x) * k) / dt;
		vLat = ((e.clientY - lastMove.y) * k) / dt;
		lastMove = { t: e.timeStamp, x: e.clientX, y: e.clientY };
		kick();
	}

	function up(e: PointerEvent) {
		ptrs.delete(e.pointerId);
		if (ptrs.size < 2) pinch = 0;
		if (e.pointerId !== dragging) return;
		dragging = null;
		lastTouch = performance.now();
		// Si llevaba un rato quieto antes de soltar, no hay inercia.
		if (e.timeStamp - lastMove.t > 80 || opts.reduced) vLon = vLat = 0;
		if (moved < 6 && e.type === 'pointerup') {
			const r = canvas.getBoundingClientRect();
			const p = pick(points, e.clientX - r.left - w / 2, e.clientY - r.top - h / 2, view, radius());
			opts.onPick(p && p.id === selected ? null : p);
		}
		kick();
	}

	function setZoom(z: number) {
		zoom = Math.max(1, Math.min(4, z));
		kick();
	}

	function wheel(e: WheelEvent) {
		e.preventDefault();
		lastTouch = performance.now();
		setZoom(zoom * Math.exp(-e.deltaY * 0.0015));
	}

	canvas.addEventListener('pointerdown', down);
	canvas.addEventListener('pointermove', move);
	canvas.addEventListener('pointerup', up);
	canvas.addEventListener('pointercancel', up);
	canvas.addEventListener('wheel', wheel, { passive: false });

	const ro = new ResizeObserver(resize);
	ro.observe(canvas);
	const io = new IntersectionObserver(([en]) => {
		visible = en.isIntersecting;
		kick();
	});
	io.observe(canvas);
	const onVis = () => kick();
	document.addEventListener('visibilitychange', onVis);
	resize();
	schedule();

	return {
		setPoints(p, sel, fl) {
			points = p;
			selected = sel;
			flash = fl ?? new Set();
			kick();
		},
		setColors(c) {
			colors = c;
			kick();
		},
		focus(p) {
			lastTouch = performance.now();
			vLon = vLat = 0;
			const to = { lon: p.lon, lat: clampLat(p.lat) };
			if (opts.reduced) {
				view.lon = to.lon;
				view.lat = to.lat;
			} else fly = { from: { ...view }, to, t0: performance.now() };
			kick();
		},
		nudge(dLon, dLat, z = 1) {
			lastTouch = performance.now();
			view.lon = wrapLon(view.lon + dLon);
			view.lat = clampLat(view.lat + dLat);
			setZoom(zoom * z);
		},
		destroy() {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
			clearInterval(sunTimer);
			raf = 0;
			visible = false;
			ro.disconnect();
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
			canvas.removeEventListener('pointerdown', down);
			canvas.removeEventListener('pointermove', move);
			canvas.removeEventListener('pointerup', up);
			canvas.removeEventListener('pointercancel', up);
			canvas.removeEventListener('wheel', wheel);
		}
	};
}
