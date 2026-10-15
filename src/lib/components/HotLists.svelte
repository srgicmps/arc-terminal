<!--
	Los valores que más suben, más bajan y más se negocian hoy (widget «hotlists» de TradingView, sin clave).
	Sin gráfico (showChart: false) para que quede una lista densa. Un selector cambia de bolsa; con `exchange`,
	la bolsa queda fija y no sale el selector (MOST pone las tres una al lado de otra).
-->
<script lang="ts">
	import { rgba, token } from '#lib/color.ts';
	import { paint } from '#lib/tvpaint.svelte.ts';
	import TvWidget from './TvWidget.svelte';
	import Seg from './ui/Seg.svelte';

	interface Props {
		height?: number;
		/** Bolsa fija, sin selector. */
		exchange?: Exchange;
	}

	// «exchange» del widget: US junta NYSE, Nasdaq y AMEX; XETR es Xetra (Alemania) y BME, la bolsa española.
	const EXCHANGES = [
		{ value: 'US', label: 'EE. UU.' },
		{ value: 'XETR', label: 'Alemania' },
		{ value: 'BME', label: 'España' }
	] as const;
	type Exchange = (typeof EXCHANGES)[number]['value'];

	let { height = 420, exchange: fixed }: Props = $props();
	// svelte-ignore state_referenced_locally
	let exchange = $state<Exchange>(fixed ?? 'US');

	// TradingView necesita los colores escritos: se leen de los tokens del tema activo.
	const config = $derived.by(() => {
		void paint.n;
		return {
			exchange,
			dateRange: '1D',
			showChart: false,
			showSymbolLogo: false,
			showFloatingTooltip: false,
			symbolActiveColor: rgba(token('--amber-soft')),
			scaleFontColor: rgba(token('--muted'))
		};
	});
</script>

{#if !fixed}
	<div class="hot">
		<Seg label="Bolsa" options={EXCHANGES} bind:value={exchange} />
	</div>
{/if}
<TvWidget widget="hotlists" {config} {height} />

<style>
	/* Selector encima del widget, con el espaciado de la cabecera del panel. */
	.hot {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
