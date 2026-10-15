<!--
	Expediente (Arc OS 6, Centro de mando): todo lo que Arc sabe de una entidad. Resumen, datos clave (los de PAIS,
	la ficha del valor, el líder o el banco), mapa si tiene ubicación, relaciones (clic: su expediente) y la
	cronología de titulares, temas de IMP, sanciones y sucesos que la nombran. Se exporta a Markdown o JSON y se
	imprime. La entidad va en el path de la ventana: «/expediente#country:ES» (openDossier de intel/open.ts).
-->
<script lang="ts">
		import { madridDate } from '#lib/meetings.ts';
	import { routeHref } from '#lib/routes.ts';
	import type { AppProps } from '../../apps.ts';
	import { openApp, openPath, os, setPath } from '../../os.svelte.ts';
	import EntitySearch from '../intel/EntitySearch.svelte';
	import MiniMap from '../intel/MiniMap.svelte';
	import { getGraph, intel, loadAgenda, loadIntel, loadProfile } from '../intel/data.svelte.ts';
	import { dossier, fileName, refKind, toJson, toMarkdown, type DossierExtra } from '../intel/dossier.ts';
	import { overview, pathTo, targetOf } from '../intel/graph.ts';
	import { KINDS, kindLabel, type Kind } from '../intel/model.ts';
	import { printHtml } from '../intel/print.ts';

	let { win }: AppProps = $props();

	/** La base de la web (vacía si se publica en la raíz), como en Window.svelte. */
	const base = routeHref('/').replace(/\/$/, '');

	const ALL = KINDS.map((k) => k.value) as Kind[];
	const graph = $derived(getGraph());
	const path = $derived(os.state.desks.flatMap((d) => d.wins).find((w) => w.uid === win)?.path);
	const target = $derived(targetOf(path));

	let extra = $state<DossierExtra>({});
	let full = $state(false);
	let scroller: HTMLDivElement | undefined = $state();

	$effect(() => {
		loadIntel().catch(() => {});
	});

	// Al cambiar de entidad: las cifras de PAIS o la agenda del líder, si hacen falta; y arriba del todo.
	$effect(() => {
		const t = target;
		extra = { today: madridDate(Date.now()) };
		full = false;
		scroller?.scrollTo({ top: 0 });
		if (!t) return;
		const [kind, key] = [t.slice(0, t.indexOf(':')), t.slice(t.indexOf(':') + 1)];
		if (kind === 'country') loadProfile(key).then((profile) => target === t && (extra = { ...extra, profile }));
		if (kind === 'leader') loadAgenda(key).then((agenda) => target === t && (extra = { ...extra, agenda }));
	});

	const d = $derived(graph && target ? dossier(graph, target, extra) : null);
	const suggestions = $derived(graph ? [...overview(graph, ['country', 'leader', 'bank', 'ticker'], 12)].map((id) => graph.nodes.get(id)!) : []);
	const timeline = $derived(d ? (full ? d.timeline : d.timeline.slice(0, 20)) : []);

	const go = (id: string) => setPath(win, pathTo('expediente', id));

	const when = (t: string | null) => {
		if (!t) return '';
		if (t.length <= 10) return t.slice(8, 10) + '/' + t.slice(5, 7);
		const date = new Date(t);
		return Number.isNaN(date.getTime()) ? t.slice(0, 10) : date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
	};

	const stamp = () => new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

	function download(text: string, name: string, type: string) {
		const url = URL.createObjectURL(new Blob([text], { type }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function print() {
		if (!d) return;
		const cs = getComputedStyle(document.documentElement);
		const v = (n: string) => cs.getPropertyValue(`--${n}`).trim();
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.style.position = 'fixed';
		frame.style.width = frame.style.height = '0';
		frame.style.border = '0';
		frame.srcdoc = printHtml(d, stamp(), { sans: v('sans'), mono: v('mono'), s: v('fs-s'), m: v('fs-m'), xl: v('fs-xl') });
		frame.onload = () => {
			frame.contentWindow?.print();
			setTimeout(() => frame.remove(), 1000);
		};
		document.body.appendChild(frame);
	}

	/** Enlaces de Arc: se abren en su ventana dentro del escritorio; los de fuera, en otra pestaña. */
	function follow(e: MouseEvent, href: string) {
		if (!href.startsWith('/')) return;
		if (openPath(href)) e.preventDefault();
	}
</script>

<div class="exp" data-win={win}>
	<div class="bar">
		<EntitySearch {graph} onpick={go} />
		{#if d}
			<span class="export" role="group" aria-label="Exportar">
				<button type="button" onclick={() => download(toMarkdown(d, stamp(), location.origin + base), fileName(d, 'md'), 'text/markdown')}>Markdown</button>
				<button type="button" onclick={() => download(toJson(d, new Date().toISOString()), fileName(d, 'json'), 'application/json')}>JSON</button>
				<button type="button" onclick={print}>Imprimir</button>
			</span>
		{/if}
	</div>

	<div class="body" bind:this={scroller}>
		{#if !graph}
			<p class="msg">{intel.loading ? 'Cargando lo que sabe Arc…' : 'Sin datos todavía.'}</p>
		{:else if !d}
			<section class="start">
				<h2>{target ? 'No hay ficha de esa entidad ahora.' : 'Elige una entidad'}</h2>
				<p class="help">Un país, un líder, un banco central o un valor. Las más presentes en los titulares:</p>
				<ul class="chips">
					{#each suggestions as n (n.id)}
						<li><button type="button" onclick={() => go(n.id)}><i class="dot" data-cmd-kind={n.kind}></i>{n.label}</button></li>
					{/each}
				</ul>
			</section>
		{:else}
			<header class="head">
				<p class="kind"><i class="dot" data-cmd-kind={d.kind}></i>{d.kindLabel} <span class="ref">· {d.id}</span></p>
				<h1>{d.label}</h1>
				<p class="sub">{d.sub}</p>
				<p class="summary">{d.summary}</p>
				<p class="nav">
					<button type="button" onclick={() => openApp('grafo', pathTo('grafo', d.id))}>⌬ Ver en el grafo</button>
					{#each d.links as l (l.href)}
						<a href={l.href.startsWith('/') ? base + l.href : l.href} target={l.href.startsWith('/') ? undefined : '_blank'} rel="noopener" onclick={(e) => follow(e, l.href)}>{l.label}</a>
					{/each}
				</p>
			</header>

			<div class="cols">
				<section>
					<h3>Datos clave</h3>
					<dl class="facts">
						{#each d.facts as f, i (i)}
							<dt>{f.label}</dt>
							<dd>{f.value}{#if f.note}<small>{f.note}</small>{/if}</dd>
						{/each}
					</dl>
					{#if d.at}
						<h3>Ubicación</h3>
						<MiniMap at={d.at} label={d.label} />
					{/if}
				</section>

				<section>
					<h3>Relaciones <span class="count">{d.related.length}</span></h3>
					<ul class="rel">
						{#each d.related.slice(0, 16) as r (r.id)}
							<li>
								<button type="button" onclick={() => go(r.id)} title="Abrir su expediente">
									<i class="dot" data-cmd-kind={r.kind}></i>
									<span class="name">{r.label}</span>
									<span class="w">{r.w}</span>
								</button>
								<span class="why">{kindLabel(r.kind)} · {r.why}</span>
							</li>
						{:else}
							<li class="help">Sin relaciones en los datos de ahora.</li>
						{/each}
					</ul>
				</section>
			</div>

			<section class="time">
				<h3>Cronología <span class="count">{d.timeline.length}</span></h3>
				{#if timeline.length}
					<ol>
						{#each timeline as r, i (i)}
							<li>
								<time>{when(r.time)}</time>
								<span class="tag" data-ref={r.kind}>{refKind(r.kind)}</span>
								<a href={r.url} target="_blank" rel="noopener">{r.title}</a>
								<span class="src">{r.source}</span>
							</li>
						{/each}
					</ol>
					{#if d.timeline.length > timeline.length}
						<button type="button" class="more" onclick={() => (full = true)}>Ver las {d.timeline.length}</button>
					{/if}
				{:else}
					<p class="help">Nada con fecha que la nombre en los titulares, IMP, sanciones o sucesos de ahora.</p>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.exp {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100%;
		min-height: 0;
		container-type: inline-size;
		background: var(--panel);
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}

	.export {
		display: flex;
		gap: var(--sp-4);
	}

	button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--raise);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		cursor: pointer;
	}

	button:focus-visible {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	@media (hover: hover) {
		button:hover {
			border-color: var(--amber-edge);
			color: var(--amber);
		}
	}

	.body {
		overflow: auto;
		min-height: 0;
		padding: var(--sp-12) var(--pad-x) var(--sp-20);
	}

	.msg,
	.help {
		color: var(--muted);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}

	.head {
		padding-bottom: var(--sp-12);
		border-bottom: var(--border);
	}

	.kind {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		margin: 0;
		color: var(--cmd-cold);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	.ref {
		color: var(--faint);
		letter-spacing: var(--track-code);
		text-transform: none;
	}

	h1 {
		margin: var(--sp-4) 0 var(--sp-2);
		font-size: var(--fs-xxl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	h2 {
		margin: 0 0 var(--sp-6);
		font-size: var(--fs-l);
	}

	.sub {
		margin: 0;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.summary {
		max-width: 68ch;
		margin: var(--sp-10) 0 0;
		font-size: var(--fs-l);
		line-height: var(--lh-loose);
	}

	.nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6) var(--sp-12);
		margin: var(--sp-10) 0 0;
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.nav a {
		color: var(--amber-dim);
		text-decoration: none;
		border-bottom: var(--hair) solid var(--amber-edge);
	}

	@media (hover: hover) {
		.nav a:hover {
			color: var(--amber);
		}
	}

	h3 {
		display: flex;
		align-items: baseline;
		gap: var(--sp-6);
		margin: var(--sp-16) 0 var(--sp-6);
		color: var(--title-color);
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-medium);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
	}

	.count {
		color: var(--faint);
		letter-spacing: var(--track-code);
	}

	.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 var(--sp-20);
	}

	.facts {
		display: grid;
		grid-template-columns: minmax(0, 40%) 1fr;
		margin: 0;
	}

	.facts dt,
	.facts dd {
		margin: 0;
		padding: var(--sp-4) 0;
		border-bottom: var(--border);
	}

	.facts dt {
		padding-right: var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.facts dd {
		font-family: var(--mono);
		font-size: var(--fs-s);
		font-variant-numeric: tabular-nums;
	}

	.facts small {
		display: block;
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	ul,
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rel li {
		padding: var(--sp-2) 0 var(--sp-4);
		border-bottom: var(--border);
	}

	.rel button {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		width: 100%;
		height: auto;
		min-height: var(--control-h);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--sans);
		font-size: var(--fs-m);
		text-align: left;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.w {
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}

	.why {
		display: block;
		padding-left: calc(var(--swatch) + var(--sp-6));
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	.time li {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: var(--sp-2) var(--sp-8);
		align-items: baseline;
		padding: var(--row-y) 0;
		border-bottom: var(--border);
	}

	time {
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.tag {
		color: var(--cmd-cold);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.tag[data-ref='imp'] {
		color: var(--amber-dim);
	}

	.tag[data-ref='sanction'] {
		color: var(--cmd-sanction);
	}

	.tag[data-ref='event'] {
		color: var(--cmd-event);
	}

	.time a {
		color: var(--fg);
		line-height: var(--lh-snug);
		text-decoration: none;
	}

	@media (hover: hover) {
		.time a:hover {
			color: var(--amber);
		}
	}

	.src {
		grid-column: 3;
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	.more {
		margin-top: var(--sp-8);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	.chips button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.dot {
		flex: none;
		display: inline-block;
		width: var(--swatch);
		height: var(--swatch);
		border-radius: 50%;
		background: var(--kc);
	}

	@container (max-width: 600px) {
		.cols {
			grid-template-columns: 1fr;
		}

		.time li {
			grid-template-columns: auto 1fr;
		}

		.time a,
		.src {
			grid-column: 1 / -1;
		}
	}

	@media print {
		.bar {
			display: none;
		}
	}
</style>
