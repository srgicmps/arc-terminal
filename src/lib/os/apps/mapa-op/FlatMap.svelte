<!--
	Mapa operacional: el mapa plano (equirectangular, el mismo dibujo de costas que GEO, src/lib/world.ts) con una
	rejilla de meridianos y paralelos cada 30°. Arrastrar mueve, la rueda acerca hacia el ratón; con el teclado,
	flechas, + y −. Los puntos tienen la forma y el color de su capa (LAYER_STYLE de src/lib/geo/globe.ts, como el
	globo) y miden lo mismo en px a cualquier zoom. Las cuentas están en ops.ts.
-->
<script lang="ts">
	import { LAND } from '#lib/world.ts';
	import { styleOf } from '#lib/geo/globe.ts';
	import { panBy, toXY, zoomAt, type OpPoint, type ViewBox } from './ops.ts';

	interface Props {
		points: OpPoint[];
		selected: string | null;
		/** El encuadre (viewBox), en grados del mapa. */
		view: ViewBox;
		/** El mundo entero en la proporción de la ventana: el tope al alejar. */
		max: ViewBox;
		/** Los sucesos «recientes» (laten, si el sistema no pide menos movimiento): los mismos que en el globo. */
		flash: Set<string>;
		onpick: (p: OpPoint | null) => void;
		/** Coordenadas bajo el ratón, para el rótulo de la esquina. */
		onhover?: (at: { lat: number; lon: number } | null) => void;
	}

	let { points, selected, view = $bindable(), max, flash, onpick, onhover }: Props = $props();

	let svg = $state<SVGSVGElement>();
	let pw = $state(1);
	let ph = $state(1);
	/** Arrastre en curso: el último punto y si ya se ha movido (entonces no es un clic). */
	let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
	let dragged = false;
	/** Dedos en la pantalla: con dos, pellizcar acerca o aleja (como en el globo). */
	const touches = new Map<number, { x: number; y: number }>();
	let pinch = 0;

	const spread = () => {
		const [a, b] = [...touches.values()];
		return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	};

	/** Grados del mapa por px: los puntos y los trazos miden lo mismo a cualquier zoom. */
	const k = $derived(view.w / Math.max(1, pw));
	const LAT = [-60, -30, 0, 30, 60];
	const LON = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];

	const radius = (p: OpPoint) => Math.min(9, Math.max(3, p.r * 2.2)) * k;
	const paint = (token: string | undefined) => (token ? `var(--${token})` : 'none');

	function frac(e: { clientX: number; clientY: number }) {
		const r = svg!.getBoundingClientRect();
		return { fx: (e.clientX - r.left) / Math.max(1, r.width), fy: (e.clientY - r.top) / Math.max(1, r.height) };
	}

	// La rueda: con addEventListener para poder cancelar el scroll de la ventana (onwheel de Svelte es pasivo).
	$effect(() => {
		const el = svg;
		if (!el) return;
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			const { fx, fy } = frac(e);
			view = zoomAt(view, e.deltaY > 0 ? 1.2 : 1 / 1.2, fx, fy, max);
		};
		el.addEventListener('wheel', wheel, { passive: false });
		return () => el.removeEventListener('wheel', wheel);
	});

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		if (e.pointerType !== 'mouse') {
			touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
			if (touches.size === 2) {
				// El segundo dedo: deja de arrastrar y empieza a pellizcar.
				svg?.setPointerCapture(e.pointerId);
				pinch = spread().d;
				drag = null;
				dragged = true;
				return;
			}
		}
		drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
		dragged = false;
	}

	function move(e: PointerEvent) {
		const { fx, fy } = frac(e);
		if (e.pointerType === 'mouse') onhover?.({ lat: 90 - (view.y + fy * view.h), lon: view.x + fx * view.w - 180 });
		if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (touches.size >= 2) {
			const s = spread();
			if (pinch > 0 && s.d > 0) {
				const m = frac({ clientX: s.x, clientY: s.y });
				view = zoomAt(view, pinch / s.d, m.fx, m.fy, max);
			}
			pinch = s.d;
			return;
		}
		if (!drag || drag.id !== e.pointerId) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.moved && Math.hypot(dx, dy) < 4) return;
		if (!drag.moved) svg?.setPointerCapture(e.pointerId);
		drag.moved = true;
		dragged = true;
		view = panBy(view, dx, dy, pw, ph);
		drag.x = e.clientX;
		drag.y = e.clientY;
	}

	function up(e: PointerEvent) {
		touches.delete(e.pointerId);
		pinch = 0;
		if (drag?.id === e.pointerId || touches.size === 0) drag = null;
		// Si queda un dedo después de pellizcar, sigue arrastrando con él sin dar un salto.
		const rest = [...touches.entries()][0];
		if (rest && !drag) drag = { x: rest[1].x, y: rest[1].y, moved: true, id: rest[0] };
	}

	function click(p: OpPoint | null) {
		if (dragged) return;
		onpick(p);
	}

	function key(e: KeyboardEvent) {
		const step = 40;
		const pans: Record<string, [number, number]> = {
			ArrowLeft: [step, 0],
			ArrowRight: [-step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step]
		};
		if (pans[e.key]) view = panBy(view, ...pans[e.key], pw, ph);
		else if (e.key === '+' || e.key === '=') view = zoomAt(view, 1 / 1.25, 0.5, 0.5, max);
		else if (e.key === '-') view = zoomAt(view, 1.25, 0.5, 0.5, max);
		else if (e.key === 'Escape') onpick(null);
		else return;
		e.preventDefault();
	}
</script>

<div class="flat" bind:clientWidth={pw} bind:clientHeight={ph}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svg}
		viewBox="{view.x} {view.y} {view.w} {view.h}"
		preserveAspectRatio="xMidYMid meet"
		role="application"
		aria-roledescription="mapa"
		aria-label="Mapa con {points.length} puntos. Arrastra para moverlo; flechas y + o − con el teclado."
		tabindex="0"
		onkeydown={key}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onpointerleave={() => onhover?.(null)}
		onclick={() => click(null)}
	>
		<g class="grid" aria-hidden="true">
			{#each LAT as lat (lat)}<line x1="0" x2="360" y1={90 - lat} y2={90 - lat} class:eq={lat === 0} />{/each}
			{#each LON as lon (lon)}<line y1="0" y2="180" x1={lon + 180} x2={lon + 180} class:eq={lon === 0} />{/each}
			<rect x="0" y="0" width="360" height="180" class="edge" />
		</g>
		<path class="land" d={LAND} />
		{#each points as p (p.id)}
			{@const [cx, cy] = toXY(p.lat, p.lon)}
			{@const s = styleOf(p.layer)}
			{@const r = radius(p)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<g
				class="pt"
				class:strong={p.strong}
				class:on={selected === p.id}
				class:recent={flash.has(p.id)}
				role="button"
				tabindex="-1"
				aria-label="{p.title}. {p.sub}"
				onclick={(e) => {
					e.stopPropagation();
					click(p);
				}}
			>
				<circle class="hit" {cx} {cy} r={Math.max(r, 7 * k)} />
				{#if flash.has(p.id)}<circle class="halo" {cx} {cy} {r} />{/if}
				{#if s.shape === 'diamond'}
					<rect
						x={cx - r * 0.9}
						y={cy - r * 0.9}
						width={r * 1.8}
						height={r * 1.8}
						transform="rotate(45 {cx} {cy})"
						fill={p.strong ? paint('amber-edge') : paint(s.fill)}
						stroke={paint(s.stroke)}
					/>
				{:else if s.shape === 'square'}
					<rect
						x={cx - r * 0.85}
						y={cy - r * 0.85}
						width={r * 1.7}
						height={r * 1.7}
						fill={paint(s.fill)}
						stroke={paint(s.stroke)}
					/>
				{:else if s.shape === 'triangle'}
					<path
						d="M{cx},{cy - r * 1.1} L{cx + r},{cy + r * 0.7} L{cx - r},{cy + r * 0.7} Z"
						fill={paint(s.fill)}
						stroke={paint(s.stroke)}
					/>
				{:else}
					<circle
						{cx}
						{cy}
						{r}
						fill={p.strong ? paint('amber-edge') : paint(s.fill)}
						stroke={paint(s.stroke)}
						class:dash={s.dash}
					/>
				{/if}
				{#if selected === p.id}
					<circle class="ring" {cx} {cy} r={r + 5 * k} />
					<line class="tick" x1={cx - r - 9 * k} x2={cx - r - 3 * k} y1={cy} y2={cy} />
					<line class="tick" x1={cx + r + 3 * k} x2={cx + r + 9 * k} y1={cy} y2={cy} />
					<line class="tick" y1={cy - r - 9 * k} y2={cy - r - 3 * k} x1={cx} x2={cx} />
					<line class="tick" y1={cy + r + 3 * k} y2={cy + r + 9 * k} x1={cx} x2={cx} />
				{/if}
				<title>{p.title} · {p.sub}</title>
			</g>
		{/each}
	</svg>
</div>

<style>
	.flat {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
		outline: none;
	}

	svg:active {
		cursor: grabbing;
	}

	svg:focus-visible {
		box-shadow: inset 0 0 0 var(--hair) var(--cmd-cold);
	}

	/* Trazos de 1 px a cualquier zoom. */
	line,
	rect,
	circle,
	path {
		vector-effect: non-scaling-stroke;
		stroke-width: var(--hair);
	}

	.grid line {
		stroke: var(--cmd-grid);
	}

	.grid line.eq {
		stroke: var(--cmd-cold-soft);
	}

	.grid .edge {
		fill: none;
		stroke: var(--cmd-coast);
	}

	.land {
		fill: var(--cmd-land);
		stroke: var(--cmd-coast);
	}

	.pt {
		cursor: pointer;
		outline: none;
	}

	.pt .hit {
		fill: transparent;
		stroke: none;
		pointer-events: all;
	}

	.dash {
		stroke-dasharray: 2 2;
	}

	.pt.on .ring {
		fill: none;
		stroke: var(--cmd-cold);
	}

	.tick {
		stroke: var(--cmd-cold);
	}

	.halo {
		fill: none;
		stroke: var(--amber);
		transform-box: fill-box;
		transform-origin: center;
		animation: halo 2.4s ease-out infinite;
	}

	@keyframes halo {
		from {
			opacity: 0.8;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(3);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.halo {
			animation: none;
			opacity: 0.6;
			transform: scale(1.8);
		}
	}
</style>
