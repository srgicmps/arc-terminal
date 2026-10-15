<!--
	ECST: tabla de las grandes economías, ordenable. Al pulsar una cabecera se ordena por esa columna (de mayor a
	menor; otra vez, al revés). Sin ordenar, van como las lista el FMI: de más a menos peso en la economía mundial.
-->
<script lang="ts">
	import { sortRows, type EcstKey, type EcstRow } from '#lib/ecst.ts';
	import { nf, signed } from '#lib/format.ts';
	import { Sorter } from '#lib/sorter.svelte.ts';
	import SortTh from './ui/SortTh.svelte';
	import Table from './ui/Table.svelte';

	let { rows }: { rows: EcstRow[] } = $props();

	const COLUMNS: { key: EcstKey; label: string; title: string }[] = [
		{ key: 'gdp', label: 'PIB', title: 'Crecimiento del PIB real este año (estimación del FMI), %' },
		{ key: 'cpi', label: 'IPC', title: 'Inflación media este año (FMI), %' },
		{ key: 'unemployment', label: 'Paro', title: 'Tasa de paro este año (FMI), %' },
		{ key: 'rate', label: 'Tipo', title: 'Tipo oficial del banco central (BIS), %' },
		{ key: 'bond', label: 'Bono 10A', title: 'Rentabilidad del bono a 10 años, %' },
		{ key: 'debt', label: 'Deuda', title: 'Deuda pública bruta (FMI), % del PIB' },
		{ key: 'balance', label: 'Saldo', title: 'Saldo público (FMI), % del PIB; negativo = déficit' }
	];

	const sort = new Sorter<EcstKey>();
	const shown = $derived(sort.key ? sortRows(rows, sort.key, sort.dir) : rows);
	const cell = (v: number | null, d = 1) => (v === null ? '—' : nf(v, d));
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr>
				<SortTh {sort} key="name" first="asc">País</SortTh>
				{#each COLUMNS as c (c.key)}
					<SortTh {sort} key={c.key} title={c.title}>{c.label}</SortTh>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each shown as r (r.code)}
				<tr>
					<td class="name">{r.name}</td>
					<td>{cell(r.gdp)}</td>
					<td>{cell(r.cpi)}</td>
					<td>{cell(r.unemployment)}</td>
					<td>{cell(r.rate, 2)}</td>
					<td>{cell(r.bond, 2)}</td>
					<td class="mut">{cell(r.debt, 0)}</td>
					<td class:down={r.balance !== null && r.balance < 0}>{r.balance === null ? '—' : signed(r.balance, 1)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}
