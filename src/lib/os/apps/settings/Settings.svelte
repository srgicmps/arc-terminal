<!--
	Ajustes de Arc OS, como el Panel de control de un NAS: en la portada, iconos por categorías y un buscador que
	encuentra secciones y ajustes sueltos; al entrar en una, la lista de todas a la izquierda y su contenido.
	En estrecho (≤ 600 px) son dos pantallas: la lista y la sección, con «‹» para volver. Esc vuelve a la portada.
	Las secciones están en sections.ts y su contenido en Pane.svelte. openApp('ajustes', '<id>') abre una directa.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import UiIcon from '../../icons/UiIcon.svelte';
	import Search from '../../../components/ui/Search.svelte';
	import { isShortcut } from '../../../shortcuts.ts';
	import type { AppProps } from '../../apps.ts';
	import { os, persist } from '../../os.svelte.ts';
	import { findWin } from '../../wm.ts';
	import Tool from '../kit/Tool.svelte';
	import Pane from './Pane.svelte';
	import { CATEGORIES, findSection, parseSection, searchSettings, SECTIONS, type SectionId } from './sections.ts';

	let { win }: AppProps = $props();

	/** null: la portada. */
	let section = $state<SectionId | null>(null);
	let query = $state('');
	let root: HTMLDivElement;

	// La ruta de la ventana (openApp('ajustes', 'apariencia')) dice a qué sección ir; se lee y se borra, para que
	// abrirla otra vez con la misma sección vuelva a funcionar.
	$effect(() => {
		const path = findWin(os.state, win)?.path;
		if (!path) return;
		untrack(() => {
			const s = parseSection(path);
			if (s) go(s);
			const w = findWin(os.state, win);
			if (w) delete w.path;
			persist();
		});
	});

	const bySection = (cat: string) => SECTIONS.filter((s) => s.cat === cat);
	const hits = $derived(searchSettings(query));
	const current = $derived(section ? findSection(section) : undefined);

	async function go(s: SectionId | null) {
		const from = section;
		section = s;
		await tick();
		// Al volver a la portada, el foco al icono de donde venías; al entrar, al título de la sección.
		const target = s ? root?.querySelector<HTMLElement>('.detail h2') : from ? root?.querySelector<HTMLElement>(`[data-sec='${from}']`) : null;
		target?.focus({ preventScroll: true });
		root?.closest('[data-ui="os-tool"]')?.querySelector('.main')?.scrollTo(0, 0);
	}

	// Intro en el buscador entra en el primer resultado.
	function searchKey(e: KeyboardEvent) {
		if (e.key !== 'Enter' || e.isComposing || !(e.target as HTMLElement).matches('input')) return;
		const first = hits[0];
		if (!first) return;
		e.preventDefault();
		query = '';
		go(first.section.id as SectionId);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || !section || !isShortcut(e, 'os-settings-home')) return;
		const t = e.target as HTMLElement;
		if (t.closest('input, textarea, select, [role="radiogroup"]')) return;
		e.preventDefault();
		go(null);
	}
</script>

<Tool {win}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="wrap" bind:this={root} {onkeydown}>
		{#if !section}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="home" onkeydown={searchKey}>
				<Search label="Buscar en los ajustes" placeholder="Buscar: tema, widgets, sonidos…" bind:value={query} />
				{#if query.trim()}
					{#if hits.length}
						<ul class="hits">
							{#each hits as h, i (i)}
								<li>
									<button type="button" onclick={() => go(h.section.id as SectionId)}>
										<span class="ico" aria-hidden="true"><UiIcon id={h.section.icon} /></span>
										<span class="txt"><b>{h.item ?? h.section.label}</b><span class="sub">{h.item ? h.section.label : h.section.desc}</span></span>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="empty">Nada con «{query}».</p>
					{/if}
				{:else}
					{#each CATEGORIES as c (c.id)}
						<section aria-labelledby="cat-{win}-{c.id}">
							<h3 id="cat-{win}-{c.id}">{c.label}</h3>
							<ul class="tiles">
								{#each bySection(c.id) as s (s.id)}
									<li>
										<button type="button" class="tile" data-sec={s.id} title={s.desc} onclick={() => go(s.id)}>
											<span class="ico" aria-hidden="true"><UiIcon id={s.icon} /></span>
											<span class="txt"><b>{s.label}</b><span class="sub">{s.desc}</span></span>
										</button>
									</li>
								{/each}
							</ul>
						</section>
					{/each}
				{/if}
			</div>
		{:else}
			<div class="set">
				<nav aria-label="Secciones de los ajustes">
					<button type="button" class="home-btn" onclick={() => go(null)}><span aria-hidden="true">‹</span> Panel de control</button>
					{#each CATEGORIES as c (c.id)}
						<span class="cat">{c.label}</span>
						{#each bySection(c.id) as s (s.id)}
							<button type="button" aria-current={section === s.id} onclick={() => go(s.id)}><span class="g" aria-hidden="true"><UiIcon id={s.icon} /></span> {s.label}</button>
						{/each}
					{/each}
				</nav>
				<div class="detail">
					<button type="button" class="back" onclick={() => go(null)} aria-label="Volver a todos los ajustes"><span aria-hidden="true">‹</span> Ajustes</button>
					{#if current}<span class="crumb">{CATEGORIES.find((c) => c.id === current.cat)?.label}</span>{/if}
					<Pane {section} />
				</div>
			</div>
		{/if}
	</div>
</Tool>

<style>
	.wrap {
		container-type: inline-size;
		min-height: 100%;
	}

	/* Portada */
	.home {
		display: grid;
		gap: var(--sp-8);
		align-content: start;
	}

	h3,
	.cat,
	.crumb {
		font-size: var(--fs-title);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
	}

	h3 {
		margin: var(--sp-12) 0 var(--sp-4);
		padding-bottom: var(--sp-4);
		border-bottom: var(--border);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4);
	}

	button {
		font: inherit;
		color: var(--fg);
		cursor: pointer;
	}

	.tile,
	.hits button {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		width: 100%;
		min-height: var(--touch);
		padding: var(--sp-8);
		text-align: left;
		background: none;
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
	}

	.tile {
		flex-direction: column;
		text-align: center;
		padding: var(--sp-12) var(--sp-8);
	}

	.tile:focus-visible,
	.hits button:focus-visible {
		background: var(--raise);
		border-color: var(--line);
	}
	@media (hover: hover) {
		.tile:hover,
		.hits button:hover {
			background: var(--raise);
			border-color: var(--line);
		}
	}

	.ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 40px;
		height: 40px;
		font-size: var(--fs-xl);
		color: var(--os-icon-fg, var(--amber));
		background: var(--os-icon-bg, var(--raise));
		border: var(--border);
		border-radius: var(--os-icon-radius, var(--radius-s));
	}

	.hits .ico {
		width: 28px;
		height: 28px;
		font-size: var(--fs-l);
	}

	.txt {
		display: grid;
		gap: var(--sp-2);
		min-width: 0;
	}

	.txt b {
		font-family: var(--sans);
		font-weight: var(--fw-medium);
	}

	.sub {
		font-family: var(--sans);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.tile .sub {
		display: none;
	}

	.hits {
		display: grid;
		gap: var(--sp-2);
	}

	.empty {
		color: var(--muted);
	}

	/* Una sección: lista lateral + contenido */
	.set {
		display: grid;
		grid-template-columns: 210px 1fr;
		gap: var(--sp-16);
		min-height: 100%;
	}

	nav {
		display: grid;
		align-content: start;
		gap: var(--sp-1);
		border-right: var(--border);
		padding-right: var(--sp-12);
	}

	nav button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: none;
		border: 0;
		border-radius: var(--radius-s);
	}

	@media (hover: hover) {
		nav button:hover {
			background: var(--raise);
		}
	}

	nav .g {
		display: inline-grid;
		place-items: center;
		width: var(--sp-16);
		color: var(--amber);
		font-size: var(--sp-14);
		vertical-align: -0.15em;
	}

	nav [aria-current='true'] {
		background: var(--amber-soft);
		color: var(--amber);
	}

	.home-btn {
		color: var(--amber);
		margin-bottom: var(--sp-4);
	}

	.cat {
		margin: var(--sp-10) 0 var(--sp-2);
		padding: 0 var(--sp-8);
	}

	.detail {
		min-width: 0;
	}

	.detail :global(h2) {
		outline: none;
	}

	.back {
		display: none;
		height: var(--control-h);
		padding: 0;
		margin-bottom: var(--sp-8);
		background: none;
		border: 0;
		color: var(--amber);
	}

	.crumb {
		display: block;
		margin-bottom: var(--sp-4);
	}

	/* Estrecho: la portada es una lista y la sección, otra pantalla con «‹ Ajustes» */
	@container (max-width: 600px) {
		.tiles {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.tile {
			flex-direction: row;
			text-align: left;
			padding: var(--sp-8);
			border-bottom-color: var(--line);
		}

		.tile .sub {
			display: block;
		}

		.ico {
			width: 32px;
			height: 32px;
			font-size: var(--fs-l);
		}

		.set {
			grid-template-columns: 1fr;
		}

		nav {
			display: none;
		}

		.back {
			display: inline-flex;
			align-items: center;
			gap: var(--sp-4);
		}
	}
</style>
