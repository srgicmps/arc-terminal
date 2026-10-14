<!--
	Clima del planeta: temperatura media mundial de hace unos días frente a 1991–2020, su puesto entre ese
	mismo día de todos los años, el CO₂ de Mauna Loa frente a hace un año y la fase de El Niño (ONI). Sale en
	GEO y en WX.
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
	const enso = $derived(climate?.data.enso ?? null);
	const PHASE = { nino: 'El Niño', nina: 'La Niña', neutral: 'Neutral' } as const;
	const tiles = $derived(Number(!!temp) * 2 + Number(!!co2) + Number(!!enso));
</script>

{#if temp || co2 || enso}
	<Panel title="Clima del planeta" meta={temp ? `Media mundial del ${period(temp.date)}` : undefined}>
		<Tiles cols={tiles > 3 ? tiles : undefined}>
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
			{#if enso}
				<Tile label="El Niño" value={PHASE[enso.phase]}>
					ONI {signed(enso.anom, 1)} °C · {enso.season} {enso.year}{enso.phase !== 'neutral' && enso.streak >= 5 ? ' · episodio' : ''}
				</Tile>
			{/if}
		</Tiles>
		{#snippet note()}
			Fuentes: <a href="https://pulse.climate.copernicus.eu" target="_blank" rel="noopener">Copernicus Climate Pulse</a> (ERA5, temperatura
			del aire a 2 m), <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA GML</a> y
			<a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php" target="_blank" rel="noopener">NOAA CPC</a>
			(ONI: anomalía del Pacífico tropical en trimestres móviles; ±0,5 °C marca El Niño o La Niña) · <Updated
				at={climate?.fetchedAt}
				source="climate"
			/>
		{/snippet}
	</Panel>
{/if}
