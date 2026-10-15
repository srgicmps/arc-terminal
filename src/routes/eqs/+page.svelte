<!--
	EQS: buscador de acciones (widget «screener» de TradingView, sin clave). La bolsa, el punto de partida y las
	columnas van en la URL; los filtros finos, en la barra del propio widget. Opciones en src/lib/screener.ts.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { COLUMNS, isColumn, isMarket, isScreen, MARKETS, SCREENS, screenerConfig, type Column, type Market, type Screen } from '#lib/screener.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';

	const market = urlState<Market>('bolsa', 'america', isMarket);
	const screen = urlState<Screen>('lista', 'most_capitalized', isScreen);
	const column = urlState<Column>('columnas', 'overview', isColumn);

	const config = $derived(screenerConfig(market.value, screen.value, column.value));
	const label = (list: readonly { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;
</script>

<ViewHeader code="EQS" title="Buscador de acciones" sub="Filtra por sector, PER, dividendo o subida · TradingView, en directo" />

<div class="grid">
	<div class="col">
		<Panel title="Buscador de acciones" meta="{label(MARKETS, market.value)} · {label(SCREENS, screen.value)}">
			<div class="opts">
				<Seg label="Bolsa" options={MARKETS} bind:value={market.value} />
				<Seg label="Punto de partida" options={SCREENS} bind:value={screen.value} />
				<Seg label="Columnas" options={COLUMNS} bind:value={column.value} />
			</div>
			{#key config}
				<TvWidget widget="screener" {config} height={640} />
			{/key}
		</Panel>
	</div>
</div>

<style>
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8) var(--sp-16);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
