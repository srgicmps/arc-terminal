<!--
	Experiencia «Periódico»: Arc como un diario. Cabecera con la fecha y la edición (mañana o tarde), el tema de
	más peso de IMP a toda página, otros titulares de IMP debajo, las cifras del día como «breves» y las
	secciones (Mundo, Economía, España, Mercados, Tecnología) a columnas. Mismos datos que el resto de la web.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { currentEdition, editionWindow, inEdition, type Edition } from '#lib/exp/periodico.ts';
	import { hm, longDay, trend } from '#lib/format.ts';
	import { shown } from '#lib/titles.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exp = EXPERIENCES.find((e) => e.id === 'periodico')!;
	const href = (path: string) => (resolve as (r: string) => string)(path);
	const EDITIONS = [
		{ value: 'manana', label: 'Mañana' },
		{ value: 'tarde', label: 'Tarde' }
	] as const;

	// Al prerenderizar no hay hora: se usa la de los datos; en el navegador, la de ahora.
	const now = $derived(clock.now || (data.fetchedAt ? Date.parse(data.fetchedAt) : 0));
	let picked = $state<Edition | null>(null);
	const edition = $derived<Edition>(picked ?? currentEdition(now));
	const win = $derived(editionWindow(now, edition));

	const lead = $derived(data.top[0]);
	// Dos más bajo el titular principal y el resto en la fila de debajo.
	const second = $derived(data.top.slice(1, 3));
	const more = $derived(data.top.slice(3));
	const sections = $derived(data.sections.map((s) => ({ ...s, items: inEdition(s.items, win, 4).slice(0, 6) })).filter((s) => s.items.length));
	const editionName = $derived(`Edición de ${edition === 'manana' ? 'mañana' : 'tarde'}${win.yesterday ? ' (ayer)' : ''}`);
	const sourcesText = (n: number) => (n === 1 ? '1 medio' : `${n} medios`);
</script>

<ExpHeader {exp} sub={now ? `${longDay(new Date(now).toISOString())} · ${editionName}` : editionName}>
	{#snippet aside()}
		<Seg label="Edición" options={EDITIONS} bind:value={() => edition, (v) => (picked = v)} />
	{/snippet}
</ExpHeader>

<article class="paper">
	<header class="mast">
		<p class="name">Arc Terminal</p>
		<p class="line"><span>{editionName}</span><span>Mundo · Economía · España · Mercados · Tecnología</span></p>
	</header>

	<!-- Sin titulares de esta edición, los Breves (cifras del día) salen igual. -->
	{#if lead || data.figures.length}
		<section class="front">
			{#if lead}<div class="lead-col">
				<a class="lead" href={lead.url} rel="noopener" target="_blank">
					<span class="kicker">Lo más importante · {sourcesText(lead.sources.length)}</span>
					<h2>{shown(lead).text}</h2>
					<span class="by">{lead.sources.slice(0, 4).join(' · ')}</span>
				</a>
				{#if second.length}
					<div class="second">
						{#each second as t (t.k)}
							<a href={t.url} rel="noopener" target="_blank">
								<h3>{shown(t).text}</h3>
								<span class="by">{t.sources.slice(0, 3).join(' · ')}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>{/if}
			{#if data.figures.length}
				<aside class="breves" aria-label="Breves: cifras del día">
					<h3>Breves</h3>
					<ul>
						{#each data.figures.slice(0, 8) as f (f.id)}
							<li>
								<a href={href(f.view)}>
									<span class="b-label">{f.label}</span>
									<span class="b-val">{f.text}</span>
									{#if f.changeText}<span class="b-chg {trend(f.change)}">{f.changeText}</span>{/if}
								</a>
							</li>
						{/each}
					</ul>
				</aside>
			{/if}
		</section>
	{/if}

	{#if more.length}
		<section class="also" aria-label="Más titulares importantes">
			{#each more as t (t.k)}
				<a href={t.url} rel="noopener" target="_blank">
					<h3>{shown(t).text}</h3>
					<span class="by">{t.sources.slice(0, 3).join(' · ')}</span>
				</a>
			{/each}
		</section>
	{/if}

	<div class="sections">
		{#each sections as s (s.id)}
			<section class="sec" aria-labelledby="sec-{s.id}">
				<h2 id="sec-{s.id}"><a href={href(s.view)}>{s.label}</a></h2>
				{#each s.items as item, i (item.url)}
					<a class="story" class:first={i === 0} href={item.url} rel="noopener" target="_blank">
						<h3>{shown(item).text}</h3>
						{#if i === 0 && item.summary}<p>{item.summary}</p>{/if}
						<span class="by">{item.source}{item.time ? ` · ${hm(item.time)}` : ''}</span>
					</a>
				{/each}
			</section>
		{:else}
			<p class="empty">Todavía no hay titulares para esta edición.</p>
		{/each}
	</div>
</article>

<style>
	.paper {
		max-width: 1200px;
		margin-inline: auto;
		background: var(--panel);
		border: var(--hair) solid var(--line);
		padding: var(--sp-16) var(--sp-20) var(--sp-24);
		font-family: var(--sans);
		line-height: var(--lh-loose);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	a:hover h2,
	a:hover h3,
	a:focus-visible h2,
	a:focus-visible h3 {
		text-decoration: underline;
		text-decoration-thickness: var(--hair);
		text-underline-offset: 0.15em;
	}

	.mast {
		text-align: center;
		border-bottom: var(--hair) solid var(--fg);
		padding-bottom: var(--sp-8);
		margin-bottom: var(--sp-16);
	}

	.name {
		margin: 0;
		font-size: clamp(var(--fs-xxl), 6vw, calc(var(--fs-xxl) * 1.8));
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-code);
		line-height: var(--lh-tight);
	}

	.line {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-4) var(--sp-16);
		margin: var(--sp-8) 0 0;
		padding-top: var(--sp-6);
		border-top: var(--hair) solid var(--line);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		text-transform: uppercase;
	}

	.front {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: var(--sp-24);
		padding-bottom: var(--sp-16);
		border-bottom: var(--hair) solid var(--line);
	}

	.lead-col {
		display: grid;
		align-content: start;
		gap: var(--sp-16);
	}

	.second {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--sp-16) var(--sp-24);
		padding-top: var(--sp-16);
		border-top: var(--hair) solid var(--line);
	}

	.second a {
		display: grid;
		gap: var(--sp-4);
		align-content: start;
	}

	.second h3 {
		margin: 0;
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.lead {
		display: grid;
		align-content: start;
		gap: var(--sp-8);
	}

	.kicker {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--amber);
		text-transform: uppercase;
	}

	.lead h2 {
		margin: 0;
		font-size: clamp(var(--fs-xxl), 4.2vw, calc(var(--fs-xxl) * 1.6));
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
		text-wrap: balance;
	}

	.by {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	.breves {
		border-left: var(--hair) solid var(--line);
		padding-left: var(--sp-16);
	}

	.breves h3,
	.sec h2 {
		margin: 0 0 var(--sp-8);
		font-family: var(--mono);
		font-size: var(--fs-s);
		font-weight: var(--fw-bold);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
		border-bottom: var(--hair) solid var(--line);
		padding-bottom: var(--sp-4);
	}

	.breves ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.breves a {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 var(--sp-8);
		padding-block: var(--sp-6);
		border-bottom: var(--hair) solid var(--line);
	}

	.b-label {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.b-val {
		font-family: var(--mono);
		font-size: var(--fs-l);
	}

	.b-chg {
		font-family: var(--mono);
		font-size: var(--fs-s);
		align-self: end;
	}

	.up {
		color: var(--up);
	}

	.down {
		color: var(--down);
	}

	.flat {
		color: var(--muted);
	}

	.also {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--sp-16) var(--sp-24);
		padding-block: var(--sp-16);
		border-bottom: var(--hair) solid var(--fg);
	}

	.also a {
		display: grid;
		gap: var(--sp-4);
		align-content: start;
	}

	.also h3 {
		margin: 0;
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
		line-height: var(--lh-snug);
	}

	.sections {
		columns: 3 280px;
		column-gap: var(--sp-24);
		column-rule: var(--hair) solid var(--line);
		padding-top: var(--sp-16);
	}

	.sec {
		break-inside: avoid-column;
		margin-bottom: var(--sp-24);
	}

	.story {
		display: grid;
		gap: var(--sp-2);
		padding-block: var(--sp-6);
		border-bottom: var(--hair) solid var(--line);
	}

	.story:last-child {
		border-bottom: 0;
	}

	.story h3 {
		margin: 0;
		font-size: var(--fs-m);
		font-weight: var(--fw-medium);
		line-height: var(--lh-snug);
	}

	.story.first h3 {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	.story p {
		margin: var(--sp-2) 0;
		color: var(--muted);
		font-size: var(--fs-m);
	}

	/* Modo Sencillo (sesión B): letra un punto mayor para leer con calma. */
	:global(:root[data-modo='sencillo']) .story h3,
	:global(:root[data-modo='sencillo']) .story p {
		font-size: var(--fs-l);
	}

	@media (max-width: 720px) {
		.paper {
			padding: var(--sp-12);
			border-inline: 0;
		}

		.front {
			grid-template-columns: 1fr;
			gap: var(--sp-16);
		}

		.breves {
			border-left: 0;
			padding-left: 0;
		}

		.breves ul {
			display: grid;
			grid-template-columns: 1fr 1fr;
			column-gap: var(--sp-12);
		}
	}
</style>
