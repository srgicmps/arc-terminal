<!--
	VIX y su curva (Cboe): la volatilidad que el mercado de opciones espera para el S&P 500 a 9 días, 30 días
	(el VIX), 3, 6 y 12 meses. Lo normal es que suba con el plazo; si los plazos cortos están por encima de
	los largos (curva invertida), el mercado tiene miedo ahora. Arriba, las cifras; debajo, la curva de hoy
	frente a la de hace un mes, con YieldCurve. Con el VVIX (la volatilidad del propio VIX) y el SKEW (lo que se
	paga por protegerse de una caída fuerte del S&P 500; 100 = nada especial, más de 140 = mucho).
-->
<script lang="ts">
	import { nf, period, signed } from '#lib/format.ts';
	import type { VixData } from '#lib/types.ts';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';
	import YieldCurve from './YieldCurve.svelte';

	let { curve }: { curve: VixData | undefined } = $props();

	const at = (tenor: string, back = 1) => {
		const i = curve?.tenors.indexOf(tenor) ?? -1;
		return i < 0 ? null : (curve?.days.at(-back)?.values[i] ?? null);
	};
	const today = $derived(curve?.days.at(-1));
	const vix = $derived(at('1M'));
	const change = $derived(vix !== null && at('1M', 2) !== null ? vix - at('1M', 2)! : null);
	const short = $derived(at('9D'));
	const three = $derived(at('3M'));
	// Curva invertida: el VIX por encima del de 3 meses.
	const inverted = $derived(vix !== null && three !== null ? vix > three : null);
	/** Cambio del día de VVIX o SKEW: en rojo si sube (más miedo). */
	const extra = (x: VixData['vvix']) => ({
		value: x ? nf(x.value, x.value >= 100 ? 1 : 2) : '—',
		tone: !x || x.previous === null || x.value === x.previous ? undefined : x.value > x.previous ? ('down' as const) : ('up' as const),
		sub: x && x.previous !== null ? signed(x.value - x.previous, 2) : ''
	});
	const vvix = $derived(extra(curve?.vvix));
	const skew = $derived(extra(curve?.skew));
</script>

{#if today && vix !== null}
	<Tiles cols={curve?.vvix || curve?.skew ? 5 : 3}>
		<Tile
			label="VIX"
			value={nf(vix, 2)}
			tone={change === null || change === 0 ? undefined : change > 0 ? 'down' : 'up'}
			sub="{period(today.date)}{change === null ? '' : ` · ${signed(change, 2)}`}"
		/>
		<Tile label="A 9 días" value={nf(short, 2)} sub="VIX9D" />
		<Tile
			label="Curva"
			value={inverted === null ? '—' : inverted ? 'Invertida' : 'Normal'}
			tone={inverted ? 'down' : undefined}
			sub={three === null ? '' : `3 meses: ${nf(three, 2)}`}
		/>
		{#if curve?.vvix || curve?.skew}
			<Tile label="VVIX" value={vvix.value} tone={vvix.tone} sub={vvix.sub} />
			<Tile label="SKEW" value={skew.value} tone={skew.tone} sub={skew.sub} />
		{/if}
	</Tiles>
	<YieldCurve {curve} points />
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}
