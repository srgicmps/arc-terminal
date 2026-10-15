<!--
	ⓘ con la definición de un término (src/lib/glossary.ts; en modo Sencillo, la explicación de src/lib/explain.ts). Se pone detrás del texto: {label}<Term of={label} />.
	`of` es el texto que se ve («Euríbor a 12 meses») o el id de la entrada («euribor»); si el glosario no lo
	conoce, no pinta nada. La definición sale al pasar el ratón, al enfocar con el teclado o al tocar el ⓘ, y
	se cierra con Esc, tocando fuera o al desplazar. Va con posición fija para que no la recorte una tabla con
	desplazamiento.
-->
<script lang="ts">
	import { explain } from '#lib/explain.ts';
	import { lookup } from '#lib/glossary.ts';
	import { isSimple } from '#lib/modo.svelte.ts';

	let { of }: { of: string | null | undefined } = $props();

	// En Sencillo, la explicación completa (qué es, por qué importa, cómo leerlo; src/lib/explain.ts) y para más
	// términos; en Terminal, solo la definición del glosario, como siempre.
	const entry = $derived.by(() => {
		if (isSimple()) return explain(of);
		const g = lookup(of);
		return g && { term: g.term, what: g.def, why: undefined, how: undefined };
	});
	const id = $props.id();

	let button = $state<HTMLButtonElement>();
	let open = $state(false);
	/** Abierta con un toque o un clic: no se cierra al sacar el ratón. */
	let pinned = $state(false);
	let pos = $state({ top: 0, left: 0, above: false });

	let tip = $state<HTMLElement>();

	/**
	 * Debajo del ⓘ y centrada; si choca con un borde de la pantalla se desplaza, y si no cabe debajo, va
	 * encima. Se mide la burbuja ya pintada, así que se llama otra vez cuando aparece.
	 */
	function place() {
		if (!button) return;
		const r = button.getBoundingClientRect();
		const margin = parseFloat(getComputedStyle(button).getPropertyValue('--gutter')) || 16;
		const w = tip?.offsetWidth ?? 0;
		const h = tip?.offsetHeight ?? 0;
		const left = Math.min(Math.max(margin, r.left + r.width / 2 - w / 2), window.innerWidth - w - margin);
		const above = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0;
		pos = { top: above ? r.top - 6 : r.bottom + 6, left, above };
	}

	// En cuanto la burbuja existe, se coloca con su tamaño real.
	$effect(() => {
		if (open && tip) place();
	});

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
		// En captura y con preventDefault: la barra ve que Esc ya ha cerrado algo y no vuelve a la portada.
		const key = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			close();
		};
		const outside = (e: PointerEvent) => !button?.contains(e.target as Node) && close();
		window.addEventListener('keydown', key, true);
		window.addEventListener('pointerdown', outside);
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		return () => {
			window.removeEventListener('keydown', key, true);
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
			bind:this={tip}
			{id}
			role="tooltip"
			class="tip"
			class:above={pos.above}
			style:top="{pos.top}px"
			style:left="{pos.left}px"
		>
			<b>{entry.term}</b>
			{entry.what}
			{#if entry.why}<span class="more"><em>Por qué importa:</em> {entry.why}</span>{/if}
			{#if entry.how}<span class="more"><em>Cómo leerlo:</em> {entry.how}</span>{/if}
		</span>
	{/if}
{/if}

<style>
	.i {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: var(--sp-2);
		padding: 0;
		border: 0;
		background: none;
		color: var(--faint);
		font-family: var(--sans);
		font-size: var(--fs-xxs);
		font-weight: var(--fw-regular);
		line-height: 1;
		letter-spacing: 0;
		text-transform: none;
		vertical-align: baseline;
		cursor: help;
	}

	.i:focus-visible,
	.i[aria-expanded='true'] {
		color: var(--amber);
	}

	@media (hover: hover) {
		.i:hover {
			color: var(--amber);
		}
	}

	/* En pantallas táctiles, la zona que se puede tocar crece sin mover nada. */
	@media (pointer: coarse) {
		.i {
			position: relative;
			/* Sin el mínimo de 44 px de app.css: si no, la ⓘ alarga la línea de su etiqueta. */
			min-height: 0;
		}

		.i::after {
			content: '';
			position: absolute;
			inset: calc((var(--touch) - 1em) / -2);
		}
	}

	.tip {
		position: fixed;
		z-index: var(--z-popover);
		width: max-content;
		max-width: min(40ch, calc(100vw - 2 * var(--gutter)));
		padding: var(--sp-6) var(--sp-8);
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

	.more {
		display: block;
		margin-top: var(--sp-4);
		color: var(--muted);
	}

	.more em {
		font-style: normal;
		color: var(--fg);
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
