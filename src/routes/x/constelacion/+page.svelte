<!--
	Constelación (experiencia 9): un mapa de quién sale con quién en las noticias de los últimos 3 días.
	Cada punto es un país, un líder, un banco central, una empresa o un tema; una línea une a los que nombran
	los mismos titulares (más gruesa cuantos más). Tocar un punto enciende sus vecinos y enseña sus titulares.
	SVG propio, sin librerías: las posiciones vienen ya calculadas en /data/constelacion.json.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { routeHref } from '#lib/routes.ts';
	import { neighbours, type Graph, type GraphNode, type Kind } from '#lib/exp/constelacion.ts';

	const exp = EXPERIENCES.find((e) => e.id === 'constelacion')!;
	const SIZE = 1000;
	const KINDS: { value: Kind; label: string }[] = [
		{ value: 'pais', label: 'Países' },
		{ value: 'lider', label: 'Líderes' },
		{ value: 'banco', label: 'Bancos centrales' },
		{ value: 'valor', label: 'Empresas' },
		{ value: 'tema', label: 'Temas' }
	];
	const KIND_LABEL: Record<Kind, string> = { pais: 'País', lider: 'Líder', banco: 'Banco central', valor: 'Empresa', tema: 'Tema' };

	let graph = $state<Graph | null>(null);
	let failed = $state(false);
	let selected = $state<string | null>(null);
	let kinds = $state<Kind[]>(KINDS.map((k) => k.value));

	onMount(async () => {
		try {
			const r = await fetch(asset('data/constelacion.json' as Parameters<typeof asset>[0]));
			graph = r.ok ? ((await r.json()) as { data: Graph }).data : null;
		} catch {}
		failed = !graph;
		// El que más sale, elegido de entrada: así se ve para qué sirve tocar.
		if (graph?.nodes.length) selected = [...graph.nodes].sort((a, b) => b.n - a.n)[0].id;
	});

	const visible = $derived(new Set((graph?.nodes ?? []).filter((n) => kinds.includes(n.kind)).map((n) => n.id)));
	const nodes = $derived((graph?.nodes ?? []).filter((n) => visible.has(n.id)));
	const edges = $derived((graph?.edges ?? []).filter((e) => visible.has(e.a) && visible.has(e.b)));
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	const maxN = $derived(Math.max(1, ...nodes.map((n) => n.n)));
	const maxW = $derived(Math.max(1, ...edges.map((e) => e.w)));
	// El elegido solo cuenta si se ve: al quitar su tipo con los filtros, no se apaga todo el mapa.
	const sel = $derived(selected && visible.has(selected) ? selected : null);
	const near = $derived(sel ? neighbours(sel, edges) : []);
	const lit = $derived(sel ? new Set([sel, ...near.map((n) => n.id)]) : null);
	const current = $derived(sel ? byId.get(sel) : undefined);
	// Etiquetas: las de los 18 que más salen y, si hay uno elegido, las de sus vecinos.
	const labelled = $derived(new Set([...[...nodes].sort((a, b) => b.n - a.n).slice(0, 18).map((n) => n.id), ...(lit ?? [])]));

	const r = (n: GraphNode) => 8 + 22 * Math.sqrt(n.n / maxN);
	const px = (v: number) => v * SIZE;

	function pick(id: string) {
		selected = sel === id ? null : id;
	}
	function onKey(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			pick(id);
		}
	}
	const ago = (iso: string | null) => {
		if (!iso) return '';
		const h = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
		return h < 1 ? 'ahora' : h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
	};
	const newsHref = (q: string) => `${routeHref('/news')}?q=${encodeURIComponent(q)}`;
</script>

<ExpHeader {exp} sub={graph ? `Quién sale con quién en ${graph.items} titulares de las últimas ${graph.hours} h` : 'Quién sale con quién en las noticias'} />

<div class="filters">
	<Seg label="Qué se ve" options={KINDS} bind:values={kinds} />
</div>

<div class="layout">
	<div class="sky">
		{#if failed}
			<p class="empty">No se ha podido cargar el mapa.</p>
		{:else if !graph}
			<p class="empty">Cargando…</p>
		{:else if !nodes.length}
			<p class="empty">Nada que unir con ese filtro.</p>
		{:else}
			<svg viewBox="0 0 {SIZE} {SIZE}" role="group" aria-label="Mapa de relaciones en las noticias">
				<g class="edges">
					{#each edges as e (`${e.a}|${e.b}`)}
						{@const a = byId.get(e.a)!}
						{@const b = byId.get(e.b)!}
						<line
							x1={px(a.x)}
							y1={px(a.y)}
							x2={px(b.x)}
							y2={px(b.y)}
							stroke-width={1 + 5 * (e.w / maxW)}
							class:on={lit?.has(e.a) && lit?.has(e.b) && (e.a === sel || e.b === sel)}
							class:dim={lit && !(e.a === sel || e.b === sel)}
						/>
					{/each}
				</g>
				{#each nodes as n (n.id)}
					<g
						class="node {n.kind}"
						class:sel={n.id === sel}
						class:dim={lit && !lit.has(n.id)}
						transform="translate({px(n.x)} {px(n.y)})"
						role="button"
						tabindex="0"
						aria-pressed={n.id === sel}
						aria-label="{n.label}, {KIND_LABEL[n.kind]}, {n.n} titulares"
						onclick={() => pick(n.id)}
						onkeydown={(e) => onKey(e, n.id)}
					>
						<circle r={r(n)} />
						{#if labelled.has(n.id)}
							<text y={-r(n) - 10} text-anchor="middle" font-size="26" stroke-width="6">{n.label}</text>
						{/if}
					</g>
				{/each}
			</svg>
		{/if}
	</div>

	<div class="side">
		<Panel title={current ? current.label : 'Toca un punto'} meta={current ? KIND_LABEL[current.kind] : ''}>
			{#if current}
				<p class="count">{current.n} titulares en {graph?.hours} h · <a href={newsHref(current.query)}>Su ficha en NEWS →</a></p>
				{#if near.length}
					<div class="near">
						<span class="mut">Sale con</span>
						{#each near.slice(0, 10) as nb (nb.id)}
							{@const node = byId.get(nb.id)}
							{#if node}
								<button type="button" onclick={() => pick(nb.id)}>{node.label} <span>{nb.w}</span></button>
							{/if}
						{/each}
					</div>
				{/if}
				<ul class="news">
					{#each current.news as item (item.url)}
						<li>
							<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
							<span class="mut">{item.source} · {ago(item.time)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Cada punto es un país, un líder, un banco central, una empresa o un tema. Cuanto más grande, más titulares; las líneas unen a los que salen juntos.</p>
			{/if}
			{#snippet note()}Sin IA: nombres que reconoce Arc (sus fichas) y temas por palabras, en los titulares de todas las secciones.{/snippet}
		</Panel>
	</div>
</div>

<style>
	.filters {
		margin-bottom: var(--gutter);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 22rem);
		gap: var(--gutter);
		align-items: start;
	}
	.sky {
		border: var(--border);
		background: var(--panel);
		aspect-ratio: 1;
		max-height: calc(100vh - 12rem);
		margin-inline: auto;
		width: 100%;
		max-width: calc(100vh - 12rem);
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
		font-family: var(--mono);
	}
	line {
		stroke: var(--line);
		transition: opacity 0.2s;
	}
	line.on {
		stroke: var(--amber-edge);
	}
	line.dim {
		opacity: 0.25;
	}
	.node {
		cursor: pointer;
		transition: opacity 0.2s;
	}
	.node circle {
		fill: var(--raise);
		stroke: var(--muted);
		stroke-width: 2;
	}
	.node.pais circle {
		stroke: var(--fg);
	}
	.node.banco circle {
		stroke: var(--amber-edge);
	}
	.node.valor circle {
		stroke: var(--muted);
		stroke-dasharray: 2 4;
	}
	.node.tema circle {
		fill: none;
		stroke: var(--faint);
		stroke-dasharray: 8 5;
	}
	.node.lider circle {
		fill: var(--line);
	}
	.node text {
		fill: var(--muted);
		paint-order: stroke;
		stroke: var(--panel);
	}
	.node.sel circle {
		stroke: var(--amber);
		stroke-width: 4;
		fill: var(--amber-soft);
	}
	.node.sel text {
		fill: var(--amber);
	}
	.node.dim {
		opacity: 0.25;
	}
	.node:focus-visible {
		outline: none;
	}
	.node:focus-visible circle,
	.node:hover circle {
		stroke: var(--amber);
	}
	/* El elegido ya va en ámbar: con el teclado, el foco se ve como un trazo discontinuo, también sobre él. */
	.node:focus-visible circle {
		stroke-dasharray: 6 4;
	}
	.count {
		margin: 0;
		padding: var(--sp-10) var(--pad-x) 0;
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.count a {
		color: var(--amber);
		text-decoration: none;
	}
	.near {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--pad-x);
		font-size: var(--fs-xs);
	}
	.near button {
		height: var(--control-h);
		padding: 0 var(--sp-9);
		background: none;
		border: var(--border);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}
	.near button span {
		color: var(--faint);
	}
	.near button:hover,
	.near button:focus-visible {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.news {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.news li {
		display: grid;
		gap: var(--sp-2);
		padding: var(--sp-8) var(--pad-x);
		border-top: var(--border);
	}
	.news a {
		color: var(--fg);
		font-family: var(--sans);
		text-decoration: none;
	}
	.news a:hover {
		color: var(--amber);
	}
	.news .mut {
		font-size: var(--fs-xxs);
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.sky {
			max-height: none;
			max-width: none;
		}
	}
</style>
