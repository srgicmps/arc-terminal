<!--
	WS: materias primas del Pink Sheet del Banco Mundial, por grupos. Último precio medio mensual y su variación
	frente al mes anterior y a hace un año.
-->
<script lang="ts">
	import { nf, period } from '#lib/format.ts';
	import { pinkChanges, type PinkRow } from '#lib/pinksheet.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';

	let { rows }: { rows: PinkRow[] } = $props();

	// Los grupos en el orden en que llegan (el de PINK_WANTED).
	const groups = $derived([...new Set(rows.map((r) => r.group))].map((g) => ({ name: g, rows: rows.filter((r) => r.group === g) })));
	const price = (v: number) => nf(v, v >= 100 ? 0 : v >= 10 ? 1 : 2);
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr><th>Materia prima</th><th>Precio</th><th>1 mes</th><th>1 año</th></tr>
		</thead>
		<tbody>
			{#each groups as g (g.name)}
				<tr><th class="l" colspan="4">{g.name}</th></tr>
				{#each g.rows as r (r.id)}
					{@const last = r.points.at(-1)}
					{@const c = pinkChanges(r.points)}
					<tr>
						<td class="name">{r.label}</td>
						<td title={last ? period(last.t) : undefined}>{last ? price(last.v) : '—'} <span class="unit">{r.unit}</span></td>
						<td><Change value={c.month} digits={1} unit=" %" /></td>
						<td><Change value={c.year} digits={1} unit=" %" /></td>
					</tr>
				{/each}
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.unit {
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
