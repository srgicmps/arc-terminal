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
	// El widget pone los grupos uno debajo de otro, cada uno con su título: el alto cuenta todos los valores y
	// un título por grupo (como una fila más), para que no salga barra de desplazamiento.
	const height = quotesHeight(groups.reduce((n, g) => n + g.tickers.length + 1, 0));
</script>

<Panel title="Defensa" meta="EE. UU. y Europa · en directo">
	<TvWidget widget="market-quotes" {config} {height} />
	{#snippet note()}
		Privadas, sin cotización:
		{#each DEFENSE_PRIVATE as name, i (name)}{i ? ', ' : ''}<a href="{resolve('/news')}?q={encodeURIComponent(name)}">{name}</a>{/each}
		(titulares)
	{/snippet}
</Panel>
