<!--
	GEO, «Refugiados» (ACNUR): los países de los que más gente ha huido y los que más acogen. Refugiados más
	solicitantes de asilo, a fin de año. Las filas llegan ya ordenadas de top() (src/lib/unhcr.ts).
-->
<script lang="ts">
	import { compact } from '#lib/format.ts';
	import Table from './ui/Table.svelte';

	type Row = { iso3: string; name: string; value: number };
	let { from, hosted }: { from: Row[]; hosted: Row[] } = $props();
</script>

{#each [{ head: 'De dónde huyen', rows: from }, { head: 'Dónde están acogidos', rows: hosted }] as t (t.head)}
	{#if t.rows.length}
		<Table>
			<thead><tr><th class="l">{t.head}</th><th>Personas</th></tr></thead>
			<tbody>
				{#each t.rows as r (r.iso3)}
					<tr>
						<td class="l name">{r.name}</td>
						<td>{compact(r.value)}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	{/if}
{/each}
