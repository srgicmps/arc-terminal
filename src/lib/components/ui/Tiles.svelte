<!--
	Fila de recuadros con una cifra grande (<Tile>). Tres columnas por defecto (o las de `cols`); en el móvil,
	una debajo de otra, o de dos en dos si son cuatro o más.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { cols = 3, children }: { cols?: number; children: Snippet } = $props();
</script>

<div class="tiles" class:pairs={cols >= 4} style:--cols={cols}>
	{@render children()}
</div>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: var(--hair);
		background: var(--line);
		border-bottom: var(--border);
	}

	@media (max-width: 720px) {
		.tiles {
			grid-template-columns: minmax(0, 1fr);
		}
		.tiles.pairs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
