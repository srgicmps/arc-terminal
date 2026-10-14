<!--
	Clima del planeta: temperatura media mundial de hace unos días frente a 1991–2020, su puesto entre ese
	mismo día de todos los años y el CO₂ de Mauna Loa frente a hace un año. Sale en GEO y en WX.
-->
<script lang="ts">
	import type { Dataset } from '#lib/data.ts';
	import type { ClimateData } from '#lib/climate.ts';
	import { nf, period, signed } from '#lib/format.ts';
	import Panel from './Panel.svelte';
	import Updated from './Updated.svelte';
	import Change from './ui/Change.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';

	let { climate }: { climate: Dataset<ClimateData> | null } = $props();

	const temp = $derived(climate?.data.temp ?? null);
	const co2 = $derived(climate?.data.co2 ?? null);
	const co2Change = $derived(co2?.yearAgo ? co2.ppm - co2.yearAgo.ppm : null);
</script>

{#if temp || co2}
	<Panel title="Clima del planeta" meta={temp ? `Media mundial del ${period(temp.date)}` : undefined}>
		<Tiles>
			{#if temp}
				<Tile label="Anomalía" value="{signed(temp.anomaly, 2)} °C">
					{nf(temp.temp, 2)} °C · frente a 1991–2020
				</Tile>
				<Tile label="Puesto" value={temp.rank === 1 ? 'Récord' : `${temp.rank}.º`}>
					{temp.rank === 1 ? 'el' : `${temp.rank}.º`} {period(temp.date)} más cálido desde {temp.since}
				</Tile>
			{/if}
			{#if co2}
				<Tile label="CO₂ · Mauna Loa" value="{nf(co2.ppm, 2)} ppm">
					{#if co2Change !== null}<Change value={co2Change} unit=" ppm" invert /> en un año{:else}{period(co2.date)}{/if}
				</Tile>
			{/if}
		</Tiles>
		{#snippet note()}
			Fuentes: <a href="https://pulse.climate.copernicus.eu" target="_blank" rel="noopener">Copernicus Climate Pulse</a> (ERA5, temperatura
			del aire a 2 m) y <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA GML</a> · <Updated
				at={climate?.fetchedAt}
				source="climate"
			/>
		{/snippet}
	</Panel>
{/if}
