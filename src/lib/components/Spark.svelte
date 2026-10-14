<!-- Minigráfico de línea para las tablas: solo la forma, sin ejes. -->
<script lang="ts">
	interface Props {
		values: number[];
		width?: number;
		height?: number;
	}

	let { values, width = 72, height = 20 }: Props = $props();

	const path = $derived.by(() => {
		if (values.length < 2) return '';
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min || 1;
		return values
			.map((v, i) => {
				const x = (i / (values.length - 1)) * (width - 2) + 1;
				const y = height - 2 - ((v - min) / span) * (height - 4);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	const dir = $derived(values.length > 1 ? Math.sign(values.at(-1)! - values[0]) : 0);
</script>

{#if path}
	<svg class="spark" class:up={dir > 0} class:down={dir < 0} viewBox="0 0 {width} {height}" {width} {height} aria-hidden="true">
		<polyline points={path} />
	</svg>
{/if}

<style>
	.spark {
		display: block;
		margin-left: auto;
		color: var(--muted);
	}

	.spark.up {
		color: var(--up);
	}

	.spark.down {
		color: var(--down);
	}

	polyline {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.2;
		stroke-linejoin: round;
	}
</style>
