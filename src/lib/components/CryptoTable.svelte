<script lang="ts">
	import { compact, nf } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import { sortBy } from '#lib/sort.ts';
	import { Sorter } from '#lib/sorter.svelte.ts';
	import SortTh from './ui/SortTh.svelte';
	import Table from './ui/Table.svelte';
	import type { Coin } from '#lib/types.ts';

	let { coins }: { coins: Coin[] } = $props();

	// Sin ordenar, por capitalización, como llegan de CoinGecko.
	const COLS = { symbol: (c: Coin) => c.symbol, usd: (c: Coin) => c.usd, change: (c: Coin) => c.change24h, cap: (c: Coin) => c.marketCap };
	const sort = new Sorter<keyof typeof COLS>();
	const shown = $derived(sort.key ? sortBy(coins, COLS[sort.key], sort.dir) : coins);

	const price = (n: number) => nf(n, n >= 100 ? 0 : n >= 1 ? 2 : 4);
</script>

{#if coins.length}
	<Table>
		<thead>
			<tr>
				<SortTh {sort} key="symbol" first="asc">Moneda</SortTh>
				<SortTh {sort} key="usd">$</SortTh>
				<SortTh {sort} key="change">24 h</SortTh>
				<SortTh {sort} key="cap">Capitalización</SortTh>
			</tr>
		</thead>
		<tbody>
			{#each shown as c (c.id)}
				<tr>
					<td><span class="sym">{c.symbol}</span><span class="sub">{c.name}</span></td>
					<td>{price(c.usd)}</td>
					<td><Change value={c.change24h} digits={1} unit=" %" /></td>
					<td class="mut">{compact(c.marketCap)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.sym {
		display: inline-block;
		min-width: 5ch;
		color: var(--amber);
		font-weight: var(--fw-medium);
	}
</style>
