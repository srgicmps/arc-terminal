<script lang="ts">
	import CryptoTable from '#lib/components/CryptoTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import YieldCurve from '#lib/components/YieldCurve.svelte';
	import { seriesMap } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.ecb));
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];

	const heatmap = {
		dataSource: 'SPX500',
		grouping: 'sector',
		blockSize: 'market_cap_basic',
		blockColor: 'change',
		hasTopBar: false,
		isDataSetEnabled: false,
		isZoomEnabled: true,
		hasSymbolTooltip: true,
		isMonoSize: false
	};
</script>

<ViewHeader code="WS" title="Wall Street e inversión" sub="TradingView, Tesoro de EE. UU., BCE, CoinGecko y titulares de mercados" />

<div class="grid">
	<div class="col">
		<Panel title="Mapa de calor" meta="S&P 500 · variación del día">
			<TvWidget widget="stock-heatmap" config={heatmap} height={520} />
		</Panel>
	</div>
</div>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="Mercados">
			<NewsList items={data.news?.data.items ?? []} />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-ws" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Curva de tipos de EE. UU." meta="Hoy frente a hace un mes">
			{#if data.curve}<YieldCurve curve={data.curve.data} />{:else}<p class="empty">Sin datos todavía.</p>{/if}
			{#snippet note()}Fuente: Tesoro de EE. UU. · <Updated at={data.curve?.fetchedAt} source="uscurve" />{/snippet}
		</Panel>
		<Panel title="Divisas" meta="Cambio de referencia del BCE">
			<SeriesTable head="Par" spark={60} rows={fx.map((id) => ({ series: get(id), name: get(id)?.label, decimals: 4 }))} />
		</Panel>
		<Panel title="Cripto" meta="Por capitalización">
			<CryptoTable coins={data.crypto?.data.coins ?? []} />
			{#snippet note()}Fuente: CoinGecko · <Updated at={data.crypto?.fetchedAt} source="crypto" />{/snippet}
		</Panel>
	</div>
</div>
