<script lang="ts">
	import { resolve } from '$app/paths';
	import BalanceSheets from '#lib/components/BalanceSheets.svelte';
	import ImfTable from '#lib/components/ImfTable.svelte';
	import MortgageCalc from '#lib/components/MortgageCalc.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import MeetingList from '#lib/components/MeetingList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import PredictionList from '#lib/components/PredictionList.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { compact, period } from '#lib/format.ts';
	import { last, seriesMap, spread } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.eurostat, data.ecb, data.bls, data.usdebt, data.fred));
	const geos = ['es', 'ea', 'de', 'fr', 'it', 'pt'];
	const byGeo = (id: string) => geos.map((g) => ({ series: get(`${id}-${g}`), inverse: id !== 'gdp' }));

	// Primas de riesgo: diferencia con el bono alemán a 10 años, en puntos básicos.
	const PREMIUMS = [
		{ geo: 'es', name: 'España' },
		{ geo: 'it', name: 'Italia' },
		{ geo: 'fr', name: 'Francia' },
		{ geo: 'pt', name: 'Portugal' },
		{ geo: 'gr', name: 'Grecia' }
	];
	const premiums = $derived(
		PREMIUMS.map((p) => ({
			series: spread(get(`bond10-${p.geo}`), get('bond10-de'), `premium-${p.geo}`, `Prima de ${p.name}`),
			name: p.name,
			decimals: 0,
			inverse: true
		}))
	);
	const debtUs = $derived(last(get('debt-us')));
</script>

<ViewHeader code="ECO" title="Economía y macro" sub="Eurostat, Banco Central Europeo, BLS, Tesoro de EE. UU. y FRED" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Paro" meta="% de la población activa">
			<SeriesTable head="País" rows={byGeo('unemployment')} />
		</Panel>
		<Panel title="Inflación" meta="IPCA, variación anual">
			<SeriesTable head="País" rows={byGeo('inflation')} />
		</Panel>
		<Panel title="PIB" meta="Variación trimestral">
			<SeriesTable head="País" rows={byGeo('gdp')} />
		</Panel>
		<Panel title="Paro juvenil" meta="Menores de 25 años">
			<SeriesTable head="País" rows={byGeo('youth-unemployment')} />
		</Panel>
		<Panel title="Deuda pública" meta="% del PIB">
			<SeriesTable head="País" rows={byGeo('debt')} />
			{#snippet note()}Fuente: Eurostat · <Updated at={data.eurostat?.fetchedAt} source="eurostat" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Próximas reuniones" meta="Decisión de tipos · hora de España" jump={{ code: 'CAL', href: resolve('/cal') }}>
			<MeetingList
				markets={[
					...(data.predictions?.data.rates ?? []),
					...(data.predictions?.data.economy ?? []),
					...(data.predictions?.data.geopolitics ?? [])
				]}
			/>
			{#snippet note()}Calendarios oficiales del BCE y de la Fed. Probabilidades: Polymarket, apuestas y no pronósticos.{/snippet}
		</Panel>
		<Panel title="BCE" meta="Tipos y euríbor">
			<SeriesTable
				head="Tipo"
				rows={[
					{ series: get('ecb-dfr'), name: 'Facilidad de depósito', decimals: 2 },
					{ series: get('ecb-mro'), name: 'Refinanciación', decimals: 2 },
					{ series: get('estr'), name: '€STR', decimals: 3 },
					{ series: get('euribor-12m'), name: 'Euríbor 12 meses', decimals: 3 },
					{ series: get('mortgage-es'), name: 'Hipotecas nuevas España', decimals: 2, inverse: true },
					{ series: get('mortgage-ea'), name: 'Hipotecas nuevas zona euro', decimals: 2, inverse: true },
					{ series: get('hicp-ea'), name: 'Inflación zona euro', decimals: 1, inverse: true }
				]}
			/>
		</Panel>
		<Panel title="Tu hipoteca" meta="Variable · euríbor a 12 meses">
			<MortgageCalc euribor={get('euribor-12m')} />
			{#snippet note()}Cuota con el último euríbor mensual del BCE más tu diferencial. Se calcula y se guarda solo en este navegador.{/snippet}
		</Panel>
		{#if data.imf?.data.rows.length}
			{@const imf = data.imf}
			<Panel title="Previsiones del FMI" meta="PIB real e inflación media · %">
				<ImfTable data={imf.data} />
				{#snippet note()}
					Fuente: FMI, World Economic Outlook ({imf.data.edition ?? 'WEO'}) ·
					<Updated at={imf.fetchedAt} source="imf" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Bancos centrales" meta="Tipo oficial · último cambio">
			<SeriesTable
				head="Banco"
				rows={(data.bis?.data.series ?? []).map((series) => ({ series, name: series.label, decimals: 2 }))}
			/>
			{#snippet note()}Fuente: BIS, tipos oficiales de los bancos centrales · <Updated at={data.bis?.fetchedAt} />{/snippet}
		</Panel>
		<Panel title="Balances de los bancos centrales" meta="Total del activo · semanal">
			<BalanceSheets
				rows={[
					{ name: 'BCE (Eurosistema)', series: get('ecb-balance'), currency: '€' },
					{ name: 'Reserva Federal', series: get('fed-balance'), currency: '$' }
				]}
			/>
			{#snippet note()}
				Sube cuando el banco central compra deuda (QE, expansión cuantitativa) y baja cuando la deja vencer o la vende (QT).
				Fuentes: BCE · <Updated at={data.ecb?.fetchedAt} source="ecb" /> y FRED · <Updated at={data.fred?.fetchedAt} source="fred" />
			{/snippet}
		</Panel>
		<Panel title="Bonos a 10 años" meta="Rentabilidad media mensual">
			<SeriesTable
				head="País"
				rows={[
					{ series: get('bond10-es'), decimals: 2 },
					{ series: get('bond10-de'), decimals: 2 },
					{ series: get('bond10-fr'), decimals: 2 },
					{ series: get('bond10-it'), decimals: 2 },
					{ series: get('bond10-pt'), decimals: 2 },
					{ series: get('bond10-gr'), name: 'Grecia', decimals: 2 }
				]}
			/>
			{#snippet note()}Fuente: BCE · <Updated at={data.ecb?.fetchedAt} source="ecb" />{/snippet}
		</Panel>
		<Panel title="Primas de riesgo" meta="Frente al bono alemán · pb">
			<SeriesTable head="País" rows={premiums} spark={12} />
			{#snippet note()}Diferencia de rentabilidad a 10 años con Alemania, media mensual. Fuente: BCE{/snippet}
		</Panel>
		<Panel title="EE. UU." meta="BLS y Tesoro">
			<SeriesTable
				head="Indicador"
				rows={[
					{ series: get('cpi-us'), name: 'Inflación (IPC)', inverse: true },
					{ series: get('core-cpi-us'), name: 'Inflación subyacente', inverse: true },
					{ series: get('unemployment-us'), name: 'Paro', inverse: true },
					{ series: get('payrolls-us'), name: 'Empleo creado (miles)', decimals: 0 }
				]}
			/>
			{#if debtUs}
				<ul class="mini">
					<li>
						<span class="l">Deuda pública total<small>{period(debtUs.t)}</small></span>
						<b>{compact(debtUs.v)} $</b>
					</li>
				</ul>
			{/if}
			{#snippet note()}Fuentes: BLS y Tesoro de EE. UU. · <Updated at={data.bls?.fetchedAt} source="bls" />{/snippet}
		</Panel>
		<Panel title="Fed y mercados" meta="EE. UU. · FRED">
			{#if data.fred}
				<SeriesTable
					head="Indicador"
					rows={[
						{ series: get('fedfunds-us'), name: 'Fondos federales', decimals: 2 },
						{ series: get('t10y2y-us'), name: 'Diferencial 10 a − 2 a', decimals: 2 },
						{ series: get('core-pce-us'), name: 'PCE subyacente, interanual', inverse: true },
						{ series: get('gdp-us'), name: 'PIB real, anualizado' },
						{ series: get('claims-us'), name: 'Peticiones de paro (miles)', decimals: 0, inverse: true },
						{ series: get('m2-us'), name: 'M2, interanual' },
						{ series: get('vix'), name: 'VIX', decimals: 1, inverse: true },
						{ series: get('wti'), name: 'Petróleo WTI ($)', decimals: 2 },
						{ series: get('dollar-broad'), name: 'Dólar, índice amplio', decimals: 1 }
					]}
				/>
			{:else}
				<p class="empty">{data.fredMissing}</p>
			{/if}
			{#snippet note()}
				Fuente: FRED, Fed de San Luis (usa su API sin estar respaldado por ella)
				{#if data.fred}· <Updated at={data.fred.fetchedAt} source="fred" />{/if}
			{/snippet}
		</Panel>
		{#if data.predictions?.data.economy.length}
			<Panel title="Lo que descuenta el mercado" meta="Polymarket">
				<PredictionList items={data.predictions.data.economy.slice(0, 6)} />
				{#snippet note()}Precios de mercados de predicción: reflejan apuestas, no pronósticos oficiales.{/snippet}
			</Panel>
		{/if}
		<Panel title="Titulares" meta="Economía">
			<NewsList items={data.news?.data.items.slice(0, 25) ?? []} />
		</Panel>
	</div>
</div>
