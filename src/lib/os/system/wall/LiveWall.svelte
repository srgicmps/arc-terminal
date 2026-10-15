<!--
	Fondo «vivo» del escritorio de Arc OS: el globo de GLOBO, tenue y girando despacio, con los terremotos de
	las últimas horas (/data/quakes.json). No se toca (deja pasar el ratón a los iconos y widgets), se para si no se
	ve (también tapado por una ventana maximizada) y, con prefers-reduced-motion, se queda quieto. El dibujo (src/lib/geo/globe-render.ts) se carga con
	import() solo si eliges este fondo.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import type { Globe } from '#lib/geo/globe-render.ts';
	import { quakePoints } from '#lib/geo/layers.ts';
	import type { Quake } from '#lib/types.ts';
	import { desk } from '../../os.svelte.ts';

	let canvas = $state<HTMLCanvasElement>();
	let probe = $state<HTMLSpanElement>();
	// Tapado por una ventana maximizada: sin pintar, y el globo se para (su IntersectionObserver ya no lo ve).
	const covered = $derived(desk().wins.some((w) => !w.min && w.snap === 'max'));

	const TOKENS = ['bg', 'panel', 'raise', 'line', 'muted', 'fg', 'amber', 'amber-soft', 'amber-dim', 'amber-edge'];
	function colors(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const t of TOKENS) {
			probe!.style.color = `var(--${t})`;
			out[t] = getComputedStyle(probe!).color;
		}
		return out;
	}

	async function quakes(): Promise<Quake[]> {
		try {
			const r = await fetch(asset('/data/quakes.json' as Parameters<typeof asset>[0]));
			return r.ok ? (((await r.json()) as { data: Quake[] }).data ?? []) : [];
		} catch {
			return [];
		}
	}

	$effect(() => {
		if (!canvas || !probe) return;
		let g: Globe | null = null;
		let gone = false;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		Promise.all([import('#lib/geo/globe-render.ts'), quakes()])
			.then(([m, list]) => {
				if (gone) return;
				g = m.createGlobe(canvas!, { colors: colors(), reduced, onPick: () => {} });
				g.setPoints(quakePoints(list), null);
			})
			.catch(() => {});
		const mo = new MutationObserver(() => g?.setColors(colors()));
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-style', 'data-accent'] });
		return () => {
			gone = true;
			mo.disconnect();
			g?.destroy();
		};
	});
</script>

<div class="live" class:covered aria-hidden="true">
	<canvas bind:this={canvas}></canvas>
	<span class="probe" bind:this={probe}></span>
</div>

<style>
	.live {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: var(--os-live-opacity);
	}

	.covered {
		content-visibility: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.probe {
		position: absolute;
		visibility: hidden;
	}
</style>
