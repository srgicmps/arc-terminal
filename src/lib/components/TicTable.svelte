<!--
	Quién tiene la deuda de EE. UU. (TIC, tabla 5): los grandes tenedores extranjeros, su parte del total y cómo ha
	cambiado su cartera en un mes y en un año. Ordenable por columnas.
-->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import { sortBy } from '#lib/sort.ts';
	import { Sorter } from '#lib/sorter.svelte.ts';
	import type { TicData, TicHolder } from '#lib/tic.ts';
	import Bar from './ui/Bar.svelte';
	import Change from './ui/Change.svelte';
	import SortTh from './ui/SortTh.svelte';
	import Table from './ui/Table.svelte';

	let { data }: { data: TicData } = $props();

	const last = (v: number[]) => v.at(-1) ?? null;
	const pct = (v: number[], back: number) => {
		const a = v.at(-1);
		const b = v.at(-1 - back);
		return a !== undefined && b ? (a / b - 1) * 100 : null;
	};

	const total = $derived(last(data.total) ?? 0);
	const top = $derived(Math.max(...data.holders.map((h) => last(h.values) ?? 0)));
	// Sin ordenar, como lo da el Tesoro: de más a menos deuda.
	const COLS = {
		name: (h: TicHolder) => h.name,
		amount: (h: TicHolder) => last(h.values),
		month: (h: TicHolder) => pct(h.values, 1),
		year: (h: TicHolder) => pct(h.values, 12)
	};
	const sort = new Sorter<keyof typeof COLS>();
	const shown = $derived(sort.key ? sortBy(data.holders, COLS[sort.key], sort.dir) : data.holders);
</script>

<Table>
	<thead>
		<tr>
			<SortTh {sort} key="name" first="asc">País</SortTh>
			<SortTh {sort} key="amount" title="Miles de millones de dólares">mm $</SortTh>
			<th class="sp"><span class="sr">Parte del total extranjero</span></th>
			<SortTh {sort} key="month">1 mes</SortTh>
			<SortTh {sort} key="year">1 año</SortTh>
		</tr>
	</thead>
	<tbody>
		{#each shown as h (h.id)}
			{@const v = last(h.values)}
			<tr>
				<td class="name">{h.name}</td>
				<td>{nf(v, 0)}</td>
				<td class="sp" title={v !== null && total ? `${nf((v / total) * 100, 1)} % del total extranjero` : undefined}>
					<Bar pct={v !== null && top ? (v / top) * 100 : 0} />
				</td>
				<td><Change value={pct(h.values, 1)} digits={1} unit=" %" /></td>
				<td><Change value={pct(h.values, 12)} digits={1} unit=" %" /></td>
			</tr>
		{/each}
		<tr class="sum">
			<td class="name">Total extranjero</td>
			<td>{nf(last(data.total), 0)}</td>
			<td class="sp"></td>
			<td><Change value={pct(data.total, 1)} digits={1} unit=" %" /></td>
			<td><Change value={pct(data.total, 12)} digits={1} unit=" %" /></td>
		</tr>
		{#if data.official.length}
			<tr>
				<td class="name mut" title="Bancos centrales y gobiernos («Foreign Official»)">De ellos, oficial</td>
				<td class="mut">{nf(last(data.official), 0)}</td>
				<td class="sp"></td>
				<td><Change value={pct(data.official, 1)} digits={1} unit=" %" /></td>
				<td><Change value={pct(data.official, 12)} digits={1} unit=" %" /></td>
			</tr>
		{/if}
	</tbody>
</Table>

<style>
	.sp {
		width: 30%;
		min-width: 60px;
	}

	/* En pantallas estrechas la barra cede su sitio a los números, como en FUEL. */
	@container (max-width: 480px) {
		.sp {
			display: none;
		}
	}

	.sum td {
		border-top: var(--border);
		font-weight: var(--fw-medium);
	}
</style>
