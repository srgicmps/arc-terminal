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
	import { maxCols, packGrid } from '#lib/layout.ts';

	interface Props {
		layout: ViewLayout;
		/** Un snippet por id de módulo. */
		panels: Record<string, Snippet>;
	}

	let { layout, panels }: Props = $props();

	// svelte-ignore state_referenced_locally
	setModular(layout);

	// Columnas según los paneles que hay y el ancho de la ventana (layout.ts): sin columnas vacías ni huecos.
	let width = $state(0);
	const shown = $derived(layout.visible.filter((id) => panels[id]));
	const grid = $derived(packGrid(shown.map((id) => layout.span(id)), maxCols(width)));

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

<svelte:window bind:innerWidth={width} />

<div class="mgrid" style:grid-template-columns="repeat({grid.cols}, minmax(0, 1fr))">
	{#each shown as id, i (id)}
		<div
			class="cell"
			style:grid-column="span {grid.spans[i]}"
			class:over={over === id}
			role="group"
			aria-label={layout.title(id)}
			ondragover={(e) => dragover(e, id)}
			ondragleave={() => over === id && (over = null)}
			ondrop={(e) => drop(e, id)}
		>
			{@render panels[id]()}
		</div>
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

	/* Una línea discreta: «Modular» y «Restablecer» en gris; solo se encienden al pasar el ratón. */
	.lbl {
		color: var(--muted);
	}

	button {
		background: none;
		border: 0;
		padding: 0;
		color: var(--faint);
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
		gap: var(--grid-gap);
		background: var(--grid-fill);
		border: var(--grid-edge);
	}

	/* Cada panel llena su celda: en una fila, todos acaban a la misma altura. */
	/* Como las columnas de app.css: fondo y separación según la estética (tokens --grid-* y --col-fill). */
	.cell {
		display: flex;
		flex-direction: column;
		background: var(--col-fill);
		min-width: 0;
	}

	.cell > :global(.panel) {
		flex: 1;
	}

	/* «Encajar en pantalla»: la rejilla llena el alto que queda (si no cabe, hace scroll la vista). */
	@media (min-width: 1280px) {
		:global(html[data-fit]) .mgrid:last-child {
			flex: 1 0 auto;
		}
	}

	/* Donde se soltará el panel: un contorno ámbar fino por dentro. */
	.over {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}
</style>
