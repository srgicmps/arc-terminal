<script lang="ts">
	import DisasterList from '#lib/components/DisasterList.svelte';
	import HazardList from '#lib/components/HazardList.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PredictionList from '#lib/components/PredictionList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuakeTable from '#lib/components/QuakeTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const quakes = $derived(data.quakes?.data ?? []);
	// Los más fuertes de la semana primero, y como mucho 20.
	const strongest = $derived([...quakes].sort((a, b) => b.mag - a.mag).slice(0, 20));
	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="GEO" title="Geopolítica" sub={sources} />

<div class="grid">
	<div class="col">
		<Panel title="Mapa" meta="Últimos 7 días">
			<WorldMap quakes={quakes} storms={data.hazards?.data.storms} events={data.hazards?.data.events} />
		</Panel>
	</div>
</div>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias">
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-geo" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Mercados de predicción" meta="Probabilidad que da el mercado">
			<PredictionList items={data.predictions?.data.geopolitics.slice(0, 8) ?? []} />
			{#snippet note()}
				Precios de Polymarket: reflejan apuestas, no pronósticos oficiales · <Updated at={data.predictions?.fetchedAt} source="predictions" />
			{/snippet}
		</Panel>
		<!-- Hasta que ReliefWeb apruebe el appname (secreto RELIEFWEB_APPNAME) no hay datos: el panel no sale. -->
		{#if data.reliefweb}
			<Panel title="Crisis y desastres activos" meta="{data.reliefweb.data.length} abiertos · los 20 más recientes">
				<DisasterList items={data.reliefweb.data.slice(0, 20)} />
				{#snippet note()}
					Fuente: <a href="https://reliefweb.int/disasters" target="_blank" rel="noopener">ReliefWeb</a> (OCHA, ONU), que recoge
					informes de gobiernos, agencias de la ONU y ONG: cada ficha enlaza a sus fuentes originales · <Updated at={data.reliefweb?.fetchedAt} source="reliefweb" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Gobiernos e instituciones" meta="Comunicados oficiales">
			<NewsList items={data.gov?.data.items.slice(0, 15) ?? []} />
		</Panel>
		<Panel title="Terremotos en el mundo" meta="M4,5+ · últimos 7 días">
			<QuakeTable quakes={strongest} empty={data.quakes ? 'Sin terremotos fuertes estos días.' : undefined} />
			{#snippet note()}Fuente: USGS · <Updated at={data.quakes?.fetchedAt} source="quakes" />{/snippet}
		</Panel>
		<Panel title="Terremotos en España" meta="Últimos 10 días · los 15 más fuertes">
			<QuakeTable
				quakes={[...(data.quakesEs?.data ?? [])].sort((a, b) => b.mag - a.mag).slice(0, 15)}
				empty={data.quakesEs ? 'Sin terremotos en España en los últimos 10 días.' : undefined}
			/>
			{#snippet note()}Fuente: Instituto Geográfico Nacional · <Updated at={data.quakesEs?.fetchedAt} source="quakes-es" />{/snippet}
		</Panel>
		<Panel title="Huracanes, incendios y volcanes" meta="Activos ahora">
			{#if data.hazards}<HazardList hazards={data.hazards.data} />{:else}<p class="empty">Sin datos todavía.</p>{/if}
			{#snippet note()}Fuentes: NOAA (Centro Nacional de Huracanes) y NASA EONET · <Updated at={data.hazards?.fetchedAt} source="hazards" />{/snippet}
		</Panel>
	</div>
</div>
