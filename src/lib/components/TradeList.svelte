<!-- Sanciones y aranceles (EE. UU., UE y Reino Unido): título enlazado a su fuente, organismo, tema y fecha. -->
<script lang="ts">
	import { dm } from '#lib/format.ts';
	import type { TradeDoc } from '#lib/types.ts';

	let { items }: { items: TradeDoc[] } = $props();
</script>

{#if items.length}
	<ul class="mini">
		{#each items as d (d.id)}
			<li>
				<a class="l" href={d.url} target="_blank" rel="noopener">
					{d.title}
					<small>{d.agency} · {d.topic}{d.type ? ` · ${d.type}` : ''}</small>
				</a>
				<b>{d.date ? dm(`${d.date}T12:00:00Z`) : ''}</b>
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin documentos de sanciones ni aranceles por ahora.</p>
{/if}
