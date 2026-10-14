<!-- Lista de documentos oficiales (Federal Register): tipo, título, organismo y resumen. -->
<script lang="ts">
	import { period } from '#lib/format.ts';
	import type { FedRegDoc } from '#lib/types.ts';

	let { docs }: { docs: FedRegDoc[] } = $props();
</script>

{#if docs.length}
	<ol class="docs">
		{#each docs as d (d.id)}
			<li>
				<p class="k">
					<span class="type">{d.subtype || d.type}</span>
					<time datetime={d.date}>{period(d.date)}</time>
				</p>
				<a class="title" href={d.url} target="_blank" rel="noopener">{d.title}</a>
				{#if d.abstract}<p class="abs">{d.abstract}</p>{/if}
				<p class="m">
					<span>{d.agencies.join(' · ')}</span>
					{#if d.pdf}<a href={d.pdf} target="_blank" rel="noopener">PDF</a>{/if}
				</p>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.docs {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		padding: var(--sp-9) var(--pad-x);
		border-bottom: var(--border);
	}

	li:last-child {
		border-bottom: 0;
	}

	.k {
		margin: 0 0 var(--sp-3);
		display: flex;
		justify-content: space-between;
		gap: var(--sp-10);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.type {
		color: var(--amber);
	}

	time {
		color: var(--faint);
		text-transform: none;
	}

	.title {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-snug);
	}

	.title:hover {
		color: var(--amber);
	}

	.abs {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}

	.m {
		margin: var(--sp-4) 0 0;
		display: flex;
		justify-content: space-between;
		gap: var(--sp-10);
		color: var(--faint);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.m a {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		text-decoration: none;
	}
</style>
