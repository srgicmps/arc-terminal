<!--
	FUEL, «Mi gasolinera» (F3): la estación favorita del usuario, su precio de hoy frente a las de su zona y su
	historial (lo apunta el navegador cada día que abres FUEL; ver src/lib/myfuel.ts) junto a la media de la zona.
	La vista se encarga de cargar las estaciones de su zona y de guardar; aquí solo se pinta.
-->
<script lang="ts">
	import LineChart from './LineChart.svelte';
	import Panel from './Panel.svelte';
	import Change from './ui/Change.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';
	import { nf } from '#lib/format.ts';
	import type { FuelKey, FuelPrices } from '#lib/fuel.ts';
	import { myStationStats, type MyStation } from '#lib/myfuel.ts';

	interface Props {
		mine: MyStation;
		/** Estaciones de su zona; null mientras se cargan. */
		stations: { id: string; prices: FuelPrices }[] | null;
		/** Media diaria de su zona, para el gráfico. */
		zoneHistory: { date: string; avg: FuelPrices }[];
		zoneName: string;
		fuel: FuelKey;
		fuelLabel: string;
		today: string;
		onclear: () => void;
	}

	let { mine, stations, zoneHistory, zoneName, fuel, fuelLabel, today, onclear }: Props = $props();

	const s = $derived(stations ? myStationStats(mine, stations, fuel, today) : null);
	const gone = $derived(!!stations && !stations.some((x) => x.id === mine.id));
	const lines = $derived([
		{ label: 'Mi gasolinera', color: '--amber', points: mine.log.flatMap((e) => (e.p[fuel] == null ? [] : [{ t: e.d, v: e.p[fuel]! }])) },
		{ label: `Media de ${zoneName}`, color: '--muted', points: zoneHistory.flatMap((d) => (d.avg[fuel] == null ? [] : [{ t: d.date, v: d.avg[fuel]! }])) }
	]);
</script>

<Panel title="Mi gasolinera" meta="{mine.name} · {mine.town}">
	{#if !stations}
		<p class="empty">Cargando…</p>
	{:else if gone}
		<p class="empty">Tu gasolinera ya no aparece en los datos del Ministerio.</p>
	{:else if !s}
		<p class="empty">No vende {fuelLabel.toLowerCase()}.</p>
	{:else}
		<Tiles cols={3}>
			<Tile label="{fuelLabel}, hoy" value="{nf(s.price, 3)} €/L">
				{#if s.change !== null}<span class="chg"><Change value={s.change} digits={3} invert /> desde el último día</span>{/if}
			</Tile>
			<Tile
				label="{s.save >= 0 ? 'Ahorras' : 'Pagas de más'} en 50 L"
				value="{nf(Math.abs(s.save), 2)} €"
				tone={Math.abs(s.save) < 0.005 ? undefined : s.save > 0 ? 'up' : 'down'}
				sub="frente a la media de {zoneName} ({nf(s.avg, 3)})"
			/>
			<Tile label="Puesto en {zoneName}" value="{s.rank}.ª de {s.of}" sub="1.ª es la más barata" />
		</Tiles>
		{#if lines[0].points.length > 1}
			<LineChart {lines} decimals={3} height={140} />
		{/if}
	{/if}
	{#snippet note()}
		El historial de tu gasolinera se apunta cada día que abres FUEL (el Ministerio solo da el precio de hoy).
		<button type="button" class="clear" onclick={onclear}>Quitar favorita</button>
	{/snippet}
</Panel>

<style>
	.chg {
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.clear {
		background: none;
		border: 0;
		padding: 0;
		color: var(--amber);
		font: inherit;
		cursor: pointer;
	}
</style>
