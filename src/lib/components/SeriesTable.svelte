<!-- Tabla de series: último dato, variación frente al anterior, periodo y minigráfico. -->
<script lang="ts">
	import { GEO, nf, period } from '#lib/format.ts';
	import { lookup } from '#lib/glossary.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import Term from './ui/Term.svelte';
	import type { Series } from '#lib/types.ts';
	import Spark from './Spark.svelte';

	interface Row {
		series: Series | undefined;
		/** Texto de la primera columna; por defecto, el país o la etiqueta de la serie. */
		name?: string;
		decimals?: number;
		/** Si subir es malo (paro, inflación…), la variación se pinta al revés. */
		inverse?: boolean;
	}

	interface Props {
		rows: Row[];
		head?: string;
		/** Cuántos puntos dibuja el minigráfico. */
		spark?: number;
	}

	let { rows, head = 'Indicador', spark = 24 }: Props = $props();

	const visible = $derived(rows.filter((r): r is Row & { series: Series } => Boolean(r.series?.points.length)));

	const nameOf = (row: Row & { series: Series }) => row.name ?? GEO[row.series.geo ?? ''] ?? row.series.label;
	// ⓘ del glosario: solo en la primera fila de cada término, para no repetirlo en toda la tabla.
	const withTerm = $derived.by(() => {
		const seen = new Set<string>();
		return new Set(
			visible.flatMap((row) => {
				const id = lookup(nameOf(row))?.id;
				if (!id || seen.has(id)) return [];
				seen.add(id);
				return [row.series.id];
			})
		);
	});
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th>{head}</th>
				<th>Último</th>
				<th>Var.</th>
				<th class="per">Periodo</th>
				<th class="sp"><span class="sr">Evolución</span></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as row (row.series.id)}
				{@const pts = row.series.points}
				{@const last = pts[pts.length - 1]}
				{@const prev = pts[pts.length - 2]}
				{@const d = row.decimals ?? 1}
				{@const diff = prev ? last.v - prev.v : null}
				<tr>
					<td>
						<a class="name" href={row.series.url} target="_blank" rel="noopener">
							{nameOf(row)}
						</a>{#if withTerm.has(row.series.id)}<Term of={nameOf(row)} />{/if}
					</td>
					<td>{nf(last.v, d)}{row.series.unit === '%' ? ' %' : ''}</td>
					<td><Change value={diff} digits={d} invert={row.inverse} /></td>
					<td class="mut per">{period(last.t)}</td>
					<td class="sp"><Spark values={pts.slice(-spark).map((p) => p.v)} /></td>
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

	/* En paneles estrechos, el periodo cede su sitio al minigráfico; en los muy estrechos, también este. */
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
