<!--
	Balance de los bancos centrales (total del activo, semanal): cuánto ha cambiado en 4 semanas y en un año,
	y su evolución en 3 años. Sube cuando el banco compra activos (QE) y baja cuando los deja vencer o vende (QT).
-->
<script lang="ts">
	import { compact, period } from '#lib/format.ts';
	import { change } from '#lib/series.ts';
	import Spark from './Spark.svelte';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { Series } from '#lib/types.ts';

	interface Props {
		/** Las series vienen en millones (BCE y FRED): `currency` es la moneda, «€» o «$». */
		rows: { name: string; series: Series | undefined; currency: string }[];
	}

	let { rows }: Props = $props();

	const visible = $derived(rows.filter((r): r is typeof r & { series: Series } => Boolean(r.series?.points.length)));
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th class="l">Banco</th>
				<th>Saldo</th>
				<th>4 sem.</th>
				<th>1 año</th>
				<th class="sp"><span class="sr">Evolución en 3 años</span></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as r (r.series.id)}
				{@const pts = r.series.points}
				{@const last = pts[pts.length - 1]}
				<tr>
					<td class="l">
						<a class="name" href={r.series.url} target="_blank" rel="noopener">{r.name}</a>
						<span class="sub">{period(last.t)}</span>
					</td>
					<td>{compact(last.v * 1e6)} {r.currency}</td>
					<td><Change value={change(r.series, 4)} digits={1} unit=" %" /></td>
					<td><Change value={change(r.series, 52)} digits={1} unit=" %" /></td>
					<td class="sp"><Spark values={pts.slice(-156).map((p) => p.v)} /></td>
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
