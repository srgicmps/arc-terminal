<!--
	Módulo de TOP «Mercados»: cotizaciones en directo de TradingView (widget market-quotes, sin clave).
	Índices, Brent, oro y el bono de EE. UU. a 10 años. El widget se carga solo cuando se acerca a la vista.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '../Panel.svelte';
	import TvWidget from '../TvWidget.svelte';

	const config = {
		width: '100%',
		showSymbolLogo: false,
		symbolsGroups: [
			{
				name: 'Mercados',
				symbols: [
					{ name: 'FOREXCOM:SPXUSD', displayName: 'S&P 500' },
					{ name: 'FOREXCOM:NSXUSD', displayName: 'Nasdaq 100' },
					{ name: 'BME:IBC', displayName: 'IBEX 35' },
					{ name: 'TVC:SX5E', displayName: 'Euro Stoxx 50' },
					{ name: 'TVC:UKOIL', displayName: 'Brent' },
					{ name: 'TVC:GOLD', displayName: 'Oro' },
					{ name: 'TVC:US10Y', displayName: 'Bono EE. UU. 10 a' }
				]
			}
		]
	};
</script>

<Panel id="markets" title="Mercados" meta="En directo" jump={{ code: 'WS', href: resolve('/ws') }}>
	<TvWidget widget="market-quotes" {config} height={330} credit={false} />
</Panel>
