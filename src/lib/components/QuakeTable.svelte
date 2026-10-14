<!-- Terremotos recientes: magnitud, lugar y hora. Los de alerta naranja o roja se destacan. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, when } from '#lib/format.ts';
	import { sortBy } from '#lib/sort.ts';
	import { Sorter } from '#lib/sorter.svelte.ts';
	import SortTh from './ui/SortTh.svelte';
	import Table from './ui/Table.svelte';
	import type { Quake } from '#lib/types.ts';

	interface Props {
		quakes: Quake[];
		/**
		 * Aviso cuando la lista llega vacía porque no ha habido terremotos (la fuente sí ha respondido).
		 * Sin él se entiende que faltan los datos: «Sin datos todavía».
		 */
		empty?: string;
	}

	let { quakes, empty }: Props = $props();

	// Sin ordenar, como llegan (los más recientes primero).
	const COLS = { mag: (q: Quake) => q.mag, place: (q: Quake) => q.place, depth: (q: Quake) => q.depth, time: (q: Quake) => Date.parse(q.time) };
	const sort = new Sorter<keyof typeof COLS>();
	const shown = $derived(sort.key ? sortBy(quakes, COLS[sort.key], sort.dir) : quakes);
</script>

{#if quakes.length}
	<Table>
		<thead>
			<tr>
				<SortTh {sort} key="mag">Mag.</SortTh>
				<SortTh {sort} key="place" first="asc" class="l">Lugar</SortTh>
				<SortTh {sort} key="depth">Prof.</SortTh>
				<SortTh {sort} key="time">Cuándo</SortTh>
			</tr>
		</thead>
		<tbody>
			{#each shown as q (q.id)}
				<tr>
					<td class:strong={q.mag >= 6}>{nf(q.mag, 1)}</td>
					<td class="l">
						<a class="name" href={q.url} target="_blank" rel="noopener">{q.place}</a>
						{#if q.tsunami}<span class="flag">tsunami</span>{/if}
						{#if q.alert && q.alert !== 'green'}<span class="flag {q.alert}">alerta {q.alert}</span>{/if}
					</td>
					<td class="mut">{nf(q.depth, 0)} km</td>
					<td class="mut">{when(q.time, clock.now)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">{empty ?? 'Sin datos todavía.'}</p>
{/if}

<style>
	td.l {
		white-space: normal;
	}

	a.name {
		color: inherit;
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	a.name:hover {
		color: var(--amber);
	}

	.strong {
		color: var(--amber);
		font-weight: var(--fw-bold);
	}

	.flag {
		margin-left: var(--sp-6);
		color: var(--amber);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
	}

	.flag.orange,
	.flag.red {
		color: var(--fg);
		font-weight: var(--fw-bold);
	}
</style>
