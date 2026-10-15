<!--
	Menú desplegable: un botón y, al pulsarlo, una lista flotante (enlaces, botones o lo que se le pase). Se cierra al
	elegir, al pulsar fuera, con Esc o al hacer scroll. La lista va en posición fija, calculada desde el botón, para que
	no la recorte una fila con scroll (la de pestañas del móvil) y nunca se salga de la pantalla.
	Uso: <Menu label="Más opciones" cls="theme">{#snippet button()}⋯{/snippet}{#snippet children(close)}…{/snippet}</Menu>
	El botón lleva la clase `cls` para que la vista lo pinte como el resto de su fila (con :global).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		cls = '',
		ui,
		current = false,
		title,
		button,
		children
	}: {
		/** Nombre para lectores de pantalla (y título, si no hay `title`). */
		label: string;
		cls?: string;
		/** data-ui del botón, para las estéticas. */
		ui?: string;
		/** Marca el botón como la página actual (una pestaña escondida en «Más»). */
		current?: boolean;
		title?: string;
		button: Snippet;
		children: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let root: HTMLDivElement;
	let btn: HTMLButtonElement;
	let pos = $state({ top: 0, left: 0, right: 0 });
	let alignRight = $state(false);

	function toggle() {
		open = !open;
		if (!open) return;
		const r = btn.getBoundingClientRect();
		// Si el botón está en la mitad derecha, la lista se alinea a su borde derecho; si no, al izquierdo.
		alignRight = r.left + r.width / 2 > innerWidth / 2;
		pos = { top: r.bottom + 4, left: Math.max(8, r.left), right: Math.max(8, innerWidth - r.right) };
	}

	const close = () => {
		// Si el foco estaba dentro de la lista, vuelve al botón: si no, se quedaría en <body>.
		if (open && root?.contains(document.activeElement) && document.activeElement !== btn) btn.focus();
		open = false;
	};

	function onWindowClick(e: MouseEvent) {
		if (open && !root.contains(e.target as Node)) open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.stopPropagation();
			e.preventDefault();
			open = false;
			btn.focus();
			return;
		}
		// Flechas, Inicio y Fin recorren las opciones (y no desplazan la página, que cerraría el menú).
		const items = [...root.querySelectorAll<HTMLElement>('.pop a[href], .pop button:not([disabled]), .pop input, .pop select')];
		if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
		if ((e.target as HTMLElement).closest('input, select, textarea, [role="radiogroup"]')) return;
		e.preventDefault();
		const at = items.indexOf(document.activeElement as HTMLElement);
		const next =
			e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
		items[next].focus();
	}

	// Al salir con Tab (el foco se va a otro elemento, fuera del botón y de la lista), se cierra. Sin destino (un
	// toque en Safari, que no enfoca los botones) no se toca: lo cierran el clic fuera o la opción elegida.
	function onFocusOut(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (open && to && !root.contains(to)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onscroll={close} onresize={close} />

<div class="menu-root" bind:this={root} onkeydowncapture={onKey} onfocusout={onFocusOut}>
	<button
		bind:this={btn}
		type="button"
		class={cls}
		data-ui={ui}
		aria-expanded={open}
		aria-label={label}
		aria-current={current ? 'page' : undefined}
		title={title ?? label}
		onclick={toggle}
	>
		{@render button()}
	</button>
	{#if open}
		<div
			class="pop"
			data-ui="menu"
			style:top="{pos.top}px"
			style:left={alignRight ? undefined : `${pos.left}px`}
			style:right={alignRight ? `${pos.right}px` : undefined}
		>
			{@render children(close)}
		</div>
	{/if}
</div>

<style>
	.menu-root {
		display: contents;
	}

	.pop {
		position: fixed;
		z-index: 30;
		display: flex;
		flex-direction: column;
		min-width: 12rem;
		max-width: calc(100vw - 2 * var(--sp-8));
		max-height: 70vh;
		overflow-y: auto;
		padding: var(--sp-4) 0;
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-pop);
		font-size: var(--fs-s);
	}

	/* Cada opción, una fila: texto a la izquierda y, si lleva, un detalle gris a la derecha. */
	.pop :global(:is(a, button)) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-12);
		min-height: var(--control-h);
		padding: 0 var(--sp-12);
		background: none;
		border: 0;
		color: var(--fg);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.pop :global(:is(a, button):focus-visible) {
		background: var(--amber-soft);
		color: var(--amber);
		outline: none;
	}

	@media (hover: hover) {
		.pop :global(:is(a, button):hover) {
			background: var(--amber-soft);
			color: var(--amber);
			outline: none;
		}
	}

	.pop :global([aria-current='page']),
	.pop :global([aria-pressed='true']) {
		color: var(--amber);
	}

	.pop :global(small) {
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.pop :global(hr) {
		margin: var(--sp-4) 0;
		border: 0;
		border-top: var(--border);
	}
</style>
