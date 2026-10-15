<!--
	Fila de recuadros con una cifra grande (<Tile>). Tres columnas por defecto; en el móvil, una debajo de otra.
	Con `cols` (una tira de 4–6 cifras, como en PAIS): todas en una fila y, en el móvil, de dos en dos, con la
	última a todo el ancho si son impares.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { cols, children }: { cols?: number; children: Snippet } = $props();
</script>

<div class="tiles" data-ui="tiles" class:strip={cols} style:--cols={cols}>
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

	.strip {
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
	}

	@media (max-width: 720px) {
		.tiles {
			grid-template-columns: minmax(0, 1fr);
		}

		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.strip > :global(:last-child:nth-child(odd)) {
			grid-column: 1 / -1;
		}
	}
</style>
