<!--
	Valores de defensa y geopolítica (src/lib/defense.ts) con el widget market-quotes de TradingView, en un panel.
	Lo usan WS y GEO. Debajo, las empresas que no cotizan, con enlace a sus titulares.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from './Panel.svelte';
	import TvWidget from './TvWidget.svelte';
	import { DEFENSE_PRIVATE, defenseGroups } from '#lib/defense.ts';
	import { quotesHeight } from '#lib/tickers.ts';

	const groups = defenseGroups();
	const config = {
		showSymbolLogo: false,
		symbolsGroups: groups.map((g) => ({
			name: g.name,
			symbols: g.tickers.map((t) => ({ name: t.tv, displayName: t.name }))
		}))
	};
	// Alto para la pestaña más larga, sin barra de desplazamiento (como en MIS).
	const height = quotesHeight(Math.max(...groups.map((g) => g.tickers.length)));
</script>

<Panel title="Defensa" meta="EE. UU. y Europa · en directo">
	<TvWidget widget="market-quotes" {config} {height} />
	{#snippet note()}
		Privadas, sin cotización:
		{#each DEFENSE_PRIVATE as name, i (name)}{i ? ', ' : ''}<a href="{resolve('/news')}?q={encodeURIComponent(name)}">{name}</a>{/each}
		(titulares)
	{/snippet}
</Panel>
