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
	import { theme } from '#lib/theme.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.ecb));
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];

	// Resumen de mercados en directo (TradingView), con pestañas.
	// TradingView necesita los colores escritos (no entiende variables CSS): salen del tema activo.
	const palette = $derived(
		theme.resolved === 'light'
			? { up: '20, 115, 69', down: '195, 48, 60', grid: 'rgba(220, 216, 207, 1)', scale: 'rgba(91, 99, 110, 1)', amber: '154, 90, 0' }
			: { up: '76, 196, 138', down: '240, 100, 111', grid: 'rgba(29, 36, 45, 1)', scale: 'rgba(128, 138, 151, 1)', amber: '242, 168, 59' }
	);

	const overview = $derived({
		showChart: true,
		showSymbolLogo: false,
		showFloatingTooltip: true,
		plotLineColorGrowing: `rgba(${palette.up}, 1)`,
		plotLineColorFalling: `rgba(${palette.down}, 1)`,
		belowLineFillColorGrowing: `rgba(${palette.up}, 0.08)`,
		belowLineFillColorFalling: `rgba(${palette.down}, 0.08)`,
		gridLineColor: palette.grid,
		scaleFontColor: palette.scale,
		symbolActiveColor: `rgba(${palette.amber}, 0.13)`,
		tabs: [
			{
				title: 'Índices',
				symbols: [
					{ s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
					{ s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
					{ s: 'FOREXCOM:DJI', d: 'Dow Jones' },
					{ s: 'BME:IBC', d: 'IBEX 35' },
					{ s: 'XETR:DAX', d: 'DAX' },
					{ s: 'TVC:SX5E', d: 'Euro Stoxx 50' },
					{ s: 'TVC:NI225', d: 'Nikkei 225' }
				]
			},
			{
				title: 'Materias primas',
				symbols: [
					{ s: 'TVC:UKOIL', d: 'Brent' },
					{ s: 'TVC:USOIL', d: 'WTI' },
					{ s: 'TVC:GOLD', d: 'Oro' },
					{ s: 'TVC:SILVER', d: 'Plata' },
					{ s: 'COMEX:HG1!', d: 'Cobre' },
					{ s: 'NYMEX:NG1!', d: 'Gas natural' }
				]
			},
			{
				title: 'Bonos',
				symbols: [
					{ s: 'TVC:US10Y', d: 'EE. UU. 10 años' },
					{ s: 'TVC:US02Y', d: 'EE. UU. 2 años' },
					{ s: 'TVC:DE10Y', d: 'Alemania 10 años' },
					{ s: 'TVC:ES10Y', d: 'España 10 años' },
					{ s: 'TVC:IT10Y', d: 'Italia 10 años' }
				]
			},
			{
				title: 'Divisas',
				symbols: [
					{ s: 'FX:EURUSD', d: 'EUR/USD' },
					{ s: 'FX:GBPUSD', d: 'GBP/USD' },
					{ s: 'FX:USDJPY', d: 'USD/JPY' },
					{ s: 'TVC:DXY', d: 'Índice dólar' },
					{ s: 'BITSTAMP:BTCUSD', d: 'Bitcoin' }
				]
			}
		]
	});

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

<div class="grid grid-2">
	<div class="col">
		<Panel title="Mapa de calor" meta="S&P 500 · variación del día">
			<TvWidget widget="stock-heatmap" config={heatmap} height={520} />
		</Panel>
	</div>
	<div class="col">
		<Panel title="Mercados" meta="En directo">
			<TvWidget widget="market-overview" config={overview} height={520} />
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
