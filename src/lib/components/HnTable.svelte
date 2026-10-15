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
							{item.comments} {item.comments === 1 ? 'comentario' : 'comentarios'}
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
		gap: var(--sp-10);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	li:last-child {
		border-bottom: 0;
	}

	.pts {
		color: var(--amber);
		font-size: var(--fs-s);
		text-align: right;
		padding-top: var(--sp-2);
	}

	.h {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-tight);
	}

	.h:hover {
		color: var(--amber);
	}

	.h:visited {
		color: var(--muted);
	}

	.m {
		margin: var(--sp-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-10);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.m a {
		color: var(--muted);
	}
</style>
