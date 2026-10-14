<!--
	Divisas frente al euro (tipo de referencia del BCE): último cambio, variación en una semana y en un año,
	y minigráfico de los últimos meses. Las variaciones llegan ya calculadas desde +page.server.ts, que tiene
	la historia entera; al navegador solo llegan los puntos del minigráfico.
	Que el par suba es que el euro se aprecia frente a esa moneda (EUR/USD de 1,10 a 1,12: el euro vale más dólares).
-->
<script lang="ts">
	import { nf, period } from '#lib/format.ts';
	import Spark from './Spark.svelte';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { Series } from '#lib/types.ts';

	interface Props {
		rows: { series: Series | undefined; week: number | null; year: number | null }[];
	}

	let { rows }: Props = $props();

	const visible = $derived(rows.filter((r): r is typeof r & { series: Series } => Boolean(r.series?.points.length)));
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th class="l">Par</th>
				<th>Último</th>
				<th>1 sem.</th>
				<th>1 año</th>
				<th class="sp"><span class="sr">Evolución</span></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as r (r.series.id)}
				{@const pts = r.series.points}
				{@const last = pts[pts.length - 1]}
				<tr>
					<td class="l">
						<a class="name" href={r.series.url} target="_blank" rel="noopener">{r.series.label}</a>
						<span class="sub">{period(last.t)}</span>
					</td>
					<td>{nf(last.v, 4)}</td>
					<td><Change value={r.week} digits={1} unit=" %" /></td>
					<td><Change value={r.year} digits={1} unit=" %" /></td>
					<td class="sp"><Spark values={pts.map((p) => p.v)} /></td>
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

	@container (max-width: 300px) {
		.sp {
			display: none;
		}
	}
</style>
