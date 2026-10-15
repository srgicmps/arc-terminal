<!-- Minigráfico de la app Sencilla: la forma de la serie, con un relleno suave, a todo el ancho. Sin ejes. -->
<script lang="ts">
	let { values, tall = false }: { values: number[]; tall?: boolean } = $props();

	const W = 100;
	const H = 30;
	const path = $derived.by(() => {
		if (values.length < 2) return null;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 2 - ((v - min) / span) * (H - 4)]);
		const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
		return { line, area: `${line} L${W} ${H} L0 ${H} Z` };
	});
	const dir = $derived(values.length > 1 ? Math.sign(values.at(-1)! - values[0]) : 0);
</script>

{#if path}
	<svg class="mini" class:tall class:up={dir > 0} class:down={dir < 0} viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
		<path class="area" d={path.area} />
		<path class="line" d={path.line} vector-effect="non-scaling-stroke" />
	</svg>
{/if}

<style>
	.mini {
		display: block;
		width: 100%;
		height: var(--app-spark-h);
		color: var(--muted);
	}

	.tall {
		height: var(--app-chart-h);
	}

	.up {
		color: var(--up);
	}

	.down {
		color: var(--down);
	}

	.line {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.area {
		fill: currentColor;
		opacity: 0.1;
	}
</style>
