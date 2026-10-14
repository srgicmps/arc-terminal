<!--
	Lista de titulares: hora, titular enlazado al medio original, medio y resumen opcional.
	Si otros medios dan la misma noticia (scripts/cluster.ts), «+3 medios» los despliega.
-->
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
					<div class="m">
						{#if tag?.(item)}<span class="tag">{tag(item)}</span>{/if}
						<span>{item.source}</span>
						{#if item.also?.length}
							<details class="also">
								<summary>+{item.also.length} {item.also.length === 1 ? 'medio' : 'medios'}</summary>
								{#each item.also as other, j (other.url)}
									{j ? ' · ' : ' '}<a href={other.url} target="_blank" rel="noopener">{other.source}</a>
								{/each}
							</details>
						{/if}
					</div>
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
		gap: var(--sp-10);
		align-items: start;
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
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

		/* «+3 medios» y sus enlaces quedan por encima de esa capa para poder tocarlos. */
		.also {
			position: relative;
			z-index: 1;
		}
	}

	.news li:last-child {
		border-bottom: 0;
	}

	time {
		padding-top: var(--sp-2);
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: var(--lh-snug);
	}

	.h {
		display: block;
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-tight);
		text-wrap: pretty;
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
		gap: var(--sp-4) var(--sp-8);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	/* «+3 medios»: al abrirlo, ocupa su propia línea con los enlaces a los demás medios. */
	.also summary {
		color: var(--faint);
		cursor: pointer;
		list-style: none;
	}

	.also summary::-webkit-details-marker {
		display: none;
	}

	.also summary:hover,
	.also[open] summary {
		color: var(--muted);
	}

	.also[open] {
		flex-basis: 100%;
	}

	.also summary {
		display: inline;
	}

	.also a {
		color: var(--muted);
		text-decoration: none;
	}

	.also a:hover {
		color: var(--amber);
	}

	.tag {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
	}

	.s {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}
</style>
