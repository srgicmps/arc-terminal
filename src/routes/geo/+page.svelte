<script lang="ts">
	import { resolve } from '$app/paths';
	import DefenseQuotes from '#lib/components/DefenseQuotes.svelte';
	import ClimatePanel from '#lib/components/ClimatePanel.svelte';
	import ChokepointTable from '#lib/components/ChokepointTable.svelte';
	import DisasterList from '#lib/components/DisasterList.svelte';
	import ElectionTable from '#lib/components/ElectionTable.svelte';
	import HazardList from '#lib/components/HazardList.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PredictionList from '#lib/components/PredictionList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import TradeList from '#lib/components/TradeList.svelte';
	import QuakeTable from '#lib/components/QuakeTable.svelte';
	import StormNotice from '#lib/components/StormNotice.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { LAYERS, type LayerId } from '#lib/geo/layers.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const quakes = $derived(data.quakes?.data ?? []);
	// Los más fuertes de la semana primero, y como mucho 20.
	const strongest = $derived([...quakes].sort((a, b) => b.mag - a.mag).slice(0, 20));
	// Capas del mapa (calculadas en +page.server.ts): todas las que tienen datos, encendidas al principio.
	const layerPoints = $derived(data.layers);
	const available = $derived(LAYERS.filter((l) => layerPoints[l.value].length));
	let on = $state<LayerId[]>(LAYERS.map((l) => l.value));
	const points = $derived(available.filter((l) => on.includes(l.value)).flatMap((l) => layerPoints[l.value]));

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="GEO" title="Geopolítica" sub={sources} />

<StormNotice data={data.swpc?.data} />

<div class="grid">
	<div class="col">
		<Panel title="Mapa" meta="Toca un punto para ver su ficha" pin="pin:geo:mapa">
			{#if available.length > 1}
				<div class="layers"><Seg label="Capas del mapa" options={available} bind:values={on} /></div>
			{/if}
			<WorldMap {points} legend={available} />
		</Panel>
	</div>
</div>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias">
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-geo" />{/snippet}
		</Panel>
		<ClimatePanel climate={data.climate} />
	</div>
	<div class="col">
		<Panel title="Mercados de predicción" meta="Probabilidad que da el mercado">
			<PredictionList items={data.predictions?.data.geopolitics.slice(0, 8) ?? []} />
			{#snippet note()}
				Precios de Polymarket: reflejan apuestas, no pronósticos oficiales · <Updated at={data.predictions?.fetchedAt} source="predictions" />
			{/snippet}
		</Panel>
		<DefenseQuotes />
		<Panel title="Rutas marítimas clave" meta="Barcos al día (media de 7 días) y cambio en 1 año">
			<ChokepointTable items={data.portwatch?.data ?? []} />
			{#snippet note()}
				Fuente: <a href="https://portwatch.imf.org" target="_blank" rel="noopener">IMF PortWatch</a> (FMI). Estimación a partir de AIS, unos 5 días de
				retraso · <Updated at={data.portwatch?.fetchedAt} source="portwatch" />
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
		<!-- Sin datos (en local, o si Wikidata falla sin copia anterior), el panel no sale. -->
		{#if data.elections?.data.items.length}
			<Panel title="Próximas elecciones" meta="90 días · G20 y UE en ámbar">
				<ElectionTable items={data.elections.data.items} />
				{#snippet note()}
					Datos de <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a>; pueden estar incompletos ·
					<Updated at={data.elections?.fetchedAt} source="elections" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Sanciones y aranceles de EE. UU." meta="OFAC, USTR e ITA" jump={{ code: 'USGOV', href: resolve('/usgov') }}>
			<TradeList items={data.sanctions?.data.slice(0, 8) ?? []} />
			{#snippet note()}Fuente: Federal Register · <Updated at={data.sanctions?.fetchedAt} source="sanctions" />{/snippet}
		</Panel>
		<Panel title="Organismos internacionales" meta="ONU y OMC · comunicados">
			<NewsList items={data.intl?.data.items.slice(0, 15) ?? []} />
			{#snippet note()}<Updated at={data.intl?.fetchedAt} source="news-intl" />{/snippet}
		</Panel>
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

<style>
	.layers {
		padding: var(--sp-8) var(--pad-x) 0;
	}
</style>
