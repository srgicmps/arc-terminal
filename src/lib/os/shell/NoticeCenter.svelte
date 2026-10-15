<!--
	Centro de notificaciones de Arc OS: campana con lo no leído y, al tocarla, los avisos gordos (los mismos que
	los P1 del móvil) y las novedades de la web. Los avisos nuevos salen además como toast discreto, abajo a la
	derecha, que se va solo a los 8 s (o con ✕). Tus avisos al móvil se configuran en AVISOS.
-->
<script lang="ts">
	import UiIcon from '../icons/UiIcon.svelte';
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';
	import { onMount } from 'svelte';
	import { markAllSeen, shell, startNotices, toggle, unreadCount } from './shell.svelte.ts';
	import type { Notice } from './notices.ts';
	import Toasts from './Toasts.svelte';

	interface Props {
		/** Abrir una ruta de la web (en una ventana, si el núcleo puede). */
		onnavigate: (href: string) => void;
	}
	let { onnavigate }: Props = $props();

	const isOpen = $derived(shell.open === 'notices');
	const count = $derived(unreadCount());

	onMount(() => startNotices());

	/** Lo que estaba sin leer al abrir (se marca leído al abrir, pero se sigue distinguiendo con un punto). */
	let fresh = $state(new Set<string>());
	let root = $state<HTMLElement>();

	function go(n: Notice) {
		if (n.href) onnavigate(n.href);
		shell.open = null;
	}
	function toggleCenter() {
		toggle('notices');
		if (shell.open !== 'notices') return;
		fresh = new Set(shell.notices.filter((n) => !shell.seen.includes(n.id)).map((n) => n.id));
		markAllSeen();
	}
	// Como los demás paneles: Escape o un clic fuera lo cierran.
	function onkey(e: KeyboardEvent) {
		if (!isOpen || e.key !== 'Escape') return;
		e.preventDefault();
		shell.open = null;
		root?.querySelector<HTMLElement>('.tray-btn')?.focus();
	}
	function onpointer(e: PointerEvent) {
		if (isOpen && root && !root.contains(e.target as Node)) shell.open = null;
	}
</script>

<svelte:window onkeydown={onkey} onpointerdown={onpointer} />

<div class="center" bind:this={root}>
	<button
		type="button"
		class="tray-btn"
		aria-expanded={isOpen}
		aria-controls="os-notices"
		aria-label={count ? `Notificaciones: ${count} sin leer` : 'Notificaciones'}
		onclick={toggleCenter}
	>
		<UiIcon id="bell" size={16} />
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
							<button type="button" class:fresh={fresh.has(n.id)} onclick={() => go(n)}>
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

<Toasts ongo={go} />

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
	/* Sin leer al abrir: un punto de acento a la izquierda. */
	li button.fresh {
		box-shadow: inset var(--sp-2) 0 0 var(--amber);
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
</style>
