<!-- Papers del día de Hugging Face: votos, título, autores, enlaces a HF y arXiv y resumen corto. -->
<script lang="ts">
	import type { Paper } from '#lib/types.ts';

	interface Props {
		items: Paper[];
		/** Aviso cuando la lista del día llega vacía (la fuente sí ha respondido). Sin él: «Sin papers todavía». */
		empty?: string;
	}

	let { items, empty }: Props = $props();
</script>

{#if items.length}
	<ol class="papers">
		{#each items as item (item.id)}
			<li>
				<span class="votes" title="Votos en Hugging Face">{item.upvotes}</span>
				<div>
					<a class="h" href={item.url} target="_blank" rel="noopener">{item.title}</a>
					<p class="m">
						{#if item.authors}<span>{item.authors}</span>{/if}
						<a href={item.arxiv} target="_blank" rel="noopener">arXiv</a>
						{#if item.comments}<span>{item.comments} {item.comments === 1 ? 'comentario' : 'comentarios'}</span>{/if}
					</p>
					{#if item.summary}<p class="s">{item.summary}</p>{/if}
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">{empty ?? 'Sin papers todavía.'}</p>
{/if}

<style>
	.papers {
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

	.votes {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		font-variant-numeric: tabular-nums;
		text-align: right;
		padding-top: 2px;
	}

	.h {
		display: block;
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: 1.3;
		text-wrap: pretty;
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
		flex-wrap: wrap;
		gap: 4px 10px;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.m a {
		color: var(--muted);
	}

	.s {
		margin: 4px 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: 1.4;
		/* Tres líneas como mucho: el panel sigue siendo denso. */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}
</style>
