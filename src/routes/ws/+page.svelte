<script lang="ts">
	import CryptoTable from '#lib/components/CryptoTable.svelte';
	import FxConvert from '#lib/components/FxConvert.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
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
						// TVC:SX5E y TVC:NI225 salen vacíos en los widgets: van los CFD de OANDA (comprobado con tv-shots).
						{ s: 'OANDA:EU50EUR', d: 'Euro Stoxx 50' },
						{ s: 'OANDA:JP225USD', d: 'Nikkei 225' }
					]
				},
				{
					title: 'Materias primas',
					symbols: [
						{ s: 'TVC:UKOIL', d: 'Brent' },
						{ s: 'TVC:USOIL', d: 'WTI' },
						{ s: 'TVC:GOLD', d: 'Oro' },
						{ s: 'TVC:SILVER', d: 'Plata' },
						{ s: 'OANDA:XCUUSD', d: 'Cobre' },
						{ s: 'OANDA:NATGASUSD', d: 'Gas natural' }
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

	// Materias primas (widget «market-quotes»). Solo símbolos que TradingView sirve en sus widgets: los
	// futuros (ICE, NYMEX, COMEX, CBOT) salen vacíos, así que el gas, el cobre y los cereales van con los
	// CFD de OANDA. Comprobado en la Action con scripts/tv-shots.ts. El gas TTF europeo no tiene ninguno.
	const COMMODITIES = [
		{ name: 'TVC:UKOIL', displayName: 'Brent' },
		{ name: 'TVC:USOIL', displayName: 'WTI' },
		{ name: 'OANDA:NATGASUSD', displayName: 'Gas natural (Henry Hub)' },
		{ name: 'TVC:GOLD', displayName: 'Oro' },
		{ name: 'TVC:SILVER', displayName: 'Plata' },
		{ name: 'OANDA:XCUUSD', displayName: 'Cobre' },
		{ name: 'OANDA:WHEATUSD', displayName: 'Trigo' },
		{ name: 'OANDA:CORNUSD', displayName: 'Maíz' }
	];
	const quotes = (name: string, symbols: { name: string; displayName: string }[]) => ({
		showSymbolLogo: false,
		symbolsGroups: [{ name, symbols }]
	});
	/** Alto para que quepan todas las filas sin barra de desplazamiento (como en MIS). */
	const quotesHeight = (n: number) => 90 + n * 46;

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
	] as const;

	// El mapa elegido se recuerda en este navegador (si no deja guardar, se queda en memoria).
	const MAP_KEY = 'arc-ws-heatmap';
	type MapKey = (typeof MAPS)[number]['key'];
	let loadedMap = $state(false);
	let mapKey = $state<MapKey>('spx');
	$effect(() => {
		try {
			const saved = localStorage.getItem(MAP_KEY);
			const found = MAPS.find((m) => m.key === saved);
			if (found) mapKey = found.key;
		} catch {}
		loadedMap = true;
	});
	// Guarda cada cambio, después de haber leído lo guardado (para no pisarlo al arrancar).
	$effect(() => {
		const key = mapKey;
		if (!loadedMap) return;
		try {
			localStorage.setItem(MAP_KEY, key);
		} catch {}
	});
	const map = $derived(MAPS.find((m) => m.key === mapKey) ?? MAPS[0]);
</script>

<ViewHeader code="WS" title="Wall Street e inversión" sub="TradingView, Tesoro de EE. UU., BCE, CoinGecko y titulares de mercados" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Mapa de calor" meta="{map.label} · variación del día">
			<div class="maps">
				<Seg label="Mapa de calor" options={MAPS.map((m) => ({ value: m.key, label: m.label }))} bind:value={mapKey} />
			</div>
			<TvWidget widget={map.widget} config={map.config} height={520} />
		</Panel>
	</div>
	<div class="col">
		<Panel title="Mercados" meta="En directo">
			<TvWidget widget="market-overview" config={overview} height={520} />
		</Panel>
		<Panel title="Materias primas" meta="Precio en dólares · en directo">
			<TvWidget widget="market-quotes" config={quotes('Materias primas', COMMODITIES)} height={quotesHeight(COMMODITIES.length)} />
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
		<Panel title="Conversor" meta="Tipos de referencia del BCE">
			<FxConvert series={fx.map(get)} />
			{#snippet note()}Tipo de referencia del BCE, no de cambio en ventanilla · <Updated at={data.ecb?.fetchedAt} source="ecb" />{/snippet}
		</Panel>
		<Panel title="Cripto" meta="Por capitalización">
			<CryptoTable coins={data.crypto?.data.coins ?? []} />
			{#snippet note()}Fuente: CoinGecko · <Updated at={data.crypto?.fetchedAt} source="crypto" />{/snippet}
		</Panel>
	</div>
</div>

<style>
	/* Selector de mapa encima del widget, con el espaciado de la cabecera del panel. */
	.maps {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
