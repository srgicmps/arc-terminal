<!-- Lista de titulares: hora, titular enlazado al medio original, medio y resumen opcional. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';
	import type { NewsItem } from '#lib/types.ts';

	interface Props {
		items: NewsItem[];
		/** Muestra el resumen debajo del titular. */
		summaries?: boolean;
		/** Etiqueta de sección delante del medio (en la portada). */
		tag?: (item: NewsItem) => string | undefined;
	}

	let { items, summaries = false, tag }: Props = $props();
</script>

{#if items.length}
	<ul class="news">
		{#each items as item, i (i)}
			<li>
				<time datetime={item.time ?? undefined}>{when(item.time, clock.now)}</time>
				<div>
					<a class="h" href={item.url} target="_blank" rel="noopener">{item.title}</a>
					<p class="m">
						{#if tag?.(item)}<span class="tag">{tag(item)}</span>{/if}
						<span>{item.source}</span>
					</p>
					{#if summaries && item.summary && item.summary !== item.title}
						<p class="s">{item.summary}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin titulares todavía.</p>
{/if}

<style>
	.news {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.news li {
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr);
		gap: 10px;
		align-items: start;
		padding: 8px 12px;
		border-bottom: 1px solid var(--line);
	}

	/* En pantallas táctiles, toda la fila abre el titular: el ::after invisible del enlace la cubre. */
	@media (pointer: coarse) {
		.news li {
			position: relative;
		}

		.h::after {
			content: '';
			position: absolute;
			inset: 0;
		}
	}

	.news li:last-child {
		border-bottom: 0;
	}

	time {
		padding-top: 2px;
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: 1.35;
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
		gap: 4px 8px;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.tag {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: 0.04em;
	}

	.s {
		margin: 4px 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: 1.4;
	}
</style>
