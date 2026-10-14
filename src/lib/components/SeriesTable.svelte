<!--
	Tabla de series: último dato, variación frente al anterior, periodo, próximo dato y minigráfico.
	El próximo dato sale de los calendarios oficiales (releases-cal.json): la tabla lo carga sola y la columna
	solo aparece si alguna serie tiene fecha.
-->
<script lang="ts">
	import { GEO, nf, period } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { Series } from '#lib/types.ts';
	import Spark from './Spark.svelte';
	import { loadCalendar, nextFor, shortDay } from '#lib/nextrelease.ts';
	import type { ReleaseEvent } from '#lib/types.ts';

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

	let calendar = $state<ReleaseEvent[]>([]);
	$effect(() => {
		loadCalendar().then((events) => (calendar = events));
	});
	const next = $derived(new Map(visible.map((r) => [r.series.id, nextFor(r.series.id, calendar)])));
	const anyNext = $derived([...next.values()].some(Boolean));
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th>{head}</th>
				<th>Último</th>
				<th>Var.</th>
				<th class="per">Periodo</th>
				{#if anyNext}<th class="nx">Próx.</th>{/if}
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
				{@const nx = next.get(row.series.id)}
				<tr>
					<td>
						<a class="name" href={row.series.url} target="_blank" rel="noopener">
							{row.name ?? GEO[row.series.geo ?? ''] ?? row.series.label}
						</a>
						{#if nx}<small class="nx-sub" title={nx.title}>próx. {shortDay(nx.date)}</small>{/if}
					</td>
					<td>{nf(last.v, d)}{row.series.unit === '%' ? ' %' : ''}</td>
					<td><Change value={diff} digits={d} invert={row.inverse} /></td>
					<td class="mut per">{period(last.t)}</td>
					{#if anyNext}<td class="mut nx" title={nx?.title}>{nx ? shortDay(nx.date) : ''}</td>{/if}
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

	/* El próximo dato va en su columna; en paneles estrechos, debajo del nombre. */
	.nx-sub {
		display: none;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	@container (max-width: 520px) {
		.nx {
			display: none;
		}

		.nx-sub {
			display: block;
		}
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
