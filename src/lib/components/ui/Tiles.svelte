<!-- Fila de recuadros con una cifra grande (<Tile>). Tres columnas; en el móvil, una debajo de otra. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="tiles">
	{@render children()}
</div>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--hair);
		background: var(--line);
		border-bottom: var(--border);
	}

	@media (max-width: 720px) {
		.tiles {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
