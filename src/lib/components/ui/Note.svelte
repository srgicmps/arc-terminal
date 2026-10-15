<!-- Nota al pie de un panel: fuente de los datos, aclaraciones. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<p class="pnote" data-ui="note">{@render children()}</p>

<style>
	.pnote {
		margin: 0;
		padding: var(--sp-8) var(--pad-x) var(--sp-10);
		border-top: var(--border);
		color: var(--faint);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.pnote :global(a) {
		color: var(--muted);
	}
</style>
