<!-- Terremotos recientes: magnitud, lugar y hora. Los de alerta naranja o roja se destacan. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, when } from '#lib/format.ts';
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
</script>

{#if quakes.length}
	<div class="scroll">
		<table class="t">
			<thead>
				<tr><th>Mag.</th><th class="l">Lugar</th><th>Prof.</th><th>Cuándo</th></tr>
			</thead>
			<tbody>
				{#each quakes as q (q.id)}
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
		</table>
	</div>
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
		font-weight: 600;
	}

	.flag {
		margin-left: 6px;
		color: var(--amber);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.flag.orange,
	.flag.red {
		color: var(--fg);
		font-weight: 600;
	}
</style>
