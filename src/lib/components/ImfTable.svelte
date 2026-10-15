<!-- Previsiones del FMI: crecimiento del PIB e inflación media, año actual y siguiente. -->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import type { ImfData } from '#lib/types.ts';
	import Table from './ui/Table.svelte';

	let { data }: { data: ImfData } = $props();
</script>

<!-- Table trae el scroll horizontal: a 390 px las cinco columnas no caben. -->
<Table>
		<thead>
			<tr>
				<th>País</th>
				{#each data.years as y (y)}<th>PIB {y}</th>{/each}
				{#each data.years as y (y)}<th>IPC {y}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.rows as row (row.code)}
				<tr>
					<td><span class="name">{row.name}</span></td>
					{#each row.gdp as v, i (i)}<td class:mut={v === null}>{nf(v, 1)}</td>{/each}
					{#each row.cpi as v, i (i)}<td class:mut={v === null}>{nf(v, 1)}</td>{/each}
				</tr>
			{/each}
		</tbody>
</Table>

<style>
	td:not(:first-child) {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
	}

	/* Separa el bloque del PIB del de la inflación con la misma línea de 1 px de la tabla. */
	th:nth-child(4),
	td:nth-child(4) {
		border-left: var(--border);
	}
</style>
