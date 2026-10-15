<!--
	Precio de la luz en el mercado mayorista europeo (energycharts.json): media diaria de hoy y de mañana por
	zona, de la más barata a la más cara, y cuánto se aparta cada una de la media europea. España, en ámbar.
	Va en LUZ, ECO y (solo las zonas del país) en PAIS.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { europeAverage, vsAverage } from '#lib/eupower.ts';
	import { nf } from '#lib/format.ts';
	import type { EuPowerZone } from '#lib/types.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';

	interface Props {
		zones: EuPowerZone[];
		/** Zona que se resalta (España por defecto). */
		mark?: string;
		/** Solo las zonas de este país (PAIS), comparadas igualmente con la media de todas; sin fila de media. */
		country?: string;
	}

	let { zones, mark = 'ES', country }: Props = $props();

	const sorted = $derived(
		zones.filter((z) => !country || z.country === country).sort((a, b) => (a.today ?? Infinity) - (b.today ?? Infinity))
	);
	const avgToday = $derived(europeAverage(zones, 'today'));
	const avgTomorrow = $derived(europeAverage(zones, 'tomorrow'));
	const hasTomorrow = $derived(zones.some((z) => z.tomorrow !== null));
	const price = (v: number | null) => (v === null ? '—' : nf(v, 2));
</script>

<Table>
	<thead>
		<tr>
			<th>Zona</th>
			<th>Hoy</th>
			{#if hasTomorrow}<th>Mañana</th>{/if}
			<th title="Hoy, frente a la media de las zonas europeas">Dif.</th>
		</tr>
	</thead>
	<tbody>
		{#each sorted as z (z.zone)}
			{@const vs = vsAverage(zones, z.zone, 'today')}
			<tr class:mark={!country && z.zone === mark}>
				<td class="name">{#if country}{z.name}{:else}<a href="{resolve('/pais')}?c={z.country}">{z.name}</a>{/if}</td>
				<td>{price(z.today)}</td>
				{#if hasTomorrow}<td>{price(z.tomorrow)}</td>{/if}
				<!-- Más cara que la media: rojo; más barata: verde. -->
				<td><Change value={vs?.pct ?? null} digits={0} unit=" %" invert /></td>
			</tr>
		{/each}
		{#if !country}
		<tr class="avg">
			<td class="name">Media</td>
			<td>{price(avgToday)}</td>
			{#if hasTomorrow}<td>{price(avgTomorrow)}</td>{/if}
			<td></td>
		</tr>
		{/if}
	</tbody>
</Table>

<style>
	a {
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		color: var(--amber);
	}

	.mark td {
		color: var(--amber);
	}

	.avg td {
		color: var(--muted);
	}
</style>
