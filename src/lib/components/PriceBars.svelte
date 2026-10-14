<!-- Barras del precio de la luz de un día: verde las horas baratas, rojo las caras. -->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import type { HourPrice } from '#lib/power.ts';

	interface Props {
		prices: HourPrice[];
		/** Hora a resaltar (la actual), o -1. */
		current?: number;
	}

	let { prices, current = -1 }: Props = $props();

	const values = $derived(prices.map((p) => p.kwh));
	const min = $derived(Math.min(...values));
	const max = $derived(Math.max(...values));
	// Tercios: barato, medio, caro.
	const level = (v: number) => {
		const r = (v - min) / (max - min || 1);
		return r < 0.33 ? 'low' : r > 0.66 ? 'high' : 'mid';
	};
</script>

<div class="bars" role="img" aria-label="Precio por horas: mínimo {nf(min, 3)} y máximo {nf(max, 3)} €/kWh">
	{#each prices as p (p.hour)}
		<div class="bar {level(p.kwh)}" class:now={p.hour === current} title="{String(p.hour).padStart(2, '0')}:00 · {nf(p.kwh, 3)} €/kWh">
			<i style:height="{(8 + (92 * (p.kwh - min)) / (max - min || 1)).toFixed(0)}%"></i>
			<span>{p.hour % 3 === 0 ? String(p.hour).padStart(2, '0') : ''}</span>
		</div>
	{/each}
</div>

<style>
	.bars {
		display: grid;
		grid-template-columns: repeat(24, minmax(0, 1fr));
		gap: 2px;
		height: 150px;
		padding: 12px 12px 4px;
	}

	.bar {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
	}

	.bar i {
		display: block;
		background: var(--faint);
	}

	.bar.low i {
		background: var(--up);
		opacity: 0.8;
	}

	.bar.high i {
		background: var(--down);
		opacity: 0.8;
	}

	.bar.now i {
		opacity: 1;
		outline: 1px solid var(--amber);
		outline-offset: 1px;
	}

	.bar span {
		height: 16px;
		padding-top: 3px;
		color: var(--faint);
		font-size: 10px;
		text-align: center;
	}
</style>
