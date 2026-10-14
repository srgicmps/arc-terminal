<script lang="ts">
	import { compact, nf, signed, trend } from '#lib/format.ts';
	import type { Coin } from '#lib/types.ts';

	let { coins }: { coins: Coin[] } = $props();

	const price = (n: number) => nf(n, n >= 100 ? 0 : n >= 1 ? 2 : 4);
</script>

{#if coins.length}
	<div class="scroll">
		<table class="t">
			<thead>
				<tr><th>Moneda</th><th>$</th><th>24 h</th><th>Capitalización</th></tr>
			</thead>
			<tbody>
				{#each coins as c (c.id)}
					<tr>
						<td><span class="sym">{c.symbol}</span><span class="sub">{c.name}</span></td>
						<td>{price(c.usd)}</td>
						<td class={trend(c.change24h)}>{signed(c.change24h, 1)} %</td>
						<td class="mut">{compact(c.marketCap)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.sym {
		display: inline-block;
		min-width: 5ch;
		color: var(--amber);
		font-weight: 500;
	}
</style>
