<!--
	Bloque plegable (<details>) con su marcador ▸ / ▾ en --faint. Dos formas:
	- inline: una línea de texto pequeña dentro de otra («+3 medios» de NewsList).
	- row (por defecto): una fila de lista que se despliega debajo (canales RSS de STATUS).
	Uso: <Disclosure>{#snippet summary()}+3 medios{/snippet}…contenido…</Disclosure>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		summary: Snippet;
		children: Snippet;
		inline?: boolean;
		open?: boolean;
	}

	let { summary, children, inline = false, open = $bindable(false) }: Props = $props();
</script>

<details class:inline bind:open>
	<summary>{@render summary()}</summary>
	{@render children()}
</details>

<style>
	summary {
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::before {
		content: '▸';
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	details[open] > summary::before {
		content: '▾';
	}

	/* Fila: el marcador ocupa un hueco fijo (--sp-12), así el contenido puede sangrarse igual. */
	details:not(.inline) > summary {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-2) var(--sp-10);
		padding: var(--sp-6) var(--sp-10);
	}

	details:not(.inline) > summary::before {
		width: var(--sp-12);
		margin-right: calc(-1 * var(--sp-10));
	}

	details:not(.inline)[open] > summary {
		background: var(--raise);
	}

	@media (hover: hover) {
		details:not(.inline) > summary:hover {
			background: var(--raise);
		}
	}

	/* En línea: texto pequeño en --faint que se aclara al pasar o abrir. */
	.inline > summary {
		display: inline;
		color: var(--faint);
	}

	.inline > summary::before {
		margin-right: var(--sp-4);
	}

	.inline[open] > summary {
		color: var(--muted);
	}

	@media (hover: hover) {
		.inline > summary:hover {
			color: var(--muted);
		}
	}

	/* En táctil, una capa invisible da al texto la altura de una zona táctil (--touch), sin mover nada. */
	@media (pointer: coarse) {
		.inline > summary {
			position: relative;
		}

		.inline > summary::after {
			content: '';
			position: absolute;
			inset: calc((100% - var(--touch)) / 2) calc(-1 * var(--sp-8));
		}
	}
</style>
