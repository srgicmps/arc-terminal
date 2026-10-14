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

	// Mapas de calor de TradingView: acciones de un índice (widget «stock-heatmap») o cripto («crypto-coins-heatmap»).
	const common = {
		blockColor: 'change',
		hasTopBar: false,
		isDataSetEnabled: false,
		isZoomEnabled: true,
		hasSymbolTooltip: true,
		isMonoSize: false
	};
	const stocks = (dataSource: string) => ({ ...common, dataSource, grouping: 'sector', blockSize: 'market_cap_basic' });
	const MAPS = [
		{ key: 'spx', label: 'S&P 500', widget: 'stock-heatmap', config: stocks('SPX500') },
		{ key: 'ndx', label: 'Nasdaq 100', widget: 'stock-heatmap', config: stocks('NASDAQ100') },
		{ key: 'dax', label: 'DAX', widget: 'stock-heatmap', config: stocks('DAX') },
		{ key: 'ibex', label: 'IBEX 35', widget: 'stock-heatmap', config: stocks('IBEX35') },
		{ key: 'crypto', label: 'Cripto', widget: 'crypto-coins-heatmap', config: { ...common, dataSource: 'Crypto', blockSize: 'market_cap_calc' } }
	];

	// El mapa elegido se recuerda en este navegador (si no deja guardar, se queda en memoria).
	const MAP_KEY = 'arc-ws-heatmap';
	let mapKey = $state('spx');
	$effect(() => {
		try {
			const saved = localStorage.getItem(MAP_KEY);
			if (MAPS.some((m) => m.key === saved)) mapKey = saved!;
		} catch {}
	});
	function chooseMap(key: string) {
		mapKey = key;
		try {
			localStorage.setItem(MAP_KEY, key);
		} catch {}
	}
	const map = $derived(MAPS.find((m) => m.key === mapKey) ?? MAPS[0]);
</script>

<ViewHeader code="WS" title="Wall Street e inversión" sub="TradingView, Tesoro de EE. UU., BCE, CoinGecko y titulares de mercados" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Mapa de calor" meta="{map.label} · variación del día">
			<div class="ph maps" role="group" aria-label="Mapa de calor">
				{#each MAPS as m (m.key)}
					<button type="button" aria-pressed={m.key === mapKey} onclick={() => chooseMap(m.key)}>{m.label}</button>
				{/each}
			</div>
			<TvWidget widget={map.widget} config={map.config} height={520} />
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

<style>
	/* Selector de mapa: fila con el mismo espaciado que la cabecera del panel (.ph) y botones de texto. */
	.maps {
		justify-content: flex-start;
	}

	.maps button {
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: 0.06em;
		cursor: pointer;
	}

	.maps button:hover {
		color: var(--fg);
	}

	.maps button[aria-pressed='true'] {
		color: var(--amber);
	}
</style>
