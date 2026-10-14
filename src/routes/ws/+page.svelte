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
	import { rgba, token } from '#lib/color.ts';
	import { theme } from '#lib/theme.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.ecb));
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];

	// Resumen de mercados en directo (TradingView), con pestañas.
	// TradingView necesita los colores escritos (no entiende variables CSS): se leen de los tokens del
	// tema activo y se recalculan al cambiar de tema.
	const overview = $derived.by(() => {
		void theme.resolved; // depende del tema: al cambiarlo se vuelve a calcular
		const up = token('--up');
		const down = token('--down');
		return {
			showChart: true,
			showSymbolLogo: false,
			showFloatingTooltip: true,
			plotLineColorGrowing: rgba(up),
			plotLineColorFalling: rgba(down),
			belowLineFillColorGrowing: rgba(up, 0.08),
			belowLineFillColorFalling: rgba(down, 0.08),
			gridLineColor: rgba(token('--line')),
			scaleFontColor: rgba(token('--muted')),
			symbolActiveColor: rgba(token('--amber-soft')),
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
		};
	});

	// Materias primas y bonos a 10 años del mundo (widget «market-quotes»). Símbolos de TradingView:
	// futuros continuos («1!») donde no hay índice de contado.
	const COMMODITIES = [
		{ name: 'TVC:UKOIL', displayName: 'Brent' },
		{ name: 'TVC:USOIL', displayName: 'WTI' },
		{ name: 'ICEEUR:TFM1!', displayName: 'Gas TTF (Europa)' },
		{ name: 'NYMEX:NG1!', displayName: 'Gas Henry Hub (EE. UU.)' },
		{ name: 'TVC:GOLD', displayName: 'Oro' },
		{ name: 'TVC:SILVER', displayName: 'Plata' },
		{ name: 'COMEX:HG1!', displayName: 'Cobre' },
		{ name: 'CBOT:ZW1!', displayName: 'Trigo' },
		{ name: 'CBOT:ZC1!', displayName: 'Maíz' }
	];
	const BONDS = [
		{ name: 'TVC:US10Y', displayName: 'EE. UU.' },
		{ name: 'TVC:DE10Y', displayName: 'Alemania' },
		{ name: 'TVC:GB10Y', displayName: 'Reino Unido' },
		{ name: 'TVC:JP10Y', displayName: 'Japón' },
		{ name: 'TVC:IT10Y', displayName: 'Italia' },
		{ name: 'TVC:ES10Y', displayName: 'España' },
		{ name: 'TVC:FR10Y', displayName: 'Francia' },
		{ name: 'TVC:CN10Y', displayName: 'China' }
	];
	const quotes = (name: string, symbols: { name: string; displayName: string }[]) => ({
		showSymbolLogo: false,
		symbolsGroups: [{ name, symbols }]
	});
	/** Alto para que quepan todas las filas sin barra de desplazamiento (como en MIS). */
	const quotesHeight = (n: number) => 90 + n * 46;

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
		<Panel title="Materias primas" meta="Futuros y contado · en directo">
			<TvWidget widget="market-quotes" config={quotes('Materias primas', COMMODITIES)} height={quotesHeight(COMMODITIES.length)} />
		</Panel>
		<Panel title="Bonos a 10 años" meta="Rentabilidad · en directo">
			<TvWidget widget="market-quotes" config={quotes('Bonos a 10 años', BONDS)} height={quotesHeight(BONDS.length)} />
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
