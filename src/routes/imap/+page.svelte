<!--
	IMAP: mapas de calor de TradingView de más índices y países que en WS, los sectores de EE. UU. y un índice
	por país. Los mapas y los símbolos están en src/lib/heatmaps.ts.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { HEATMAPS, heatmapConfig, isHeatMap, SECTORS, WORLD } from '#lib/heatmaps.ts';
	import { quotesHeight } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';

	// El mapa va en la URL (/imap?mapa=it), para compartirlo.
	const sel = urlState<string>('mapa', 'spx', isHeatMap);
	const map = $derived(HEATMAPS.find((m) => m.key === sel.value) ?? HEATMAPS[0]);

	const quotes = (name: string, symbols: { name: string; displayName: string }[]) => ({ showSymbolLogo: false, symbolsGroups: [{ name, symbols }] });
</script>

<ViewHeader code="IMAP" title="Mapas de calor" sub="Índices, países y sectores · TradingView, en directo" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Mapa de calor" meta="{map.label}{map.kind === 'country' ? ' · todas' : ''} · variación del día">
			<div class="maps">
				<Seg label="Mapa de calor" options={HEATMAPS.map((m) => ({ value: m.key, label: m.label }))} bind:value={sel.value} />
			</div>
			<TvWidget widget="stock-heatmap" config={heatmapConfig(map)} height={600} />
			{#snippet note()}
				Índices y, por país, todas sus acciones cotizadas. TradingView no da el mapa de Francia, Reino Unido ni Japón:
				están en «Bolsas del mundo».
			{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Sectores de EE. UU." meta="Fondos Select Sector SPDR · en directo">
			<TvWidget widget="market-quotes" config={quotes('Sectores', SECTORS)} height={quotesHeight(SECTORS.length)} />
		</Panel>
		<Panel title="Bolsas del mundo" meta="Un índice por país · en directo">
			<TvWidget widget="market-quotes" config={quotes('Bolsas', WORLD)} height={quotesHeight(WORLD.length)} />
		</Panel>
	</div>
</div>

<style>
	.maps {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
