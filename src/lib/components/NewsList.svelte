<!--
	Lista de titulares: hora, titular enlazado al medio original, medio y resumen opcional.
	Si otros medios dan la misma noticia (scripts/cluster.ts), «+3 medios» los despliega.
	Un punto ámbar marca los titulares posteriores a tu última visita (visit.svelte.ts).
	Los titulares en inglés salen traducidos si hay traducción (ES / EN arriba, titles.svelte.ts): el
	original aparece al pasar el ratón o con una pulsación larga en el móvil.
-->
<script lang="ts">
	import Disclosure from './ui/Disclosure.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { when } from '#lib/format.ts';
	import type { NewsItem } from '#lib/types.ts';
	import { headlineList } from '#lib/titles.svelte.ts';
	import { initVisit, isNew, visit } from '#lib/visit.svelte.ts';
	import { highlight, initWatchwords, watchwords } from '#lib/watchwords.svelte.ts';
	import type { EntityLink } from '#lib/entities.ts';
	import { resolve } from '$app/paths';
	import { initNewsPrefs, newsPrefs, visibleNews } from '#lib/newsprefs.svelte.ts';
	import AutoTag from './AutoTag.svelte';
	import TitleLang from './TitleLang.svelte';

	interface Props {
		items: NewsItem[];
		/** Muestra el resumen debajo del titular. */
		summaries?: boolean;
		/** Etiqueta de sección delante del medio (en la portada). */
		tag?: (item: NewsItem) => string | undefined;
	}

	let { items, summaries = false, tag }: Props = $props();

	// Como onMounted en Vue: solo en el navegador, después de hidratar.
	$effect(initVisit);
	// Las palabras vigiladas del BOE (guardadas en este navegador) salen resaltadas también en los titulares.
	$effect(initWatchwords);
	// Nombres con ficha (M30). entities.ts lleva las listas de países, valores y líderes (unos 15 KB): se
	// carga aparte, después de pintar, y hasta entonces no hay enlaces.
	let entitiesIn = $state<((text: string) => EntityLink[]) | null>(null);
	$effect(() => {
		import('#lib/entities.ts').then((m) => (entitiesIn = m.entitiesIn));
	});
	// «Mandar» a la familia (F15): el botón se carga aparte y solo si hay a quién mandar (y con cuenta).
	let FamilySend = $state<typeof import('./FamilySend.svelte').default | null>(null);
	$effect(() => {
		import('#lib/family.svelte.ts').then(async (f) => {
			await f.loadFamily();
			if (f.family.people.length) FamilySend = (await import('./FamilySend.svelte')).default;
		});
	});
	// Traducción de los titulares en inglés (ES / EN, titles.svelte.ts).
	// Tus medios (M23, se eligen en NEWS): sin los silenciados y del idioma original elegido.
	$effect(initNewsPrefs);
	const shown = $derived(visibleNews(items, newsPrefs.muted, newsPrefs.origin));
	const list = headlineList<number>(() => shown);
</script>

{#if shown.length}
	{#if list.toggle}
		<div class="lang"><TitleLang /></div>
	{/if}
	<ul class="news">
		{#each shown as item, i (i)}
			{@const t = list.link(item, i)}
			<li>
				<time datetime={item.time ?? undefined}>
					{#if isNew(item, visit.last)}<span class="new" title="Nuevo desde tu última visita"
							><span class="sr">Nuevo desde tu última visita</span></span
						>{/if}{when(item.time, clock.now)}
				</time>
				<div>
					<a
						class="h"
						href={item.url}
						target="_blank"
						rel="noopener"
						lang={t.lang}
						title={t.title}
						{@attach list.press(item, i)}
						>{#each highlight(t.text, watchwords.words) as part, j (j)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</a
					>
					<div class="m">
						{#if tag?.(item)}<span class="tag">{tag(item)}</span>{/if}
						<span>{item.source}</span>
						<!-- Nombres con ficha (valores, líderes, bancos centrales, países): llevan a su ficha en NEWS. -->
						{#each entitiesIn?.(item.title) ?? [] as e (e.query)}<a class="ent" href="{resolve('/news')}?q={encodeURIComponent(e.query)}">{e.label}</a>{/each}
						{#if t.translated}<AutoTag {item} />{/if}
						{#if item.also?.length}
							{@const n = item.also.length}
							<span class="also">
								<Disclosure inline>
									{#snippet summary()}+{n} {n === 1 ? 'medio' : 'medios'}{/snippet}
									{#each item.also as other, j (other.url)}
										{j ? ' · ' : ' '}<a href={other.url} target="_blank" rel="noopener">{other.source}</a>
									{/each}
								</Disclosure>
							</span>
						{/if}
						{#if FamilySend}<FamilySend title={item.titleEs ?? item.title} url={item.url} />{/if}
					</div>
					{#if summaries && item.summary && item.summary !== item.title}
						<p class="s">{item.summary}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{:else if items.length}
	<p class="empty">Todos ocultos por tus filtros de medios e idioma (en NEWS).</p>
{:else}
	<p class="empty">Sin titulares todavía.</p>
{/if}

<style>
	.news {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.news li {
		display: grid;
		grid-template-columns: 62px minmax(0, 1fr);
		gap: var(--sp-10);
		align-items: start;
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	/* En pantallas táctiles, toda la fila abre el titular: el ::after invisible del enlace la cubre. */
	@media (pointer: coarse) {
		.news li {
			position: relative;
		}

		.h::after {
			content: '';
			position: absolute;
			inset: 0;
		}

		/* «+3 medios» y sus enlaces quedan por encima de esa capa para poder tocarlos. */
		.also {
			position: relative;
			z-index: 1;
		}
	}

	/* ES / EN: discreto, a la derecha, encima de la lista. */
	.lang {
		display: flex;
		justify-content: flex-end;
		padding: var(--sp-4) var(--pad-x) 0;
	}

	.news li:last-child {
		border-bottom: 0;
	}

	time {
		position: relative;
		padding-top: var(--sp-2);
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: var(--lh-snug);
	}

	/* Punto de «nuevo»: en el hueco entre el borde y la hora, sin mover nada de la fila. */
	.new {
		position: absolute;
		/* Centrado en la primera línea de la hora: 2px de padding + media línea (1.35em / 2) − 2px. */
		top: 0.675em;
		left: calc(-1 * var(--sp-8));
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--amber);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.h {
		display: block;
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-tight);
		text-wrap: pretty;
	}

	.h:hover {
		color: var(--amber);
	}

	.h:visited {
		color: var(--muted);
	}

	.m {
		margin: var(--sp-3) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-8);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	/* «+3 medios»: al abrirlo, ocupa su propia línea con los enlaces a los demás medios. */
	.also:has(:global(details[open])) {
		flex-basis: 100%;
	}

	.also a {
		color: var(--muted);
		text-decoration: none;
	}

	.also a:hover {
		color: var(--amber);
	}

	.ent {
		color: var(--muted);
		text-decoration: none;
		border-bottom: var(--hair) dotted var(--line);
	}

	.ent:hover {
		color: var(--amber);
	}

	.tag {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
	}

	.s {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}

	/* Impreso: la dirección de la noticia debajo del titular, para poder ir a la fuente desde el papel. */
	@media print {
		.h::after {
			content: attr(href);
			display: block;
			color: var(--muted);
			font-family: var(--mono);
			font-size: var(--fs-xs);
			word-break: break-all;
		}
	}
</style>
