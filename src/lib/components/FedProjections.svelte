<!--
	ECO, «Proyecciones de la Fed» (panel provisional): la mediana de las proyecciones del FOMC (SEP) para el tipo,
	la inflación PCE y el paro, con el rango de todos los participantes debajo. La tabla sale de src/lib/sep.ts.
	Para quitarlo: este archivo, su línea en la vista ECO y la de su +page.server.ts (y lo que dice sep.ts).
-->
<script lang="ts">
	import type { Dataset } from '#lib/data.ts';
	import { nf } from '#lib/format.ts';
	import { sepTable } from '#lib/sep.ts';
	import type { SeriesData } from '#lib/types.ts';
	import Panel from './Panel.svelte';
	import Updated from './Updated.svelte';
	import Table from './ui/Table.svelte';

	let { data }: { data: Dataset<SeriesData> } = $props();

	// Desde el año de la descarga: los años pasados ya no son previsiones.
	const table = $derived(sepTable(data.data.series, Number(data.fetchedAt.slice(0, 4)) || undefined));
</script>

{#if table}
	<Panel title="Proyecciones de la Fed" meta="Mediana del FOMC · rango">
		<Table>
			<thead>
				<tr>
					<th>%</th>
					{#each table.years as y (y)}<th>{y}</th>{/each}
					{#if table.longRun !== undefined}<th>Largo plazo</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each table.rows as r, i (r.name)}
					<tr>
						<td><a class="name" href={r.url} target="_blank" rel="noopener">{r.name}</a></td>
						{#each table.years as y (y)}
							{@const c = r.cells[y]}
							<td>
								{#if c}
									{nf(c.md, r.decimals)}
									{#if c.lo !== null && c.hi !== null}
										<span class="range mut">{nf(c.lo, r.decimals)}–{nf(c.hi, r.decimals)}</span>
									{/if}
								{:else}
									<span class="mut">—</span>
								{/if}
							</td>
						{/each}
						{#if table.longRun !== undefined}
							<td>{#if i === 0}{nf(table.longRun, 2)}{:else}<span class="mut">—</span>{/if}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</Table>
		{#snippet note()}
			SEP: las proyecciones que hacen los miembros del FOMC cuatro veces al año (marzo, junio, septiembre y
			diciembre). La cifra es la mediana de todos los participantes y, debajo, la más baja y la más alta; tipo a
			final de año, inflación y paro del cuarto trimestre. Fuente: FRED, Fed de San Luis (usa su API sin estar
			respaldado por ella) · <Updated at={data.fetchedAt} source="fred" />
		{/snippet}
	</Panel>
{/if}

<style>
	td:first-child {
		white-space: normal;
	}

	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	/* El rango, debajo de la mediana y más pequeño. */
	.range {
		display: block;
		font-size: var(--fs-xxs);
	}
</style>
