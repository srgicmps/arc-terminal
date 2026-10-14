<!--
	Los valores que más suben, más bajan y más se negocian hoy (widget «hotlists» de TradingView, sin clave).
	Sin gráfico (showChart: false) para que quede una lista densa. Un selector cambia de bolsa.
-->
<script lang="ts">
	import { rgba, token } from '#lib/color.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import TvWidget from './TvWidget.svelte';
	import Seg from './ui/Seg.svelte';

	interface Props {
		height?: number;
	}

	let { height = 420 }: Props = $props();

	// «exchange» del widget: US junta NYSE, Nasdaq y AMEX; XETR es Xetra (Alemania) y BME, la bolsa española.
	const EXCHANGES = [
		{ value: 'US', label: 'EE. UU.' },
		{ value: 'XETR', label: 'Alemania' },
		{ value: 'BME', label: 'España' }
	] as const;
	type Exchange = (typeof EXCHANGES)[number]['value'];

	let exchange = $state<Exchange>('US');

	// TradingView necesita los colores escritos: se leen de los tokens del tema activo.
	const config = $derived.by(() => {
		void theme.resolved;
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

<div class="hot">
	<Seg label="Bolsa" options={EXCHANGES} bind:value={exchange} />
</div>
<TvWidget widget="hotlists" {config} {height} />

<style>
	/* Selector encima del widget, con el espaciado de la cabecera del panel. */
	.hot {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
