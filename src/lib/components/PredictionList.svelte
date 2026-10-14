<!-- Mercados de predicción: pregunta y probabilidad de cada opción, con una barra fina. -->
<script lang="ts">
	import { compact, nf } from '#lib/format.ts';
	import type { Prediction } from '#lib/types.ts';

	let { items }: { items: Prediction[] } = $props();
</script>

{#if items.length}
	<ul class="pm">
		{#each items as e (e.id)}
			<li>
				<a class="q" href={e.url} target="_blank" rel="noopener">{e.title}</a>
				{#each e.outcomes as o (o.label)}
					<div class="o">
						<span class="lab">{o.label}</span>
						<span class="bar" aria-hidden="true"><i style:width="{(o.p * 100).toFixed(0)}%"></i></span>
						<b>{nf(o.p * 100, 0)} %</b>
					</div>
				{/each}
				{#if e.volume24h}<small>Volumen 24 h: {compact(e.volume24h)} $</small>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.pm {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		padding: 9px 12px;
		border-bottom: 1px solid var(--line);
	}

	li:last-child {
		border-bottom: 0;
	}

	.q {
		display: block;
		margin-bottom: 5px;
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: 1.3;
	}

	.q:hover {
		color: var(--amber);
	}

	.o {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 90px 44px;
		gap: 10px;
		align-items: center;
		font-size: var(--fs-s);
		padding: 1px 0;
	}

	.lab {
		color: var(--muted);
		font-family: var(--sans);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.bar {
		display: block;
		height: 4px;
		background: var(--raise);
	}

	.bar i {
		display: block;
		height: 100%;
		background: var(--amber);
		opacity: 0.75;
	}

	b {
		font-weight: 500;
		text-align: right;
	}

	small {
		display: block;
		margin-top: 4px;
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
