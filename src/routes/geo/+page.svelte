<script lang="ts">
	import HazardList from '#lib/components/HazardList.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuakeTable from '#lib/components/QuakeTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const quakes = $derived(data.quakes?.data ?? []);
	// Los más fuertes de la semana primero, y como mucho 20.
	const strongest = $derived([...quakes].sort((a, b) => b.mag - a.mag).slice(0, 20));
	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.count).map((f) => f.name).join(', '));
</script>

<ViewHeader code="GEO" title="Geopolítica" sub={sources} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias">
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Gobiernos e instituciones" meta="Comunicados oficiales">
			<NewsList items={data.gov?.data.items.slice(0, 15) ?? []} />
		</Panel>
		<Panel title="Terremotos en el mundo" meta="M4,5+ · últimos 7 días">
			<QuakeTable quakes={strongest} />
			{#snippet note()}Fuente: USGS · <Updated at={data.quakes?.fetchedAt} />{/snippet}
		</Panel>
		<Panel title="Terremotos en España" meta="Últimos 10 días · los 15 más fuertes">
			<QuakeTable quakes={[...(data.quakesEs?.data ?? [])].sort((a, b) => b.mag - a.mag).slice(0, 15)} />
			{#snippet note()}Fuente: Instituto Geográfico Nacional · <Updated at={data.quakesEs?.fetchedAt} />{/snippet}
		</Panel>
		<Panel title="Huracanes, incendios y volcanes" meta="Activos ahora">
			{#if data.hazards}<HazardList hazards={data.hazards.data} />{:else}<p class="empty">Sin datos todavía.</p>{/if}
			{#snippet note()}Fuentes: NOAA (Centro Nacional de Huracanes) y NASA EONET · <Updated at={data.hazards?.fetchedAt} />{/snippet}
		</Panel>
	</div>
</div>
