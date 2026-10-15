<!--
	Lanzador de experiencias: un botón «✦ Experiencias» (en la cabecera) o «✦» (en la barra inferior del móvil)
	que abre la lista de todas para saltar a una, con la actual marcada y «Ver todas» (la galería /x).
	Con `hotkey`, Mayús + X lo abre desde cualquier vista (atajo «exp» de shortcuts.ts). Va en un <dialog>
	nativo: atrapa el foco, Esc lo cierra (sin que Esc lleve además a la portada) y en el móvil sale desde abajo.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { EXPERIENCES, expHref } from '#lib/experiences.ts';
	import { isShortcut } from '#lib/shortcuts.ts';

	let { variant = 'keys', hotkey = false }: { variant?: 'keys' | 'thumb'; hotkey?: boolean } = $props();

	const href = (path: string) => (resolve as (r: string) => string)(path);
	let dialog: HTMLDialogElement;
	const current = $derived(page.route.id?.startsWith('/x/') ? page.route.id.slice(3) : null);

	function open() {
		if (!dialog.open) dialog.showModal();
		// El foco, en la experiencia actual o en la primera.
		(dialog.querySelector<HTMLElement>('[aria-current="page"]') ?? dialog.querySelector<HTMLElement>('a'))?.focus();
	}

	function close() {
		dialog.close();
	}

	function onWindowKey(e: KeyboardEvent) {
		if (!hotkey || !isShortcut(e, 'exp')) return;
		const tag = (document.activeElement?.tagName ?? '').toUpperCase();
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
		// Antes que la barra de comandos, que si no se queda la «X» como si empezaras a escribir.
		e.preventDefault();
		e.stopPropagation();
		open();
	}

	/** Dentro de la lista: ↑ ↓ (y J K) se mueven; Esc cierra sin llevar a la portada. */
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			return;
		}
		const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		e.stopPropagation();
		const links = [...dialog.querySelectorAll<HTMLAnchorElement>('a.item')];
		const i = links.indexOf(document.activeElement as HTMLAnchorElement);
		links[(i + step + links.length) % links.length]?.focus();
	}

	function go(e: MouseEvent, path: string) {
		e.preventDefault();
		close();
		goto(href(path));
	}
</script>

<svelte:window onkeydowncapture={onWindowKey} />

<button
	type="button"
	class="launch {variant}"
	data-code="EXP"
	data-ui={variant === 'keys' ? 'key' : undefined}
	onclick={open}
	aria-haspopup="dialog"
	title="Experiencias: otras formas de usar Arc (Mayús + X)"
	aria-label="Experiencias"
>
	{#if variant === 'keys'}<span aria-hidden="true">✦ EXP</span><span class="label">Experiencias</span>{:else}<span aria-hidden="true">✦</span>{/if}
</button>

<dialog bind:this={dialog} class="exps" aria-label="Experiencias" onkeydown={onKey} onclick={(e) => e.target === dialog && close()}>
	<div class="box">
		<div class="head">
			<strong>Experiencias</strong>
			<span class="hint">Otras formas de usar Arc · Mayús + X</span>
			<button type="button" class="x" onclick={close} aria-label="Cerrar">✕</button>
		</div>
		<ul>
			{#each EXPERIENCES as e (e.id)}
				<li>
					<a
						class="item"
						href={href(expHref(e))}
						aria-current={current === e.id ? 'page' : undefined}
						onclick={(ev) => go(ev, expHref(e))}
					>
						<span class="icon" aria-hidden="true">{e.icon}</span>
						<span class="name">{e.name}</span>
						<span class="desc">{e.desc}</span>
					</a>
				</li>
			{/each}
		</ul>
		<div class="foot">
			<a href={href('/x')} onclick={(ev) => go(ev, '/x')}>Ver todas, con vista previa →</a>
			{#if current}<a href={href('/')} onclick={(ev) => go(ev, '/')}>✕ Salir de la experiencia</a>{/if}
		</div>
	</div>
</dialog>

<style>
	.launch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-6);
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	/* Como una tecla más de la fila de secciones (las .key del layout). */
	.launch.keys {
		padding: var(--sp-4) var(--sp-10);
		border: var(--border);
		border-radius: var(--radius-s);
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-code);
	}

	.launch.keys .label {
		color: var(--muted);
		font-family: var(--sans);
		font-weight: var(--fw-regular);
		letter-spacing: 0;
	}

	.launch.keys:hover,
	.launch.keys:focus-visible {
		border-color: var(--amber-edge);
	}

	.launch span[aria-hidden] {
		color: var(--amber);
	}

	.launch.thumb {
		height: var(--tabbar-h);
		border: 0;
		font-size: var(--fs-m);
	}

	/* En el móvil va en la barra de abajo. */
	@media (max-width: 720px) {
		.launch.keys {
			display: none;
		}
	}

	.exps {
		width: min(36rem, calc(100vw - 2 * var(--gutter)));
		max-height: min(80vh, 44rem);
		padding: 0;
		background: var(--panel);
		color: var(--fg);
		border: var(--border);
		border-radius: var(--radius-s);
	}

	.exps::backdrop {
		background: color-mix(in srgb, var(--bg) 70%, transparent);
	}

	.exps[open] {
		display: flex;
	}

	.box {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 100%;
		max-height: inherit;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-8);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}

	.head strong {
		font-family: var(--sans);
		font-weight: var(--fw-medium);
		font-size: var(--fs-l);
	}

	.hint {
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.x {
		margin-left: auto;
		width: var(--control-h);
		height: var(--control-h);
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-y: auto;
	}

	.item {
		display: grid;
		grid-template-columns: var(--sp-24) 1fr;
		gap: var(--sp-2) var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
		color: inherit;
		text-decoration: none;
	}

	.item:hover,
	.item:focus-visible {
		background: var(--raise);
		outline: none;
	}

	.item[aria-current='page'] {
		background: var(--amber-soft);
	}

	.icon {
		grid-row: span 2;
		color: var(--amber);
		font-size: var(--fs-l);
		text-align: center;
	}

	.name {
		font-family: var(--sans);
		font-weight: var(--fw-medium);
	}

	.desc {
		color: var(--muted);
		font-size: var(--fs-xs);
		line-height: var(--lh-snug);
	}

	.foot {
		display: flex;
		border-top: var(--border);
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-8);
		padding: var(--sp-10) var(--pad-x);
		font-size: var(--fs-s);
	}

	.foot a {
		color: var(--amber);
		text-decoration: none;
	}

	/* Móvil: sale desde abajo, a todo el ancho. */
	@media (max-width: 720px) {
		.exps {
			width: 100vw;
			max-width: 100vw;
			margin: auto 0 0;
			border-radius: 0;
			border-inline: 0;
		}

		.item {
			min-height: var(--touch);
		}

		.hint {
			display: none;
		}
	}
</style>
