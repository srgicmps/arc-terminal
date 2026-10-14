<script lang="ts">
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { compact, period } from '#lib/format.ts';
	import { last, seriesMap, spread } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.eurostat, data.ecb, data.bls, data.usdebt));
	const geos = ['es', 'ea', 'de', 'fr', 'it', 'pt'];
	const byGeo = (id: string) => geos.map((g) => ({ series: get(`${id}-${g}`), inverse: id !== 'gdp' }));

	const premium = $derived(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo'));
	const debtUs = $derived(last(get('debt-us')));
</script>

<ViewHeader code="ECO" title="Economía y macro" sub="Eurostat, Banco Central Europeo, BLS y Tesoro de EE. UU." />

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
			{#snippet note()}Fuente: Eurostat · <Updated at={data.eurostat?.fetchedAt} />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="BCE" meta="Tipos y euríbor">
			<SeriesTable
				head="Tipo"
				rows={[
					{ series: get('ecb-dfr'), name: 'Facilidad de depósito', decimals: 2 },
					{ series: get('ecb-mro'), name: 'Refinanciación', decimals: 2 },
					{ series: get('estr'), name: '€STR', decimals: 3 },
					{ series: get('euribor-12m'), name: 'Euríbor 12 meses', decimals: 3 },
					{ series: get('hicp-ea'), name: 'Inflación zona euro', decimals: 1, inverse: true }
				]}
			/>
		</Panel>
		<Panel title="Bonos a 10 años" meta="Rentabilidad media mensual">
			<SeriesTable
				head="País"
				rows={[
					{ series: get('bond10-es'), decimals: 2 },
					{ series: get('bond10-de'), decimals: 2 },
					{ series: get('bond10-fr'), decimals: 2 },
					{ series: get('bond10-it'), decimals: 2 },
					{ series: premium, name: 'Prima España (pb)', decimals: 0, inverse: true }
				]}
			/>
			{#snippet note()}Fuente: BCE · <Updated at={data.ecb?.fetchedAt} />{/snippet}
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
			{#snippet note()}Fuentes: BLS y Tesoro de EE. UU. · <Updated at={data.bls?.fetchedAt} />{/snippet}
		</Panel>
		<Panel title="Titulares" meta="Economía">
			<NewsList items={data.news?.data.items.slice(0, 25) ?? []} />
		</Panel>
	</div>
</div>
