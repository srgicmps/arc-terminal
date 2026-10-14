<!--
	Tabla de series: último dato, variación frente al anterior, periodo y minigráfico. Con `pct`, las variaciones
	van en % y no en unidades; con `yoy`, se añade la variación frente a hace 12 periodos (un año en las mensuales).
-->
<script lang="ts">
	import { GEO, nf, period } from '#lib/format.ts';
	import { change } from '#lib/series.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
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
		/** Variaciones en % (índices de precios) en lugar de en unidades. */
		pct?: boolean;
		/** Columna con la variación en % frente a hace 12 periodos. */
		yoy?: boolean;
	}

	let { rows, head = 'Indicador', spark = 24, pct = false, yoy = false }: Props = $props();

	const visible = $derived(rows.filter((r): r is Row & { series: Series } => Boolean(r.series?.points.length)));
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th>{head}</th>
				<th>Último</th>
				<th>Var.</th>
				{#if yoy}<th>Año</th>{/if}
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
				{@const diff = pct ? change(row.series) : prev ? last.v - prev.v : null}
				<tr>
					<td>
						<a class="name" href={row.series.url} target="_blank" rel="noopener">
							{row.name ?? GEO[row.series.geo ?? ''] ?? row.series.label}
						</a>
					</td>
					<td>{nf(last.v, d)}{row.series.unit === '%' ? ' %' : ''}</td>
					<td><Change value={diff} digits={pct ? 1 : d} unit={pct ? ' %' : ''} invert={row.inverse} /></td>
					{#if yoy}<td><Change value={change(row.series, 12)} digits={1} unit=" %" invert={row.inverse} /></td>{/if}
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
