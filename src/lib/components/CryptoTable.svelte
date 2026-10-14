<script lang="ts">
	import { compact, nf } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { Coin } from '#lib/types.ts';

	let { coins }: { coins: Coin[] } = $props();

	const price = (n: number) => nf(n, n >= 100 ? 0 : n >= 1 ? 2 : 4);
</script>

{#if coins.length}
	<Table>
		<thead>
			<tr><th>Moneda</th><th>$</th><th>24 h</th><th>Capitalización</th></tr>
		</thead>
		<tbody>
			{#each coins as c (c.id)}
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
