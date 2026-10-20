<!--
	Índice de paneles en el móvil (≤ 720 px), solo en vistas de más de 6 paneles: una fila fina de chips con
	los títulos que lleva a cada panel. Se desliza en horizontal y no cuenta para «deslizar entre vistas» (data-noswipe).
	Va fijo arriba y no ocupa sitio en la página: sale con un fundido cuando la cabecera de la vista sube fuera de
	la pantalla y se esconde al volver arriba. Los paneles se apuntan al índice al hidratar, así que si ocupara
	sitio empujaría la vista hacia abajo justo después del primer pintado (salto de unos 45 px en TOP y WS).
-->
<script lang="ts">
	import { edgeFade } from '#lib/edgefade.ts';
	import { getPanelIndex } from '#lib/panelindex.svelte.ts';

	const MIN = 7;
	const index = getPanelIndex();
	const items = $derived(index?.ordered ?? []);
	let shown = $state(false);

	function go(el: HTMLElement) {
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
	}

	/**
	 * Centinela de alto 0 justo encima de la vista (como un useIntersectionObserver de VueUse): el índice se ve
	 * cuando el centinela ha salido de la pantalla por arriba, no cuando aún no ha llegado (top < 0).
	 * Por encima de 720 px el centinela no se pinta; al girar el móvil se vuelve a observar para saber dónde está.
	 */
	function watchTop(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			shown = true;
			return;
		}
		// La última entrada: si llegan varias juntas (un scroll rápido en un móvil lento), van de la más antigua a la más nueva.
		const io = new IntersectionObserver((es) => {
			const e = es[es.length - 1];
			shown = !e.isIntersecting && e.boundingClientRect.top < 0;
		});
		io.observe(node);
		const narrow = matchMedia('(max-width: 720px)');
		const again = () => {
			io.unobserve(node);
			io.observe(node);
		};
		narrow.addEventListener('change', again);
		return () => {
			io.disconnect();
			narrow.removeEventListener('change', again);
			shown = false;
		};
	}
</script>

{#if items.length >= MIN}
	<div class="pidx-top" aria-hidden="true" {@attach watchTop}></div>
	<nav class="pidx" class:on={shown} data-ui="panel-index" aria-label="Paneles de esta vista" data-noswipe use:edgeFade>
		{#each items as item (item.id)}
			<button type="button" onclick={() => go(item.el)}><span>{item.title}</span></button>
		{/each}
	</nav>
{/if}

<style>
	.pidx,
	.pidx-top {
		display: none;
	}

	@media (max-width: 720px) {
		.pidx-top {
			display: block;
		}

		/* Fijo arriba, de lado a lado (como la barra inferior), con el mismo margen que la página. Escondido como
		   «Saltar al contenido»: transparente y por encima de la pantalla, así no tapa la cabecera ni recibe toques,
		   pero sigue en el Tab y en los lectores de pantalla, y se enseña al llegar a él con el teclado.
		   Al esconderse, primero se funde y luego sube (translate espera a la opacidad); al aparecer, baja de golpe y se funde. */
		.pidx {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			z-index: var(--z-bar);
			display: flex;
			gap: var(--sp-6);
			overflow-x: auto;
			scrollbar-width: none;
			padding-inline: max(var(--gutter), env(safe-area-inset-left, 0px))
				max(var(--gutter), env(safe-area-inset-right, 0px));
			background: var(--bg);
			border-bottom: var(--border);
			opacity: 0;
			translate: 0 -100%;
			transition:
				opacity var(--dur-fast) ease-out,
				translate 0s var(--dur-fast);
		}

		.pidx.on {
			opacity: 1;
			translate: none;
			transition: opacity var(--dur-fast) ease-out;
		}

		/* Regla aparte: un navegador sin :has() descarta la regla entera y se llevaría .on con ella. Con
		   :focus-visible y no :focus-within, para que un chip tocado con el dedo no lo deje fijo al volver arriba. */
		.pidx:has(:focus-visible) {
			opacity: 1;
			translate: none;
			transition: opacity var(--dur-fast) ease-out;
		}

		.pidx::-webkit-scrollbar {
			display: none;
		}

		/* El botón es más alto que el chip que se ve (36 px pulsables, 26 px de chip): fila fina y fácil de tocar. */
		button {
			flex: none;
			display: flex;
			align-items: center;
			min-height: 0;
			height: calc(var(--index-chip) + var(--sp-10));
			padding: 0;
			background: none;
			border: 0;
			cursor: pointer;
		}

		span {
			display: flex;
			align-items: center;
			height: var(--index-chip);
			padding: 0 var(--sp-8);
			border: var(--border);
			color: var(--muted);
			font-size: var(--fs-xs);
			letter-spacing: var(--track-label);
			text-transform: uppercase;
		}

		button:active span,
		button:focus-visible span {
			color: var(--amber);
			border-color: var(--amber-edge);
		}
	}
</style>
