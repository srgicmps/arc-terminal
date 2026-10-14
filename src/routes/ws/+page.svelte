<script lang="ts">
	import { resolve } from '$app/paths';
	import AuctionList from '#lib/components/AuctionList.svelte';
	import CryptoTable from '#lib/components/CryptoTable.svelte';
	import DefenseQuotes from '#lib/components/DefenseQuotes.svelte';
	import FxConvert from '#lib/components/FxConvert.svelte';
	import FxTable from '#lib/components/FxTable.svelte';
	import HotLists from '#lib/components/HotLists.svelte';
	import MarketSessions from '#lib/components/MarketSessions.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import StablecoinTable from '#lib/components/StablecoinTable.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { dm, nf } from '#lib/format.ts';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import RiskGauge from '#lib/components/RiskGauge.svelte';
	import VixCurve from '#lib/components/VixCurve.svelte';
	import YieldCurve from '#lib/components/YieldCurve.svelte';
	import { seriesMap } from '#lib/series.ts';
	import { quotesHeight } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
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

	// Mapas de calor de TradingView: acciones de un índice («stock-heatmap»), cripto («crypto-coins-heatmap»)
	// o divisas («forex-heat-map»: cada casilla es la variación del día de un par).
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
		{ key: 'crypto', label: 'Cripto', widget: 'crypto-coins-heatmap', config: { ...common, dataSource: 'Crypto', blockSize: 'market_cap_calc' } },
		{ key: 'fx', label: 'Divisas', widget: 'forex-heat-map', config: { currencies: ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CNY', 'AUD', 'CAD', 'MXN'] } }
	] as const;

	// El mapa elegido va en la URL (/ws?mapa=dax), para compartirlo o guardarlo en favoritos. Sin parámetro, el
	// último elegido en este navegador (si no deja guardar, se queda en memoria).
	const MAP_KEY = 'arc-ws-heatmap';
	type MapKey = (typeof MAPS)[number]['key'];
	const isMap = (v: string) => MAPS.some((m) => m.key === v);
	const mapSel = urlState<MapKey>('mapa', 'spx', isMap);
	let loadedMap = $state(false);
	// Una vez, al abrir: si la URL no dice qué mapa, el guardado.
	$effect(() => {
		try {
			const saved = localStorage.getItem(MAP_KEY);
			if (saved && isMap(saved) && !new URLSearchParams(location.search).has('mapa')) mapSel.value = saved as MapKey;
		} catch {}
		loadedMap = true;
	});
	// Guarda cada cambio, después de haber leído lo guardado (para no pisarlo al arrancar).
	$effect(() => {
		const key = mapSel.value;
		if (!loadedMap) return;
		try {
			localStorage.setItem(MAP_KEY, key);
		} catch {}
	});
	const map = $derived(MAPS.find((m) => m.key === mapSel.value) ?? MAPS[0]);
</script>

<ViewHeader code="WS" title="Wall Street e inversión" sub="TradingView, Tesoro de EE. UU., BCE, CoinGecko y titulares de mercados" />

<div class="grid">
	<div class="col">
		<Panel title="Sesiones de las bolsas" meta="24 h · hora de Madrid">
			<MarketSessions />
			{#snippet note()}Sesión continua de cada bolsa. Festivos de Nueva York, Londres, Madrid, Fráncfort y São Paulo; en Asia, de momento, solo los fines de semana.{/snippet}
		</Panel>
	</div>
</div>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Mapa de calor" meta="{map.label} · variación del día">
			<div class="maps">
				<Seg label="Mapa de calor" options={MAPS.map((m) => ({ value: m.key, label: m.label }))} bind:value={mapSel.value} />
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
		<DefenseQuotes />
	</div>
</div>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Los que más se mueven" meta="Suben, bajan y más negociados · hoy">
			<HotLists />
		</Panel>
		<Panel title="Titulares" meta="Mercados" jump={{ code: 'NEWS', href: `${resolve('/news')}?s=ws` }}>
			<NewsList items={data.news?.data.items ?? []} />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-ws" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<RiskGauge risk={data.risk} />
		<Panel title="VIX y su curva" meta="Volatilidad esperada del S&P 500 · por plazo">
			<VixCurve curve={data.vix?.data} />
			{#snippet note()}
				Lo normal es que suba con el plazo; invertida (lo corto por encima del de 3 meses), el mercado teme algo inmediato.
				VVIX: la volatilidad del propio VIX. SKEW: lo que se paga por protegerse de una caída fuerte (100 es lo neutro).
				Fuente: Cboe · <Updated at={data.vix?.fetchedAt} source="vix" />
			{/snippet}
		</Panel>
		<Panel title="Curvas de tipos" meta="EE. UU., zona euro y Japón · hoy y hace un año">
			<YieldCurve
				curves={[
					{ label: 'EE. UU.', curve: data.curve?.data },
					{ label: 'Zona euro (AAA)', curve: data.eacurve?.data },
					{ label: 'Japón', curve: data.jgb?.data }
				]}
			/>
			{#snippet note()}
				Tesoro de EE. UU. · <Updated at={data.curve?.fetchedAt} source="uscurve" /> — BCE ·
				<Updated at={data.eacurve?.fetchedAt} source="eacurve" /> — Ministerio de Finanzas de Japón ·
				<Updated at={data.jgb?.fetchedAt} source="jgb" />
			{/snippet}
		</Panel>
		<Panel title="Divisas" meta="Frente al euro · cambio de referencia del BCE">
			<FxTable rows={fx.map((id) => ({ series: get(id), week: data.fxChange[id]?.week ?? null, year: data.fxChange[id]?.year ?? null }))} />
			{#snippet note()}Si el par sube, el euro se aprecia frente a esa moneda · <Updated at={data.ecb?.fetchedAt} source="ecb" />{/snippet}
		</Panel>
		<Panel title="Conversor" meta="Tipos de referencia del BCE">
			<FxConvert series={fx.map(get)} />
			{#snippet note()}Tipo de referencia del BCE, no de cambio en ventanilla · <Updated at={data.ecb?.fetchedAt} source="ecb" />{/snippet}
		</Panel>
		<Panel title="Cripto" meta="Por capitalización">
			<CryptoTable coins={data.crypto?.data.coins ?? []} />
			{#snippet note()}Fuente: CoinGecko · <Updated at={data.crypto?.fetchedAt} source="crypto" />{/snippet}
		</Panel>
		<Panel title="Stablecoins" meta="Monedas ligadas al dólar · en circulación">
			<StablecoinTable data={data.stables?.data} />
			{#snippet note()}
				«Dinero»: respaldadas con dólares y deuda pública; «cripto»: con otras criptomonedas. En ámbar, el precio que se
				separa medio céntimo o más del dólar. Fuente: DefiLlama · <Updated at={data.stables?.fetchedAt} source="stablecoins" />
			{/snippet}
		</Panel>
		<Panel title="Subastas del Tesoro" meta="EE. UU. · próximas y resultados de bonos y notas">
			{#if data.auctions}<AuctionList data={data.auctions.data} />{:else}<p class="empty">Sin datos todavía.</p>{/if}
			{#snippet note()}
				B/C (bid-to-cover): demanda frente a lo adjudicado; en ámbar, por debajo de la media de sus 6 subastas anteriores ·
				Fuente: Tesoro de EE. UU. · <Updated at={data.auctions?.fetchedAt} source="auctions" />
			{/snippet}
		</Panel>
		{#if data.cot}
			{@const cot = data.cot}
			<Panel title="Posicionamiento" meta="Especuladores en futuros · COT de la CFTC">
				<Table>
					<thead><tr><th class="l">Mercado</th><th>Neto</th><th>% abierto</th><th>Semana</th><th>Rango 1 año</th></tr></thead>
					<tbody>
						{#each cot.data.markets as m (m.code)}
							<tr>
								<td class="l name">{m.name}</td>
								<td class={m.net >= 0 ? 'up' : 'down'}>{nf(m.net, 0)}</td>
								<td class="mut">{nf(m.pctOi, 1)} %</td>
								<td><Change value={m.change} digits={0} /></td>
								<td class="mut">{m.range === null ? '—' : `${m.range} %`}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					Contratos netos (largos − cortos) de los no comerciales. Rango: 0 % = la posición más corta del último año,
					100 % = la más larga. Informe del {dm(`${cot.data.date}T12:00:00Z`)} (sale los viernes). Fuente:
					<a href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" target="_blank" rel="noopener">CFTC</a> ·
					<Updated at={cot.fetchedAt} source="cot" />
				{/snippet}
			</Panel>
		{/if}
	</div>
</div>

<style>
	/* Selector de mapa encima del widget, con el espaciado de la cabecera del panel. */
	.maps {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
