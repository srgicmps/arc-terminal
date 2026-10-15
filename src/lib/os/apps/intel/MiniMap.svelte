<!--
	Mapa pequeño del Expediente: el contorno de los continentes de world.ts (el del mapa de GEO, equirectangular
	360 × 180) recortado alrededor del punto, con la retícula cada 15° y la marca en ámbar.
-->
<script lang="ts">
	import { LAND } from '#lib/world.ts';

	let { at, label }: { at: [number, number]; label: string } = $props();

	const SPAN = 80;
	const RATIO = 0.45;
	const box = $derived.by(() => {
		const w = SPAN;
		const h = SPAN * RATIO;
		const x = Math.max(0, Math.min(360 - w, at[1] + 180 - w / 2));
		const y = Math.max(0, Math.min(180 - h, 90 - at[0] - h / 2));
		return { x, y, w, h };
	});
	const grid = Array.from({ length: 23 }, (_, i) => i * 15 + 15).filter((v) => v < 360);
</script>

<svg class="map" viewBox="{box.x} {box.y} {box.w} {box.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa: {label}, {at[0].toFixed(1)}, {at[1].toFixed(1)}">
	<rect class="sea" x={box.x} y={box.y} width={box.w} height={box.h} />
	{#each grid as v (v)}
		<line class="grat" x1={v} y1="0" x2={v} y2="180" />
		{#if v < 180}<line class="grat" x1="0" y1={v} x2="360" y2={v} />{/if}
	{/each}
	<path class="land" d={LAND} />
	<circle class="ring" cx={at[1] + 180} cy={90 - at[0]} r="3.2" />
	<circle class="mark" cx={at[1] + 180} cy={90 - at[0]} r="1" />
</svg>

<style>
	.map {
		display: block;
		width: 100%;
		height: var(--cmd-map-h);
		border: var(--border);
	}

	.sea {
		fill: var(--cmd-bg);
	}

	.grat {
		stroke: var(--cmd-grid);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.land {
		fill: var(--raise);
		stroke: var(--cmd-edge);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.ring {
		fill: var(--amber-soft);
		stroke: var(--amber-edge);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.mark {
		fill: var(--amber);
	}
</style>
