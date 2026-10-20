<!--
	Tabla densa con desplazamiento horizontal si no cabe. Dentro van <thead> y <tbody>, como en un <table>.
	Clases para las celdas: .l (alineada a la izquierda; la primera columna ya lo está), .name (nombre en
	letra de texto; <a class="name"> enlaza sin subrayado y se pone ámbar al pasar), .sub (detalle gris tras el nombre,
	se oculta en paneles estrechos), .mut (gris), .per (periodo, se oculta por debajo de 440 px) y .spark (columna
	del minigráfico, 80 px, se oculta por debajo de 300 px). Una fila con <tr class="hl"> va resaltada con el
	fondo del acento (p. ej. el día pedido en la barra, M49).
	Los estilos son globales (:global) porque las celdas las escribe quien usa la tabla, no este componente.
	Debajo, un «⤓ CSV» discreto descarga la tabla tal y como se ve (en el ordenador, al pasar por encima);
	con csv={false} no sale. El archivo se llama como el panel y la fecha.
-->
<script module lang="ts">
	// Un solo ResizeObserver para todas las tablas de la vista. Avisa ya colocado (al montar, al cambiar de tamaño y
	// al llegar filas), y en cada aviso se miden todas las tablas antes de que Svelte escriba nada en la página. Con
	// uno por tabla, lo que escribía una obligaba al navegador a recalcularlo todo antes de medir la siguiente.
	const checks = new Map<Element, () => void>();
	let observer: ResizeObserver | undefined;

	function watch(els: Element[], check: () => void): () => void {
		observer ??= new ResizeObserver((entries) => {
			for (const run of new Set(entries.map((e) => checks.get(e.target)))) run?.();
		});
		for (const el of els) {
			checks.set(el, check);
			observer.observe(el);
		}
		return () => {
			for (const el of els) {
				checks.delete(el);
				observer?.unobserve(el);
			}
		};
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cellText, csvName, toCsv } from '#lib/csv.ts';
	import { fadeSide } from '#lib/edgefade.ts';

	interface Props {
		/** Alto máximo (p. ej. «420px»): a partir de ahí, la tabla se desplaza en vertical. */
		maxHeight?: string;
		/** Botón «⤓ CSV»: sale salvo con csv={false}. */
		csv?: boolean;
		children: Snippet;
	}

	let { maxHeight, csv = true, children }: Props = $props();

	let table: HTMLTableElement;
	let scroller: HTMLDivElement;
	// Si la tabla no cabe y se desplaza, el teclado tiene que poder llegar a ella (y un lector, saber qué es): la caja
	// se vuelve una región enfocable con el nombre del panel. Si cabe, no añade una parada más al Tab.
	let scrolls = $state(false);
	let name = $state('Tabla');
	// Lado por el que sigue la tabla si es más ancha que el panel («start», «end», «both» o nada): el fundido de app.css.
	let fade = $state<ReturnType<typeof fadeSide>>('');
	const updateFade = () => (fade = fadeSide(scroller.scrollLeft, scroller.clientWidth, scroller.scrollWidth));
	// El fundido se calcula aquí, con el ResizeObserver compartido, y no con use:edgeFade, que medía la tabla nada más
	// montarla y obligaba a calcular la página a medio montar.
	$effect(() =>
		watch([scroller, table], () => {
			scrolls = scroller.scrollWidth > scroller.clientWidth + 1 || scroller.scrollHeight > scroller.clientHeight + 1;
			name = cellText(table.closest('section')?.querySelector('h2')?.textContent ?? '') || 'Tabla';
			updateFade();
		})
	);

	/** Descarga la tabla en CSV: cabecera y filas tal y como se ven, con el nombre del panel y la fecha de hoy. */
	function download() {
		const rows = [...table.rows].map((tr) => [...tr.cells].map((c) => cellText(c.textContent ?? '')));
		const title = cellText(table.closest('section')?.querySelector('h2')?.textContent ?? '');
		const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
		const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = csvName(title, today);
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<!-- Si es más ancha que el panel (móvil), un fundido leve en el lado por el que sigue: data-fade, al montar y al deslizar. -->
<div class="wrap" data-ui="table">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (solo cuando se desplaza: así se mueve con las flechas) -->
	<div
		class="scroll"
		class:capped={maxHeight}
		style:max-height={maxHeight}
		bind:this={scroller}
		tabindex={scrolls ? 0 : undefined}
		role={scrolls ? 'region' : undefined}
		aria-label={scrolls ? name : undefined}
		data-fade={fade || undefined}
		onscroll={updateFade}
	>
		<table class="t" bind:this={table}>
			{@render children()}
		</table>
	</div>
	{#if csv}
		<button type="button" class="csv" onclick={download} title="Descargar la tabla en CSV (Excel)">⤓ CSV</button>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}

	.csv {
		display: block;
		margin-left: auto;
		padding: var(--sp-2) var(--pad-x);
		background: none;
		border: 0;
		color: var(--faint);
		font: inherit;
		font-size: var(--fs-xs);
		letter-spacing: var(--track-caps);
		cursor: pointer;
	}

	.csv:focus-visible {
		color: var(--amber);
	}

	@media (hover: hover) {
		.csv:hover {
			color: var(--amber);
		}
	}

	/* Con ratón, solo al pasar por encima de la tabla (o al llegar con el teclado). */
	@media (hover: hover) {
		.csv {
			opacity: 0;
		}
		.wrap:hover .csv,
		.csv:focus-visible {
			opacity: 1;
		}
	}

	.scroll {
		position: relative;
		overflow-x: auto;
	}

	.capped {
		overflow-y: auto;
	}

	/* Con alto máximo, la cabecera se queda fija arriba al hacer scroll. Con border-collapse el borde del th se
	   iría con las filas, así que la línea de abajo es una sombra de --hair. */
	.capped :global(.t thead th) {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--panel);
		border-bottom: 0;
		box-shadow: inset 0 calc(-1 * var(--hair)) 0 var(--line);
	}

	:global {
		.t {
			width: 100%;
			border-collapse: collapse;
			font-size: var(--fs-s);
		}
		.t th,
		.t td {
			padding: var(--sp-5) var(--sp-10);
			text-align: right;
			white-space: nowrap;
			border-bottom: var(--border);
		}
		.t tbody tr:last-child td {
			border-bottom: 0;
		}
		.t tbody tr.hl td {
			background: var(--amber-soft);
		}
		.t th {
			padding-block: var(--sp-6);
			font-weight: var(--fw-regular);
			font-size: var(--fs-xs);
			letter-spacing: var(--track-caps);
			text-transform: uppercase;
			color: var(--faint);
		}
		.t th:first-child,
		.t td:first-child,
		.t .l {
			text-align: left;
		}
		.t .name {
			font-family: var(--sans);
			font-size: var(--fs-m);
		}
		.t .sub {
			margin-left: var(--sp-6);
			color: var(--muted);
			font-family: var(--sans);
			font-size: var(--fs-s);
		}
		/* Nombre que enlaza a la fuente: del color del texto y en ámbar al pasar por encima. */
		.t a.name {
			color: inherit;
			text-decoration: none;
		}
		.t a.name:hover {
			color: var(--amber);
		}
		/* Columna del minigráfico: ancho fijo y sin margen vertical. Solo las celdas: el <svg> de Spark también se
		   llama .spark y no debe heredar esto. */
		.t th.spark,
		.t td.spark {
			width: 80px;
			padding-block: 0;
		}
	}

	/* En paneles estrechos, el periodo (.per) cede su sitio al minigráfico; en los muy estrechos, también este. */
	@container (max-width: 440px) {
		:global(.t .per) {
			display: none;
		}
	}

	@container (max-width: 300px) {
		:global(.t th.spark),
		:global(.t td.spark) {
			display: none;
		}
	}

	@container (max-width: 390px) {
		:global(.t .sub) {
			display: none;
		}
	}

	/* Pantallas táctiles: la celda que empieza por un enlace o botón (y no tiene otro) crece hasta 44 px
	   y el ::after invisible del enlace la cubre entera. */
	@media (pointer: coarse) {
		:global(.t td:has(> :is(a, button):first-child):not(:has(:is(a, button) ~ :is(a, button)))) {
			position: relative;
			height: var(--touch);
		}
		:global(.t td:not(:has(:is(a, button) ~ :is(a, button))) > :is(a, button):first-child::after) {
			content: '';
			position: absolute;
			inset: 0;
		}
	}
</style>
