<!--
	ECST: tabla de las grandes economías, ordenable. Al pulsar una cabecera se ordena por esa columna (de mayor a
	menor; otra vez, al revés). Sin ordenar, van como las lista el FMI: de más a menos peso en la economía mundial.
-->
<script lang="ts">
	import { sortRows, type EcstKey, type EcstRow } from '#lib/ecst.ts';
	import { nf, signed } from '#lib/format.ts';
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

	let key = $state<EcstKey | null>(null);
	let dir = $state<'asc' | 'desc'>('desc');

	function sortBy(next: EcstKey) {
		if (key === next) dir = dir === 'desc' ? 'asc' : 'desc';
		else {
			key = next;
			dir = next === 'name' ? 'asc' : 'desc';
		}
	}

	const shown = $derived(key ? sortRows(rows, key, dir) : rows);
	const aria = (k: EcstKey) => (key === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
	const arrow = (k: EcstKey) => (key === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
	const cell = (v: number | null, d = 1) => (v === null ? '—' : nf(v, d));
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr>
				<th aria-sort={aria('name')}><button type="button" onclick={() => sortBy('name')}>País{arrow('name')}</button></th>
				{#each COLUMNS as c (c.key)}
					<th aria-sort={aria(c.key)} title={c.title}>
						<button type="button" onclick={() => sortBy(c.key)}>{c.label}{arrow(c.key)}</button>
					</th>
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

<style>
	th button {
		font: inherit;
		color: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}

	th button:focus-visible {
		outline: var(--hair) solid var(--amber);
	}

	th[aria-sort='ascending'],
	th[aria-sort='descending'] {
		color: var(--amber);
	}
</style>
