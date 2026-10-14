<!--
	Precio de la vivienda en el mundo (BIS): variación interanual del último trimestre, nominal y real
	(descontada la inflación), con el minigráfico nominal de 5 años. Que suba no es ni bueno ni malo, así
	que las cifras van sin verde ni rojo.
-->
<script lang="ts">
	import { period, signed } from '#lib/format.ts';
	import { last } from '#lib/series.ts';
	import type { Series } from '#lib/types.ts';
	import Spark from './Spark.svelte';
	import Table from './ui/Table.svelte';

	let { series }: { series: Series[] } = $props();

	// Una fila por zona, en el orden en que llegan (el de la fuente): nominal y, si la hay, real.
	const rows = $derived.by(() => {
		const byId = new Map(series.map((s) => [s.id, s]));
		return series
			.filter((s) => s.id.startsWith('house-n-'))
			.map((n) => {
				const r = byId.get(n.id.replace('house-n-', 'house-r-'));
				return { n, name: n.label.replace(/ · nominal$/, ''), now: last(n), real: r ? last(r) : null };
			});
	});
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr>
				<th>Zona</th>
				<th>Nominal</th>
				<th>Real</th>
				<th class="per">Trimestre</th>
				<th class="sp"><span class="sr">Cinco años</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.n.id)}
				<tr>
					<td><a class="name" href={r.n.url} target="_blank" rel="noopener">{r.name}</a></td>
					<td>{signed(r.now?.v, 1)} %</td>
					<td class="mut">{r.real && r.real.t === r.now?.t ? `${signed(r.real.v, 1)} %` : '—'}</td>
					<td class="mut per">{r.now ? period(r.now.t) : ''}</td>
					<td class="sp"><Spark values={r.n.points.slice(-20).map((p) => p.v)} /></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
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

	/* Como en SeriesTable: en paneles estrechos el trimestre cede su sitio al minigráfico, y luego este. */
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
