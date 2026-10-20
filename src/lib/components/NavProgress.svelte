<script lang="ts">
	// Línea de carga: mientras se abre otra vista, una línea fina del acento arriba del todo. Así, en el móvil con
	// poca red, el toque tiene respuesta antes de que llegue la vista nueva. Solo aparece si la espera pasa de
	// 150 ms, y ese retardo va en el CSS: un temporizador llegaría tarde con el móvil ocupado. Con red rápida no
	// llega a verse. No sale en el modo TV (ya tiene su línea abajo) ni en el escritorio de Arc OS (html[data-os-look]:
	// aspecto propio); dentro de una ventana de Arc OS sí, arriba de la ventana.
	// `navigating` es como un ref de Vue que SvelteKit rellena mientras navega (to: adónde va) y vacía al llegar.
	import { navigating } from '$app/state';
	import { tv } from '#lib/tv.svelte.ts';

	// Solo se mira mientras se navega (nunca al prerenderizar): el escritorio de /os pone data-os-look al abrirse.
	const osDesktop = () => 'osLook' in document.documentElement.dataset;
</script>

{#if navigating.to && !tv.on && !osDesktop()}
	<div class="nav-progress" data-ui="nav-progress" aria-hidden="true"></div>
{/if}

<style>
	/* El mismo trazo que la barra del modo TV, pero arriba. Crece con transform (no con el ancho): no mueve nada
	   de la página ni la vuelve a maquetar. Por encima del panel ampliado: en el móvil ocupa toda la pantalla. */
	.nav-progress {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: var(--z-progress);
		height: var(--hair);
		background: var(--amber);
		transform-origin: left;
		pointer-events: none;
		animation:
			nav-in var(--dur-fast) 150ms both,
			nav-grow 2s 150ms var(--ease) both;
	}

	@keyframes nav-in {
		from {
			opacity: 0;
		}
	}

	@keyframes nav-grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(0.9);
		}
	}

	/* Con menos movimiento: una línea quieta de lado a lado, que aparece tras el mismo retardo. */
	@media (prefers-reduced-motion: reduce) {
		.nav-progress {
			animation: nav-in var(--dur-fast) 150ms both;
		}
	}
</style>
