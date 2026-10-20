<script lang="ts">
	import LineChart from '#lib/components/LineChart.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Bar from '#lib/components/ui/Bar.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { dm, nf, signed } from '#lib/format.ts';
	import { LAND_HREF } from '#lib/geo/land.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const w = $derived(data.water?.data);
	const lines = $derived(w ? [{ label: 'Reserva', color: '--amber', points: w.history }] : []);

	// Mapa de sequía de Europa: la capa CDI del European Drought Observatory (Copernicus) por WMS, encima
	// del contorno de la tierra. Proyección equirrectangular, como el mapa de GEO: x = longitud + 180, y = 90 − latitud.
	const BBOX = { west: -25, south: 34, east: 45, north: 72 };
	const WMS = 'https://drought.emergency.copernicus.eu/api/wms';
	const cdi =
		`${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=cdiad&STYLES=&SRS=EPSG:4326` +
		`&BBOX=${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}&WIDTH=700&HEIGHT=380&FORMAT=image/png&TRANSPARENT=true`;
	const legend = `${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=cdiad&FORMAT=image/png`;
	const view = `${BBOX.west + 180} ${90 - BBOX.north} ${BBOX.east - BBOX.west} ${BBOX.north - BBOX.south}`;
	let legendOk = $state(true);
</script>

<ViewHeader code="AGUA" title="Reservas de agua" sub="Embalses de España (MITECO) y sequía en Europa (Copernicus)" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Embalses de España" meta={w ? `Semana del ${dm(`${w.date}T12:00:00Z`)}` : ''}>
			{#if w}
				<Tiles>
					<Tile label="Reserva" value="{nf(w.pct, 1)} %" sub="{nf(w.hm3, 0)} de {nf(w.capacity, 0)} hm³" />
					<Tile label="Hace un año" value="{nf(w.yearAgo, 1)} %" sub="{signed(w.pct - w.yearAgo, 1)} puntos" />
					<Tile label="Media de 10 años" value="{nf(w.avg10, 1)} %" sub="{signed(w.pct - w.avg10, 1)} puntos" />
				</Tiles>
				<LineChart {lines} decimals={1} unit=" %" />
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}
				Embalses peninsulares de más de 5 hm³, datos semanales sin validar. Fuente: MITECO, Boletín
				Hidrológico · <Updated at={data.water?.fetchedAt} source="water" />
			{/snippet}
		</Panel>
		{#if w?.basins.length}
			<Panel title="Por cuencas" meta="De menos a más llena">
				<Table>
						<thead><tr><th class="l">Cuenca</th><th>Reserva</th><th class="sp"><span class="sr">Llenado</span></th><th>hm³</th></tr></thead>
						<tbody>
							{#each w.basins as b (b.name)}
								<tr>
									<td class="l">{b.name}</td>
									<td>{nf(b.pct, 1)} %</td>
									<td class="sp"><Bar pct={Math.min(100, b.pct)} tone="amber" /></td>
									<td class="mut">{nf(b.hm3, 0)}</td>
								</tr>
							{/each}
						</tbody>
				</Table>
			</Panel>
		{/if}
	</div>
	<div class="col">
		<Panel title="Sequía en Europa" meta="Indicador combinado (CDI) · cada 10 días">
			<figure class="map">
				<svg viewBox={view} role="img" aria-label="Mapa de sequía de Europa">
					<use class="land" href={LAND_HREF} />
					<image href={cdi} x={BBOX.west + 180} y={90 - BBOX.north} width={BBOX.east - BBOX.west} height={BBOX.north - BBOX.south} preserveAspectRatio="none" />
				</svg>
				{#if legendOk}
					<img class="legend" src={legend} alt="Leyenda del indicador de sequía" loading="lazy" onerror={() => (legendOk = false)} />
				{/if}
			</figure>
			{#snippet note()}
				Combina lluvia, humedad del suelo y estado de la vegetación. Fuente: Copernicus, European Drought
				Observatory (JRC).
			{/snippet}
		</Panel>
	</div>
</div>

<style>
	.map {
		margin: 0;
		padding: var(--sp-8) var(--pad-x);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.land {
		fill: var(--raise);
		stroke: var(--line);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.legend {
		display: block;
		max-width: 100%;
		margin-top: var(--sp-8);
		opacity: 0.85;
	}
</style>
