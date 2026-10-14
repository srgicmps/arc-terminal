<!--
	ⓘ con la definición de un término (src/lib/glossary.ts). Se pone detrás del texto: {label}<Term of={label} />.
	`of` es el texto que se ve («Euríbor a 12 meses») o el id de la entrada («euribor»); si el glosario no lo
	conoce, no pinta nada. La definición sale al pasar el ratón, al enfocar con el teclado o al tocar el ⓘ, y
	se cierra con Esc, tocando fuera o al desplazar. Va con posición fija para que no la recorte una tabla con
	desplazamiento.
-->
<script lang="ts">
	import { lookup } from '#lib/glossary.ts';

	let { of }: { of: string | null | undefined } = $props();

	const entry = $derived(lookup(of));
	const id = $props.id();

	let button = $state<HTMLButtonElement>();
	let open = $state(false);
	/** Abierta con un toque o un clic: no se cierra al sacar el ratón. */
	let pinned = $state(false);
	let pos = $state({ top: 0, left: 0, above: false });

	function place() {
		if (!button) return;
		const r = button.getBoundingClientRect();
		const width = Math.min(280, window.innerWidth - 16);
		const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
		// Debajo del ⓘ; si no cabe, encima.
		const above = r.bottom + 120 > window.innerHeight && r.top > 140;
		pos = { top: above ? r.top - 6 : r.bottom + 6, left, above };
	}

	function show() {
		place();
		open = true;
	}

	function hide() {
		if (!pinned) open = false;
	}

	function toggle(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (open && pinned) {
			open = pinned = false;
		} else {
			pinned = true;
			show();
		}
	}

	function close() {
		open = pinned = false;
	}

	// Mientras está abierta: se cierra con Esc, tocando fuera o si se desplaza la página.
	$effect(() => {
		if (!open) return;
		const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
		const outside = (e: PointerEvent) => !button?.contains(e.target as Node) && close();
		window.addEventListener('keydown', key);
		window.addEventListener('pointerdown', outside);
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		return () => {
			window.removeEventListener('keydown', key);
			window.removeEventListener('pointerdown', outside);
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
		};
	});
</script>

{#if entry}
	<button
		bind:this={button}
		type="button"
		class="i"
		aria-label="Qué es: {entry.term}"
		aria-expanded={open}
		aria-describedby={open ? id : undefined}
		onclick={toggle}
		onmouseenter={show}
		onmouseleave={hide}
		onfocus={show}
		onblur={close}>ⓘ</button
	>
	{#if open}
		<span
			{id}
			role="tooltip"
			class="tip"
			class:above={pos.above}
			style:top="{pos.top}px"
			style:left="{pos.left}px"
		>
			<b>{entry.term}</b>
			{entry.def}
		</span>
	{/if}
{/if}

<style>
	.i {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: var(--sp-4);
		padding: 0;
		border: 0;
		background: none;
		color: var(--faint);
		font-family: var(--sans);
		font-size: var(--fs-xs);
		font-weight: var(--fw-regular);
		line-height: 1;
		letter-spacing: 0;
		text-transform: none;
		vertical-align: baseline;
		cursor: help;
	}

	.i:hover,
	.i[aria-expanded='true'] {
		color: var(--amber);
	}

	/* En pantallas táctiles, la zona que se puede tocar crece sin mover nada. */
	@media (pointer: coarse) {
		.i {
			position: relative;
		}

		.i::after {
			content: '';
			position: absolute;
			inset: calc((var(--touch) - 1em) / -2);
		}
	}

	.tip {
		position: fixed;
		z-index: 50;
		width: min(280px, calc(100vw - var(--sp-16)));
		padding: var(--sp-8) var(--sp-10);
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-s);
		font-weight: var(--fw-regular);
		line-height: var(--lh-text);
		letter-spacing: 0;
		text-align: left;
		text-transform: none;
		white-space: normal;
	}

	.tip.above {
		transform: translateY(-100%);
	}

	.tip b {
		display: block;
		margin-bottom: var(--sp-3);
		color: var(--amber);
		font-weight: var(--fw-medium);
	}
</style>
