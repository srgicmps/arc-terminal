<!--
	Gráfico de líneas en SVG, sin librerías: rejilla discreta, etiquetas a la derecha y el último valor
	resaltado. Al pasar el dedo o el ratón muestra el valor de cada punto.
-->
<script lang="ts">
	import { axisTicks } from '#lib/chart.ts';
	import { nf, period } from '#lib/format.ts';

	interface Line {
		label: string;
		points: { t: string; v: number }[];
		/** Variable CSS del color: --amber, --muted… */
		color?: string;
	}

	interface Props {
		lines: Line[];
		decimals?: number;
		unit?: string;
		height?: number;
	}

	let { lines, decimals = 2, unit = '', height = 200 }: Props = $props();

	let width = $state(600);
	let hover = $state<number | null>(null);

	const pad = { l: 8, r: 56, t: 12, b: 22 };

	// Eje X común: todos los periodos de todas las líneas, ordenados.
	const ts = $derived([...new Set(lines.flatMap((l) => l.points.map((p) => p.t)))].sort());
	const values = $derived(lines.flatMap((l) => l.points.map((p) => p.v)));
	const range = $derived.by(() => {
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const step = niceStep((hi - lo) / 4 || Math.abs(hi) / 10 || 1);
		return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
	});

	function niceStep(x: number) {
		const e = Math.pow(10, Math.floor(Math.log10(x)));
		const f = x / e;
		return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
	}

	const x = (i: number) => pad.l + (ts.length < 2 ? 0.5 : i / (ts.length - 1)) * (width - pad.l - pad.r);
	const y = (v: number) =>
		pad.t + (1 - (v - range.lo) / (range.hi - range.lo || 1)) * (height - pad.t - pad.b);

	const ticks = $derived.by(() => {
		const out: number[] = [];
		for (let v = range.lo; v <= range.hi + range.step / 2; v += range.step) out.push(v);
		return out;
	});

	// Etiquetas del eje X: tantas como quepan sin pisarse. Cada carácter de la letra de datos (11 px) mide
	// unos 7 px; la primera y la última se alinean al borde, así que se deja hueco y medio entre ellas.
	const xLabels = $derived.by(() => {
		const longest = Math.max(0, ...ts.map((t) => period(t).length));
		const gap = longest * 7 * 1.5 + 8;
		return axisTicks(ts.length, width - pad.l - pad.r, gap).map((i) => ({ t: ts[i], i }));
	});

	const path = (line: Line) =>
		line.points
			.map((p, k) => `${k ? 'L' : 'M'}${x(ts.indexOf(p.t)).toFixed(1)},${y(p.v).toFixed(1)}`)
			.join('');

	function onmove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * width;
		const i = Math.round(((px - pad.l) / (width - pad.l - pad.r)) * (ts.length - 1));
		hover = Math.max(0, Math.min(ts.length - 1, i));
	}

	const fmt = (v: number) => `${nf(v, decimals)}${unit}`;
</script>

<div class="chart" bind:clientWidth={width}>
	{#if ts.length && values.length}
		<svg
			viewBox="0 0 {width} {height}"
			{width}
			{height}
			role="img"
			aria-label={lines.map((l) => `${l.label}: ${fmt(l.points.at(-1)?.v ?? 0)}`).join(', ')}
			onpointermove={onmove}
			onpointerleave={() => (hover = null)}
		>
			{#each ticks as v (v)}
				<line class="grid" x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} />
				<text class="lbl" x={width - pad.r + 8} y={y(v) + 4}>{nf(v, range.step < 0.01 ? 3 : range.step < 1 ? 2 : 0)}</text>
			{/each}
			{#each xLabels as { t, i } (t)}
				<text class="lbl" x={x(i)} y={height - 6} text-anchor={i === 0 ? 'start' : i === ts.length - 1 ? 'end' : 'middle'}>
					{period(t)}
				</text>
			{/each}
			{#each lines as line (line.label)}
				<path d={path(line)} style:stroke="var({line.color ?? '--amber'})" />
				{#if line.points.length === 1}
					<circle cx={x(ts.indexOf(line.points[0].t))} cy={y(line.points[0].v)} r="3" style:fill="var({line.color ?? '--amber'})" />
				{/if}
			{/each}
			{#if hover !== null}
				<line class="cursor" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} />
			{/if}
		</svg>
		<div class="legend">
			{#each lines as line (line.label)}
				{@const p = hover !== null ? line.points.find((q) => q.t === ts[hover!]) : line.points.at(-1)}
				<span><i style:background="var({line.color ?? '--amber'})"></i>{line.label} <b>{p ? fmt(p.v) : '—'}</b></span>
			{/each}
			<span class="when">{hover !== null ? period(ts[hover]) : period(ts.at(-1) ?? '')}</span>
		</div>
	{:else}
		<p class="empty">Aún no hay historial: se irá llenando día a día.</p>
	{/if}
</div>

<style>
	.chart {
		padding: var(--sp-8) var(--pad-x) var(--sp-4);
	}

	svg {
		display: block;
		touch-action: pan-y;
	}

	.grid {
		stroke: var(--line);
	}

	.lbl {
		fill: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	path {
		fill: none;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.cursor {
		stroke: var(--muted);
		stroke-dasharray: 2 3;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-16);
		padding: var(--sp-4) 0 var(--sp-6);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.legend i {
		display: inline-block;
		width: 10px;
		height: 2px;
		margin-right: var(--sp-6);
		vertical-align: middle;
	}

	.legend b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.when {
		margin-left: auto;
		color: var(--faint);
	}

	.empty {
		padding-inline: 0;
	}
</style>
