<!-- Cabecera de cada vista: código en ámbar, título, de dónde salen los datos y, con `summary`, el resumen en una
	línea hecho con los datos (src/lib/summary.ts). -->
<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { hiddenPanels, modo, setAll } from '#lib/modo.svelte.ts';
	import { hasTrim } from '#lib/simple.ts';

	interface Props {
		code: string;
		title: string;
		sub?: string;
		/** Contenido a la derecha (fecha, botones…). */
		aside?: Snippet;
		/** Resumen en una línea con los datos de la vista («Inflación euro baja al 2,1 % · …»). */
		summary?: string;
		/** Modo Sencillo: los datos clave contados en frases (src/lib/plain.ts). Ahí sustituyen al resumen (por CSS). */
		plain?: string[];
	}

	let { code, title, sub, aside, summary, plain }: Props = $props();

	// Modo Sencillo: «Ver todos» vuelve a enseñar los paneles que el modo oculta en esta vista. Al cambiar de
	// vista, se vuelve a lo esencial.
	$effect(() => {
		void page.url.pathname;
		setAll(false);
	});

	// El HTML prerenderizado no sabe el modo (sale en Terminal), así que lleva a la vez el resumen y las frases de
	// Sencillo, y el CSS enseña lo que toca según <html data-modo>, que app.html pone antes de pintar. Igual con
	// «Ver todos»: la línea ya está en el HTML de las vistas con lista, con la clase .pre hasta que arranca Svelte,
	// y el CSS solo la enseña si ese HTML trae algún panel que Sencillo esconde (PAIS sin país no trae ninguno). El
	// número de paneles ocultos llega al arrancar (lo apuntan los paneles). Así la cabecera ya no cambia de alto al
	// cargar; los títulos claros de los paneles (plainTitle) sí entran al arrancar.
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
	const hidden = $derived(hiddenPanels.size);
	const more = $derived(hidden > 0 || (!mounted && hasTrim(page.route.id)));
</script>

<svelte:head>
	<title>{code} · Arc Terminal</title>
</svelte:head>

<div class="vh" data-ui="view-head">
	<div>
		<h1 data-ui="view-title"><span class="code" data-ui="view-code">{code}</span>{title}</h1>
		{#if sub}<p data-ui="view-sub">{sub}</p>{/if}
		{#if plain?.length}
			<ul class="plain" data-ui="view-sum">
				{#each plain as line (line)}<li>{line}</li>{/each}
			</ul>
		{/if}
		<!-- .alt: hay frases de Sencillo, que en ese modo ocupan su lugar. -->
		{#if summary}<p class="sum" class:alt={!!plain?.length} data-ui="view-sum">{summary}</p>{/if}
		{#if more}
			<p class="more" class:pre={!mounted}>
				{modo.all
					? 'Ves todos los paneles.'
					: `Ves lo esencial: ${hidden ? `${hidden} ${hidden === 1 ? 'panel más' : 'paneles más'}` : 'hay más paneles'} en el modo completo.`}
				<!-- Hasta que arranca Svelte no hace nada: deshabilitado (con el mismo aspecto) para no prometer lo que no hace. -->
				<button type="button" disabled={!mounted} aria-pressed={modo.all} onclick={() => setAll(!modo.all)}>{modo.all ? 'Ver solo lo esencial' : 'Ver todos'}</button>
			</p>
		{/if}
	</div>
	{#if aside}<div class="vh-r">{@render aside()}</div>{/if}
</div>

<style>
	.vh {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--sp-8) var(--sp-24);
		padding-block: var(--sp-2) var(--sp-12);
	}

	h1 {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: var(--sp-12);
		font-family: var(--sans);
		font-weight: var(--fw-medium);
		font-size: var(--fs-xl);
		text-wrap: balance;
	}

	.code {
		font-family: var(--mono);
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-code);
		color: var(--amber);
	}

	p {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	/* El resumen se lee antes que las fuentes: en el color del texto, un punto más grande. */
	.sum {
		color: var(--fg);
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
	}

	/* Modo Sencillo: los datos clave en frases, en el color del texto y con la letra de los textos. */
	.plain {
		margin: var(--sp-8) 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--sp-4);
		max-width: 72ch;
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
		color: var(--fg);
	}

	/* Sencillo o Terminal: el HTML trae el resumen y las frases, y aquí se elige según <html data-modo>. Sin
	   data-modo (sin JavaScript), como en Terminal. */
	:global(html:not([data-modo='sencillo'])) .plain,
	:global(html:not([data-modo='sencillo'])) .more,
	:global(html[data-modo='sencillo']) .sum.alt {
		display: none;
	}

	/* Antes de arrancar, «Ver todos» solo si el HTML trae algún panel que Sencillo esconde (sin data-essential): si
	   no, al arrancar no habría ninguno oculto y la línea se iría, y todo lo de debajo subiría. */
	:global(main:not(:has([data-ui='panel']:not([data-essential])))) .more.pre {
		display: none;
	}

	/* Modo Sencillo: cuántos paneles quedan fuera y el botón para verlos, discreto, como un enlace. */
	.more button {
		margin-left: var(--sp-4);
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber-dim);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: var(--sp-2);
		cursor: pointer;
	}

	@media (hover: hover) {
		.more button:hover {
			color: var(--amber);
		}
	}

	.vh-r {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>
