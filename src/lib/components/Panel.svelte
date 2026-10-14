<!--
	Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista.
	El título es un botón: al pulsarlo (o con M cuando tiene el foco), el panel se maximiza sobre la vista
	con el fondo atenuado. Se maximiza el mismo <section>, sin volver a montar el contenido (TradingView,
	estados…). Esc, ✕ o tocar fuera lo cierran, y el foco vuelve al título.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ShareSource } from '#lib/share.ts';
	import Note from './ui/Note.svelte';
	import Share from './ui/Share.svelte';

	interface Props {
		title: string;
		meta?: string;
		/** Enlace «CÓDIGO ›» a la vista completa. */
		jump?: { code: string; href: string };
		/** Botón «Compartir»: los datos, o una función que los da al pulsar. Sin `url`, la página actual. */
		share?: ShareSource;
		children: Snippet;
		/** Pie del panel (fuente, notas). */
		note?: Snippet;
	}

	let { title, meta, jump, share, children, note }: Props = $props();

	let max = $state(false);
	let titleButton: HTMLButtonElement;
	let closeButton = $state<HTMLButtonElement>();

	function open() {
		max = true;
	}

	function close() {
		max = false;
		titleButton?.focus();
	}

	/** M con el foco en el título: abre o cierra. No llega a la barra de comandos (que escribiría la m). */
	function titleKeydown(e: KeyboardEvent) {
		if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			e.stopPropagation();
			if (max) close();
			else open();
		}
	}

	// Mientras está maximizado: Esc cierra (en captura, antes que el Esc global de la barra, que llevaría
	// a la portada), la página de detrás no se desplaza y el foco va al ✕.
	$effect(() => {
		if (!max) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopImmediatePropagation();
			close();
		};
		window.addEventListener('keydown', onKey, { capture: true });
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = 'hidden';
		closeButton?.focus();
		return () => {
			window.removeEventListener('keydown', onKey, { capture: true });
			root.style.overflow = overflow;
		};
	});
</script>

{#if max}
	<!-- Fondo atenuado: tocarlo cierra el panel. Para teclado ya están Esc y ✕. -->
	<div class="scrim" aria-hidden="true" onclick={close}></div>
{/if}

<section class="panel" class:max role={max ? 'dialog' : undefined} aria-modal={max ? 'true' : undefined} aria-label={max ? title : undefined}>
	<header class="ph">
		<h2>
			<button
				bind:this={titleButton}
				class="ttl"
				type="button"
				aria-expanded={max}
				title={max ? 'Volver a la vista (Esc)' : 'Ampliar el panel (M)'}
				onclick={() => (max ? close() : open())}
				onkeydown={titleKeydown}
			>
				{title}<span class="ico" aria-hidden="true">⤢</span>
			</button>
		</h2>
		{#if meta || jump || share || max}
			<div class="ph-r">
				{#if meta}<span>{meta}</span>{/if}
				{#if share}<Share source={share} />{/if}
				{#if jump}<a class="jump" href={jump.href}>{jump.code} ›</a>{/if}
				{#if max}
					<button bind:this={closeButton} class="close" type="button" aria-label="Cerrar el panel ampliado" onclick={close}>✕</button>
				{/if}
			</div>
		{/if}
	</header>
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
		z-index: var(--z-sticky);
		background: var(--panel);
	}

	/* ── Ampliar el panel ─────────────────────────────────────────────────────────────────── */

	/* El título como botón, con el mismo aspecto que el h2: sin fondo ni borde. */
	.ttl {
		all: unset;
		display: inline-flex;
		align-items: baseline;
		gap: var(--sp-6);
		cursor: pointer;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
	}

	.ttl:focus-visible {
		outline: var(--hair) solid var(--amber);
		outline-offset: var(--sp-2);
	}

	/* ⤢ solo se insinúa al pasar por encima o con el foco. */
	.ico {
		opacity: 0;
		color: var(--faint);
		font-weight: var(--fw-regular);
	}

	.ttl:hover .ico,
	.ttl:focus-visible .ico {
		opacity: 1;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		background: var(--scrim);
	}

	.max {
		position: fixed;
		inset: var(--gutter);
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		overflow: auto;
		border: var(--border);
	}

	/* Dentro, la cabecera se queda fija arriba, igual que en «encajar». */
	.max .ph {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: var(--panel);
	}

	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-sm);
		height: var(--btn-sm);
		background: none;
		border: var(--border);
		color: var(--muted);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.close:hover {
		color: var(--amber);
	}

	@media (pointer: coarse) {
		.close {
			width: var(--touch);
			height: var(--touch);
		}
	}

	/* En el móvil, a pantalla completa y sin márgenes. */
	@media (max-width: 720px) {
		.max {
			inset: 0;
			border: 0;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.max,
		.scrim {
			animation: appear var(--dur-fast) ease-out;
		}
	}

	@keyframes appear {
		from {
			opacity: 0;
		}
	}
</style>
