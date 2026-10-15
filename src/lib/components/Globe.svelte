<!--
	Globo 3D (GLOBO, «Ver en 3D» de GEO y la Sala de control): los mismos puntos que el mapa, en una esfera que
	gira. El dibujo (src/lib/geo/globe-render.ts) y las costas se cargan con import() al montar: no pesan en
	ninguna otra vista. Colores de los tokens del estilo activo, releídos al cambiar de tema o de estética.
	Tocar un punto lo centra y abre su ficha. Teclado: flechas giran, + y − acercan.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Globe, GlobeOptions } from '#lib/geo/globe-render.ts';
	import type { GlobePoint } from '#lib/geo/globe.ts';

	interface Props {
		points: GlobePoint[];
		/** Texto de la leyenda de cada capa que se ve. */
		legend?: readonly { value: string; label: string }[];
		/** Puntos que laten (lo nuevo de la Sala de control). */
		flash?: Set<string>;
	}

	let { points, legend = [], flash }: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	let probe = $state<HTMLSpanElement>();
	let globe = $state<Globe | null>(null);
	let failed = $state(false);
	let selected = $state<GlobePoint | null>(null);
	/** Giro solo encendido; con «reducir movimiento» no gira y no hace falta el botón. */
	let spinning = $state(true);
	let reduced = $state(false);

	const shown = $derived(selected && points.some((p) => p.id === selected!.id) ? selected : null);
	const present = $derived(legend.filter((l) => points.some((p) => p.layer === l.value)));

	const TOKENS = ['bg', 'panel', 'raise', 'line', 'muted', 'fg', 'amber', 'amber-soft', 'amber-dim', 'amber-edge'];
	/** Color calculado de cada token: el canvas no entiende var(--…). */
	function colors(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const t of TOKENS) {
			probe!.style.color = `var(--${t})`;
			out[t] = getComputedStyle(probe!).color;
		}
		return out;
	}

	function choose(p: GlobePoint | null) {
		selected = p;
		if (p) globe?.focus(p);
	}

	$effect(() => {
		if (!canvas || !probe) return;
		let g: Globe | null = null;
		let gone = false;
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const opts: GlobeOptions = { colors: colors(), reduced, onPick: choose };
		import('#lib/geo/globe-render.ts')
			.then((m) => {
				if (gone) return;
				g = m.createGlobe(canvas!, opts);
				globe = g;
			})
			.catch(() => (failed = true));
		// Tema, estética o acento nuevos: se releen los colores (y otra vez al rato, cuando ha llegado su CSS).
		let t: ReturnType<typeof setTimeout>;
		const recolor = () => {
			g?.setColors(colors());
			clearTimeout(t);
			t = setTimeout(() => g?.setColors(colors()), 400);
		};
		const mo = new MutationObserver(recolor);
		mo.observe(document.documentElement, { attributes: true });
		return () => {
			gone = true;
			clearTimeout(t);
			mo.disconnect();
			g?.destroy();
			globe = null;
		};
	});

	$effect(() => {
		globe?.setSpin(spinning);
	});

	$effect(() => {
		globe?.setPoints(points, shown?.id ?? null, flash);
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
		const m = k[e.key];
		if (!m || !globe) return;
		e.preventDefault();
		globe.nudge(...m);
	}
</script>

<div class="globe">
	<span class="probe" bind:this={probe} aria-hidden="true"></span>
	{#if failed}
		<p class="empty">
			Este navegador no puede dibujar el globo. <a href={resolve('/geo')}>Ver el mapa de GEO ›</a>
		</p>
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
		<!-- Para lectores de pantalla: los puntos en una lista que abre la misma ficha. Fuera del tabulador: con el
		     teclado serían cien paradas invisibles. -->
		<ul class="sr">
			{#each points as p (p.id)}
				<li><button type="button" tabindex="-1" onclick={() => choose(p)}>{p.title}. {p.sub}</button></li>
			{/each}
		</ul>
	{/if}

	{#if shown}
		<div class="card" role="status">
			<div class="txt">
				<b>{shown.title}</b>
				<span>{shown.sub}</span>
			</div>
			{#if shown.country}<a href="{resolve('/pais')}?c={shown.country}">PAIS ›</a>{/if}
			<a href={shown.url} target="_blank" rel="noopener">Abrir ›</a>
			<button type="button" aria-label="Cerrar la ficha" onclick={() => (selected = null)}>×</button>
		</div>
	{/if}

	{#if present.length || (globe && !reduced)}
		<p class="legend">
			{#each present as l (l.value)}<span><i class={l.value}></i>{l.label}</span>{/each}
			{#if globe && !reduced}
				<button type="button" class="spin" aria-pressed={!spinning} onclick={() => (spinning = !spinning)}>
					{spinning ? 'Pausar el giro' : 'Girar solo'}
				</button>
			{/if}
		</p>
	{/if}
</div>

<style>
	.globe {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-6);
	}

	canvas {
		display: block;
		width: 100%;
		max-width: var(--globe-max, 900px);
		aspect-ratio: 1;
		max-height: var(--globe-h, 70vh);
		touch-action: none;
		cursor: grab;
		outline: none;
	}

	canvas:active {
		cursor: grabbing;
	}

	.cv {
		display: flex;
		justify-content: center;
		width: 100%;
		outline: none;
	}

	.cv:focus-visible canvas {
		outline: var(--hair) solid var(--amber-dim);
	}

	.probe {
		position: absolute;
		visibility: hidden;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.card {
		display: flex;
		width: 100%;
		align-items: center;
		gap: var(--sp-10);
		max-width: 560px;
		padding: var(--sp-6) var(--sp-10);
		border: var(--border);
		background: var(--raise);
		font-size: var(--fs-s);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.txt b {
		font-family: var(--sans);
		font-weight: var(--fw-medium);
	}

	.txt span {
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card a {
		color: var(--amber);
		text-decoration: none;
		white-space: nowrap;
	}

	.card button {
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font-size: var(--fs-l);
		min-width: var(--touch);
		min-height: var(--touch);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-4) var(--sp-16);
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.spin {
		min-height: var(--control-h);
		padding: 0 var(--sp-6);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.spin:hover,
	.spin:focus-visible {
		color: var(--amber);
	}

	.legend i {
		display: inline-block;
		width: var(--swatch);
		height: var(--swatch);
		margin-right: var(--sp-6);
		border-radius: 50%;
		vertical-align: calc(-1 * var(--hair));
		border: var(--hair) solid var(--amber);
		background: var(--amber-soft);
	}

	.legend i:is(.quakes, .straits, .storms, .elections, .internet, .airspace) {
		background: none;
	}

	.legend i:is(.storms, .elections, .internet) {
		border-color: var(--fg);
	}

	.legend i.conflict {
		background: var(--amber-edge);
	}

	.legend i.airspace {
		border-style: dashed;
	}

	.legend i.maritime {
		background: var(--amber-edge);
		border-color: transparent;
	}

	.legend i:is(.travel, .sanctions) {
		border-radius: 0;
		transform: rotate(45deg);
	}

	.legend i.elections {
		border-radius: 0;
	}
</style>
