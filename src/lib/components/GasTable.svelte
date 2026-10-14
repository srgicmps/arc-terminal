<!-- Gas almacenado: % de llenado de hoy, cambio en una semana y diferencia con la misma fecha del año
     pasado, en puntos. Subir es bueno (más reservas): verde. -->
<script lang="ts">
	import { nf, period } from '#lib/format.ts';
	import { at, last } from '#lib/series.ts';
	import type { Series } from '#lib/types.ts';
	import Spark from './Spark.svelte';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';

	let { series }: { series: Series[] } = $props();

	/** Fecha «AAAA-MM-DD» desplazada `days` días. */
	const shift = (t: string, days: number) => new Date(Date.parse(`${t}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

	const rows = $derived(
		series.flatMap((s) => {
			const now = last(s);
			if (!now) return [];
			const week = at(s, shift(now.t, -7));
			const year = at(s, shift(now.t, -365));
			return [{ s, now, week: week ? now.v - week.v : null, year: year ? now.v - year.v : null }];
		})
	);
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr>
				<th>Zona</th>
				<th>Lleno</th>
				<th>7 días</th>
				<th>Hace 1 año</th>
				<th class="per">Día</th>
				<th class="sp"><span class="sr">Evolución</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.s.id)}
				<tr>
					<td><a class="name" href={r.s.url} target="_blank" rel="noopener">{r.s.label}</a></td>
					<td>{nf(r.now.v, 1)} %</td>
					<td><Change value={r.week} digits={1} /></td>
					<td><Change value={r.year} digits={1} /></td>
					<td class="mut per">{period(r.now.t)}</td>
					<td class="sp"><Spark values={r.s.points.slice(-90).map((p) => p.v)} /></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.sp {
		width: 80px;
		padding-block: 0;
	}

	/* Como en SeriesTable: en paneles estrechos el día cede su sitio al minigráfico, y luego este. */
	@container (max-width: 440px) {
		.per {
			display: none;
		}
	}

	@container (max-width: 300px) {
		.sp {
			display: none;
		}
	}
</style>
