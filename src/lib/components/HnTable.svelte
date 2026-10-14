<!-- Portada de Hacker News: puntos, titular con su dominio y enlace a los comentarios. -->
<script lang="ts">
	import type { HnItem } from '#lib/types.ts';

	let { items }: { items: HnItem[] } = $props();
</script>

{#if items.length}
	<ol class="hn">
		{#each items as item (item.id)}
			<li>
				<span class="pts">{item.points}</span>
				<div>
					<a class="h" href={item.url} target="_blank" rel="noopener">{item.title}</a>
					<p class="m">
						{#if item.domain}<span>{item.domain}</span>{/if}
						<a href="https://news.ycombinator.com/item?id={item.id}" target="_blank" rel="noopener">
							{item.comments} comentarios
						</a>
					</p>
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.hn {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr);
		gap: 10px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--line);
	}

	li:last-child {
		border-bottom: 0;
	}

	.pts {
		color: var(--amber);
		font-size: var(--fs-s);
		text-align: right;
		padding-top: 2px;
	}

	.h {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: 1.3;
	}

	.h:hover {
		color: var(--amber);
	}

	.h:visited {
		color: var(--muted);
	}

	.m {
		margin: 3px 0 0;
		display: flex;
		gap: 10px;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.m a {
		color: var(--muted);
	}
</style>
