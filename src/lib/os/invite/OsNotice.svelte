<!--
	Para quien ya usaba la terminal: un aviso discreto, una sola vez, «Nuevo: Modo OS», con la vista previa y dos
	botones. Y, en el Modo OS en el móvil, la píldora «◂ Inicio» para volver a la pantalla de inicio desde una app.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { enterOS, isOS } from '../mode.svelte.ts';
	import { isEmbedded } from '../embed.ts';
	import { OS_INVITE_KEY, OS_KEY, shouldInvite } from '../mode.ts';
	import OsPreview from './OsPreview.svelte';

	let open = $state(false);
	$effect(() => {
		if (isEmbedded()) return;
		try {
			const keys = Object.keys(localStorage);
			if (!shouldInvite(localStorage.getItem(OS_KEY), localStorage.getItem(OS_INVITE_KEY), keys)) return;
		} catch {
			return;
		}
		// Unos segundos después de entrar, para no tapar lo primero que se mira; nunca en la Bienvenida.
		const id = setTimeout(() => (open = !location.pathname.includes('/bienvenida')), 3000);
		return () => clearTimeout(id);
	});

	function done(go: boolean) {
		open = false;
		try {
			localStorage.setItem(OS_INVITE_KEY, '1');
		} catch {}
		if (go) enterOS();
	}

	// Dentro de una app del Modo OS (iframe) ya está la barra de abajo del teléfono: la píldora, solo fuera.
	const inOsApp = $derived(!isEmbedded() && isOS() && !(page.route.id as string | null)?.startsWith('/os'));
</script>

{#if open}
	<aside class="notice" aria-label="Novedad: Modo OS">
		<OsPreview />
		<div class="txt">
			<b>Nuevo: Modo OS</b>
			<p>Arc como un sistema operativo: ventanas, menú Inicio y widgets; en el móvil, pantalla de inicio con apps. El Terminal clásico sigue igual y se vuelve con un toque.</p>
			<div class="row">
				<button class="go" onclick={() => done(true)}>Probar el Modo OS</button>
				<button onclick={() => done(false)}>Ahora no</button>
			</div>
		</div>
	</aside>
{/if}

{#if inOsApp}
	<a class="home" href={resolve('/os' as '/')} aria-label="Volver a la pantalla de inicio del Modo OS">◂ Inicio</a>
{/if}

<style>
	.notice {
		position: fixed;
		right: var(--gutter);
		bottom: calc(var(--sp-16) + env(safe-area-inset-bottom, 0px));
		z-index: var(--z-popover);
		display: flex;
		gap: var(--sp-12);
		width: min(560px, calc(100vw - 2 * var(--gutter)));
		padding: var(--sp-12);
		background: var(--panel);
		backdrop-filter: var(--panel-blur);
		border: var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
		animation: rise var(--dur-ui) var(--ease);
	}
	.notice :global(.pv) {
		flex: 0 0 200px;
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		font-size: var(--fs-s);
	}
	.txt b {
		color: var(--amber);
		font-family: var(--title-font);
	}
	.txt p {
		margin: 0;
		color: var(--muted);
		line-height: var(--lh-text);
	}
	.row {
		display: flex;
		gap: var(--sp-8);
		margin-top: auto;
	}
	button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--fg);
		font: inherit;
		cursor: pointer;
	}
	.go {
		background: var(--amber);
		border-color: var(--amber);
		color: var(--on-amber);
	}
	.home {
		position: fixed;
		left: var(--gutter);
		bottom: calc(var(--tabbar-h) + var(--sp-12) + env(safe-area-inset-bottom, 0px));
		z-index: var(--z-popover);
		display: none;
		align-items: center;
		min-height: var(--touch);
		padding: 0 var(--sp-12);
		background: var(--panel);
		backdrop-filter: var(--panel-blur);
		border: var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		text-decoration: none;
	}
	@media (max-width: 900px) {
		.home {
			display: flex;
		}
	}
	@media (max-width: 720px) {
		.notice {
			flex-direction: column;
			left: var(--gutter);
			bottom: calc(var(--tabbar-h) + var(--sp-12) + env(safe-area-inset-bottom, 0px));
		}
		/* En el móvil, sin la vista previa: el aviso no tapa media pantalla. */
		.notice :global(.pv) {
			display: none;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(var(--sp-12));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}
	}
</style>
