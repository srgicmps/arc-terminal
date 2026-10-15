<!--
	Mapa operacional en 3D: el mismo globo de GLOBO (src/lib/geo/globe-render.ts, cargado con import() solo al
	elegir «Globo»), con los colores del centro de mando (pizarra, tierra y costas de los tokens --cmd-*).
	Tocar un punto lo centra y abre su ficha. Teclado: flechas giran, + y − acercan.
-->
<script lang="ts">
	import type { Globe, GlobeOptions } from '#lib/geo/globe-render.ts';
	import type { GlobePoint } from '#lib/geo/globe.ts';
	import type { OpPoint } from './ops.ts';

	interface Props {
		points: OpPoint[];
		selected: string | null;
		onpick: (p: OpPoint | null) => void;
		/** Puntos recientes, que laten. */
		flash: Set<string>;
	}

	let { points, selected, onpick, flash }: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	let probe = $state<HTMLSpanElement>();
	let globe = $state<Globe | null>(null);
	let failed = $state(false);

	/** Token del globo → token del centro de mando que lo sustituye. */
	const TOKENS: Record<string, string> = {
		bg: 'cmd-slate',
		panel: 'cmd-slate',
		raise: 'cmd-land',
		line: 'cmd-coast',
		muted: 'muted',
		fg: 'fg',
		amber: 'amber',
		'amber-soft': 'amber-soft',
		'amber-dim': 'amber-dim',
		'amber-edge': 'amber-edge'
	};

	function colors(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const [k, t] of Object.entries(TOKENS)) {
			probe!.style.color = `var(--${t})`;
			out[k] = getComputedStyle(probe!).color;
		}
		return out;
	}

	$effect(() => {
		if (!canvas || !probe) return;
		let g: Globe | null = null;
		let gone = false;
		const opts: GlobeOptions = {
			colors: colors(),
			reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
			onPick: (p: GlobePoint | null) => onpick(p as OpPoint | null)
		};
		import('#lib/geo/globe-render.ts')
			.then((m) => {
				if (gone) return;
				g = m.createGlobe(canvas!, opts);
				globe = g;
			})
			.catch(() => (failed = true));
		const mo = new MutationObserver(() => g?.setColors(colors()));
		mo.observe(document.documentElement, { attributes: true });
		return () => {
			gone = true;
			mo.disconnect();
			g?.destroy();
			globe = null;
		};
	});

	$effect(() => {
		globe?.setPoints(points, selected, flash);
	});

	// Al elegir otro punto (desde la lista o el mapa), el globo gira hasta él; una vez, no a cada paso del cursor.
	let focused: string | null = null;
	$effect(() => {
		if (!globe || selected === focused) return;
		focused = selected;
		const p = selected ? points.find((x) => x.id === selected) : null;
		if (p) globe.focus(p);
	});

	function key(e: KeyboardEvent) {
		const k: Record<string, [number, number, number]> = {
			ArrowLeft: [-10, 0, 1],
			ArrowRight: [10, 0, 1],
			ArrowUp: [0, 10, 1],
			ArrowDown: [0, -10, 1],
			'+': [0, 0, 1.25],
			'=': [0, 0, 1.25],
			'-': [0, 0, 0.8]
		};
		if (e.key === 'Escape') return onpick(null);
		const m = k[e.key];
		if (!m || !globe) return;
		e.preventDefault();
		globe.nudge(...m);
	}
</script>

<div class="globe">
	<span class="probe" bind:this={probe} aria-hidden="true"></span>
	{#if failed}
		<p class="empty">Este navegador no puede dibujar el globo: usa el mapa plano.</p>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="cv"
			tabindex="0"
			role="application"
			aria-roledescription="globo"
			aria-label="Globo con {points.length} puntos. Arrastra para girarlo; flechas y + o − con el teclado."
			onkeydown={key}
		>
			<canvas bind:this={canvas}></canvas>
		</div>
	{/if}
</div>

<style>
	.globe {
		position: absolute;
		inset: 0;
	}

	.probe {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}

	.cv {
		position: absolute;
		inset: 0;
		outline: none;
	}

	.cv:focus-visible {
		box-shadow: inset 0 0 0 var(--hair) var(--cmd-cold);
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.empty {
		padding: var(--sp-16);
		color: var(--muted);
	}
</style>
