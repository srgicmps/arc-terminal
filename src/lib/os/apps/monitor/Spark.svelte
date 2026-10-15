<!--
	Gráfica de área pequeña de la pestaña «Recursos»: título, valor actual y los últimos segundos (lo más reciente a la
	derecha). SVG propio, sin animaciones: se repinta con cada muestra.
-->
<script lang="ts">
	import { niceMax, paths, WINDOW } from './resources.ts';

	let {
		title,
		values,
		value,
		sub = '',
		max,
		floor = 1,
		tone = 'amber',
		fmt = (v: number) => String(v)
	}: {
		title: string;
		values: number[];
		/** Texto del valor actual. */
		value: string;
		sub?: string;
		/** Tope fijo del eje (p. ej. 100 en un %); sin él, se ajusta a los datos. */
		max?: number;
		floor?: number;
		tone?: 'amber' | 's2' | 's3' | 'up' | 'down';
		/** Formato del tope del eje. */
		fmt?: (v: number) => string;
	} = $props();

	const W = 300;
	const H = 64;
	const top = $derived(max ?? niceMax(values, floor));
	const d = $derived(paths(values, top, W, H, WINDOW));
</script>

<figure class={tone}>
	<figcaption>
		<span class="t">{title}</span>
		<b>{value}</b>
	</figcaption>
	<div class="plot">
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="{title}: {value}">
			<line x1="0" x2={W} y1={H / 2} y2={H / 2} class="grid" />
			{#if d.line}
				<path d={d.area} class="area" />
				<path d={d.line} class="line" />
			{/if}
		</svg>
		<span class="ax">{fmt(top)}</span>
	</div>
	<p>{sub || `Últimos ${WINDOW} s`}</p>
</figure>

<style>
	figure {
		--c: var(--amber);
		margin: 0;
		padding: var(--sp-8);
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius-s);
		min-width: 0;
	}

	.s2 {
		--c: var(--series-2);
	}

	.s3 {
		--c: var(--series-3);
	}

	.up {
		--c: var(--up);
	}

	.down {
		--c: var(--down);
	}

	figcaption {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--sp-8);
		margin-bottom: var(--sp-6);
	}

	.t {
		color: var(--muted);
		font-size: var(--fs-s);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	b {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
		font-size: var(--fs-l);
		color: var(--fg);
		white-space: nowrap;
	}

	.plot {
		position: relative;
		height: 64px;
		border: var(--border);
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.grid {
		stroke: var(--line);
		stroke-dasharray: 2 3;
		vector-effect: non-scaling-stroke;
	}

	.area {
		fill: var(--c);
		opacity: 0.18;
	}

	.line {
		fill: none;
		stroke: var(--c);
		stroke-width: 1.5;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.ax {
		position: absolute;
		top: var(--sp-2);
		left: var(--sp-4);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--faint);
	}

	p {
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-xs);
		color: var(--muted);
	}
</style>
