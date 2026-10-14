<!--
	Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista.
	Dentro de una <ModularGrid>, si tiene id, la cabecera lleva además el asa ⋮⋮ y el ✕.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getModular, type Span } from '#lib/layout.svelte.ts';
	import Note from './ui/Note.svelte';

	interface Props {
		title: string;
		meta?: string;
		/** Enlace «CÓDIGO ›» a la vista completa. */
		jump?: { code: string; href: string };
		children: Snippet;
		/** Pie del panel (fuente, notas). */
		note?: Snippet;
		/** Id estable del panel en la vista modular («luz», «boe»…). */
		id?: string;
	}

	let { title, meta, jump, children, note, id }: Props = $props();

	// La vista modular, si este panel está en una (si no, undefined: el panel se ve como siempre).
	const modular = getModular();
	const tools = $derived(modular && id ? modular : null);
	/** Menú del asa: subir, bajar y ancho. */
	let menu = $state(false);
	const SPANS: Span[] = [1, 2, 3];
</script>

<section class="panel">
	<header class="ph">
		<h2>{title}</h2>
		{#if meta || jump || tools}
			<div class="ph-r">
				{#if meta}<span>{meta}</span>{/if}
				{#if jump}<a class="jump" href={jump.href}>{jump.code} ›</a>{/if}
				{#if tools && id}
					<button
						class="tool grip"
						type="button"
						draggable="true"
						aria-expanded={menu}
						aria-label="Mover o cambiar el ancho de {title}"
						title="Arrastra para mover · toca para más opciones"
						onclick={() => (menu = !menu)}
						ondragstart={(e) => {
							e.dataTransfer?.setData('text/plain', id);
							tools.dragging = id;
						}}
						ondragend={() => (tools.dragging = null)}>⋮⋮</button
					>
					<button class="tool" type="button" aria-label="Ocultar {title}" title="Ocultar" onclick={() => tools.hide(id)}>✕</button>
				{/if}
			</div>
		{/if}
	</header>
	{#if tools && id && menu}
		<div class="menu">
			<button type="button" onclick={() => tools.move(id, -1)} aria-label="Subir {title}">↑</button>
			<button type="button" onclick={() => tools.move(id, 1)} aria-label="Bajar {title}">↓</button>
			<!-- En el móvil hay una sola columna: el ancho no se ofrece. -->
			<span class="width">
				Ancho
				{#each SPANS as n (n)}
					<button type="button" aria-pressed={tools.span(id) === n} onclick={() => tools.setSpan(id, n)}>{n}</button>
				{/each}
			</span>
		</div>
	{/if}
	{@render children()}
	{#if note}
		<Note>{@render note()}</Note>
	{/if}
</section>

<style>
	/* container-type: lo de dentro se adapta al ancho del panel con @container, no al de la pantalla. */
	.panel {
		background: var(--panel);
		min-width: 0;
		container-type: inline-size;
	}

	.ph {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	h2 {
		margin: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		color: var(--amber);
	}

	.ph-r {
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	/* Controles de la vista modular: discretos, del color del texto terciario. */
	.tool {
		background: none;
		border: 0;
		padding: 0;
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: 1;
		cursor: pointer;
	}

	.tool:hover {
		color: var(--amber);
	}

	.grip {
		cursor: grab;
		letter-spacing: calc(-1 * var(--track-code));
	}

	/* En pantallas táctiles, 44 px pulsables sin que la cabecera crezca (como el enlace .jump). */
	@media (pointer: coarse) {
		.tool {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
			padding-inline: var(--sp-8);
			margin: calc(-1 * var(--sp-14)) calc(-1 * var(--sp-4));
		}
	}

	.menu {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4) var(--sp-10);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
		background: var(--raise);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.width {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
	}

	@media (max-width: 720px) {
		.width {
			display: none;
		}
	}

	.menu button {
		background: none;
		border: var(--border);
		padding: 0 var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.menu button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	.jump {
		color: var(--muted);
		text-decoration: none;
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}

	.jump:hover {
		color: var(--amber);
	}

	/* En pantallas táctiles el enlace gana 44 px de alto pulsable; el margen negativo evita que la cabecera crezca. */
	@media (pointer: coarse) {
		.jump {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
			padding-inline: var(--pad-x);
			margin: calc(-1 * var(--sp-14)) calc(-1 * var(--pad-x));
		}
	}

	/* En «encajar en pantalla» el panel hace scroll por dentro: la cabecera se queda arriba. */
	:global(html[data-fit]) .ph {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--panel);
	}
</style>
