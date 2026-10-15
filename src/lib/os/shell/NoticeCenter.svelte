<!--
	Centro de notificaciones de Arc OS: campana con lo no leído y, al tocarla, los avisos gordos (los mismos que
	los P1 del móvil) y las novedades de la web. Los avisos nuevos salen además como toast discreto, abajo a la
	derecha, que se va solo a los 8 s (o con ✕). Tus avisos al móvil se configuran en AVISOS.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';
	import { onDestroy, onMount } from 'svelte';
	import { dismissToast, markAllSeen, shell, startNotices, toggle, unreadCount } from './shell.svelte.ts';
	import type { Notice } from './notices.ts';

	interface Props {
		/** Abrir una ruta de la web (en una ventana, si el núcleo puede). */
		onnavigate: (href: string) => void;
	}
	let { onnavigate }: Props = $props();

	const isOpen = $derived(shell.open === 'notices');
	const count = $derived(unreadCount());

	onMount(() => startNotices());

	// Un temporizador por toast (no uno nuevo por cada cambio de la lista), y fuera todos al desmontar.
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	$effect(() => {
		for (const t of shell.toasts) {
			if (timers.has(t.id)) continue;
			timers.set(
				t.id,
				setTimeout(() => {
					timers.delete(t.id);
					dismissToast(t.id);
				}, 8000)
			);
		}
	});
	onDestroy(() => timers.forEach(clearTimeout));

	function go(n: Notice) {
		if (n.href) onnavigate(n.href);
		shell.open = null;
	}
	function toggleCenter() {
		toggle('notices');
		if (shell.open === 'notices') markAllSeen();
	}
</script>

<div class="center">
	<button
		type="button"
		class="tray-btn"
		aria-expanded={isOpen}
		aria-controls="os-notices"
		aria-label={count ? `Notificaciones: ${count} sin leer` : 'Notificaciones'}
		onclick={toggleCenter}
	>
		<span aria-hidden="true">◬</span>
		{#if count}<span class="badge">{count}</span>{/if}
	</button>
	{#if isOpen}
		<div id="os-notices" class="pop" role="region" aria-label="Notificaciones">
			<header>
				<span>Notificaciones</span>
				<a href={resolve('/avisos')} onclick={(e) => (e.preventDefault(), go({ id: '', kind: 'aviso', title: '', detail: '', time: '', href: '/avisos' }))}>Tus avisos al móvil</a>
			</header>
			{#if shell.notices.length}
				<ul>
					{#each shell.notices as n (n.id)}
						<li>
							<button type="button" onclick={() => go(n)}>
								<span class="kind" class:alert={n.kind === 'aviso'}>{n.kind === 'aviso' ? 'Aviso' : 'Novedad'}</span>
								<span class="t">{n.title}</span>
								<span class="d mut">{n.detail} · {when(n.time, clock.now)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Nada nuevo. Aquí salen los avisos gordos (terremotos, temas enormes) y las novedades de Arc.</p>
			{/if}
		</div>
	{/if}
</div>

<div class="toasts" aria-live="polite">
	{#each shell.toasts as t (t.id)}
		<div class="toast" role="status">
			<button type="button" class="body" onclick={() => (go(t), dismissToast(t.id))}>
				<b>{t.title}</b>
				<span class="mut">{t.detail}</span>
			</button>
			<button type="button" class="x" aria-label="Cerrar aviso" onclick={() => dismissToast(t.id)}>✕</button>
		</div>
	{/each}
</div>

<style>
	/* Botones de la shell sin el borde ni el fondo que algunas estéticas dan a todos los botones. */
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.center {
		position: relative;
	}
	.badge {
		min-width: var(--sp-16);
		padding: 0 var(--sp-4);
		border-radius: var(--radius);
		background: var(--amber);
		color: var(--on-amber);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		line-height: var(--sp-16);
		text-align: center;
	}
	.pop {
		right: 0;
		width: 340px;
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-8);
		padding: var(--head-y) var(--pad-x);
		border-bottom: var(--hair) solid var(--line);
		font-size: var(--fs-s);
	}
	header a {
		color: var(--amber);
		text-decoration: none;
	}
	@media (hover: hover) {
		header a:hover {
			text-decoration: underline;
		}
	}
	/* Estado vacío con la letra de la interfaz, no la de los textos de la web. */
	.pop .empty {
		font-family: var(--font-ui);
		font-size: var(--fs-s);
		line-height: var(--lh);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 60dvh;
		overflow: auto;
	}
	li + li {
		border-top: var(--hair) solid var(--line);
	}
	li button {
		display: grid;
		gap: var(--sp-2);
		width: 100%;
		padding: var(--row-y) var(--pad-x);
		text-align: left;
	}
	@media (hover: hover) {
		li button:hover {
			background: var(--raise);
		}
	}
	.kind {
		color: var(--muted);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}
	.kind.alert {
		color: var(--amber);
	}
	.t {
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
	}
	.d {
		font-size: var(--fs-xs);
	}
	.toasts {
		position: fixed;
		right: var(--sp-12);
		bottom: calc(var(--os-bar-h) + var(--sp-12));
		z-index: var(--z-popover);
		display: grid;
		gap: var(--sp-8);
		width: min(320px, calc(100vw - 2 * var(--sp-12)));
	}
	:global([data-os-bar='top']) .toasts {
		bottom: var(--sp-12);
	}
	:global([data-os-skin='mac']) .toasts {
		bottom: calc(var(--os-dock-h) + var(--sp-12));
	}
	.toast {
		display: flex;
		align-items: flex-start;
		background: var(--panel);
		border: var(--border) solid var(--amber-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
	}
	.toast .body {
		flex: 1;
		display: grid;
		gap: var(--sp-2);
		padding: var(--sp-8) var(--sp-10);
		text-align: left;
		font-size: var(--fs-s);
	}
	.toast .x {
		padding: var(--sp-8);
		color: var(--muted);
	}
</style>
