<!--
	Rejilla de la vista modular: pinta los paneles en el orden guardado, con su ancho (1, 2 o 3 columnas),
	y deja ocultarlos, volver a mostrarlos y reordenarlos. Cada panel es un snippet con un <Panel id="…">:
	el panel lee el contexto que se pone aquí y muestra en su cabecera el asa ⋮⋮ y el ✕.
	En escritorio se arrastra desde el asa (arrastrar y soltar nativo de HTML); en el móvil, el asa abre
	↑ ↓ y el ancho, porque arrastrar con el dedo es incómodo.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setModular, type ViewLayout } from '#lib/layout.svelte.ts';

	interface Props {
		layout: ViewLayout;
		/** Un snippet por id de módulo. */
		panels: Record<string, Snippet>;
	}

	let { layout, panels }: Props = $props();

	// svelte-ignore state_referenced_locally
	setModular(layout);

	/** Panel sobre el que se va a soltar el que se arrastra. */
	let over = $state<string | null>(null);

	function dragover(e: DragEvent, id: string) {
		if (!layout.dragging || layout.dragging === id) return;
		e.preventDefault();
		over = id;
	}

	function drop(e: DragEvent, id: string) {
		e.preventDefault();
		const moving = layout.dragging;
		over = null;
		layout.dragging = null;
		if (!moving || moving === id) return;
		// Si venía de antes, se queda detrás del panel de destino; si venía de después, delante.
		const order = layout.layout.order;
		layout.place(moving, id, order.indexOf(moving) < order.indexOf(id));
	}
</script>

<div class="bar">
	<span class="lbl">Modular</span>
	{#if layout.hidden.length}
		<span>Ocultos:</span>
		{#each layout.hidden as m (m.id)}
			<button type="button" onclick={() => layout.show(m.id)} title="Volver a mostrar">+ {m.title}</button>
		{/each}
	{/if}
	<button type="button" class="reset" onclick={() => layout.reset()}>Restablecer</button>
</div>

<div class="mgrid">
	{#each layout.visible as id (id)}
		{#if panels[id]}
			<div
				class="cell s{layout.span(id)}"
				class:over={over === id}
				role="group"
				aria-label={layout.title(id)}
				ondragover={(e) => dragover(e, id)}
				ondragleave={() => over === id && (over = null)}
				ondrop={(e) => drop(e, id)}
			>
				{@render panels[id]()}
			</div>
		{/if}
	{/each}
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4) var(--sp-10);
		margin-bottom: var(--sp-8);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.lbl {
		color: var(--amber);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	button {
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	button:hover {
		color: var(--amber);
	}

	.reset {
		margin-left: auto;
	}

	.mgrid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-auto-flow: dense;
		gap: var(--hair);
		background: var(--line);
		border: var(--border);
	}

	.cell {
		background: var(--panel);
		min-width: 0;
	}

	.s2 {
		grid-column: span 2;
	}

	.s3 {
		grid-column: span 3;
	}

	/* Donde se soltará el panel: un contorno ámbar fino por dentro. */
	.over {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}

	@media (max-width: 1100px) {
		.mgrid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.s3 {
			grid-column: span 2;
		}
	}

	@media (max-width: 720px) {
		.mgrid {
			grid-template-columns: minmax(0, 1fr);
		}

		.s2,
		.s3 {
			grid-column: auto;
		}
	}
</style>
