<!--
	QUIEN (F18): quién cuenta cada noticia. Las historias llegan ya agrupadas (src/lib/coverage.ts, en
	+page.server.ts); aquí solo se pintan: regiones que la cuentan, ángulos muertos y medios.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { coverageSentence, OUTLET_REGION, PRESS, REGIONS, type Region } from '#lib/coverage.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const plain = $derived([coverageSentence(data.stories)].filter(Boolean));
	const blind = $derived(data.stories.filter((s) => s.missing.length >= 4).length);
	const time = (iso: string | null) =>
		iso ? new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
	const shown = (s: { regions: Region[] }) => REGIONS.filter((r) => PRESS.includes(r.key) || s.regions.includes(r.key));
	const byRegion = REGIONS.map((r) => ({ ...r, outlets: Object.entries(OUTLET_REGION).filter(([, v]) => v === r.key).map(([k]) => k) }));
</script>

<ViewHeader code="QUIEN" title="Quién lo cuenta" sub="El mismo hecho en varios medios, por región · todos los titulares" {plain} />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Historias" meta="{data.stories.length} con dos medios o más{blind ? ` · ${blind} con 4+ ángulos muertos` : ''}">
			{#if data.stories.length}
				<ol class="stories">
					{#each data.stories as s (s.url)}
						<li>
							<a class="title" href={s.url} target="_blank" rel="noopener">{s.title}</a>
							<p class="regions" aria-label="Regiones">
								{#each shown(s) as r (r.key)}
									{@const on = s.regions.includes(r.key)}
									<span class:on title="{r.label}: {on ? 'lo cuenta' : 'no lo cuenta'}">{r.short}</span>
								{/each}
								<span class="mut when">{time(s.time)}</span>
							</p>
							<p class="outlets">
								{#each s.outlets as o, i (o.source)}{#if i}<span class="mut">{' · '}</span>{/if}<a href={o.url} target="_blank" rel="noopener">{o.source}</a>{/each}
							</p>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">Ahora mismo ninguna noticia sale en dos medios a la vez.</p>
			{/if}
			{#snippet note()}
				En ámbar, las regiones que la cuentan; tachadas, los ángulos muertos. Agrupado sin IA, por parecido de titulares · <Updated at={data.fetchedAt} source="news-geo" />
			{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Medios por región">
			<ul class="mini">
				{#each byRegion as r (r.key)}
					<li><span class="l">{r.label}<small>{r.outlets.join(', ')}</small></span></li>
				{/each}
			</ul>
			{#snippet note()}Organismos (ONU, OMC, OIEA…) no cuentan para los ángulos muertos{/snippet}
		</Panel>
	</div>
</div>

<style>
	.stories {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.stories li {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	.title {
		font-family: var(--sans);
		color: var(--fg);
		text-decoration: none;
	}

	.title:hover {
		color: var(--amber);
	}

	.regions,
	.outlets {
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-s);
	}

	.regions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		font-family: var(--mono);
	}

	.regions span {
		color: var(--muted);
		text-decoration: line-through;
	}

	.regions span.on {
		color: var(--amber);
		text-decoration: none;
	}

	.regions .when {
		margin-left: auto;
		text-decoration: none;
	}

	.outlets a {
		color: var(--muted);
		text-decoration: none;
	}

	.outlets a:hover {
		color: var(--amber);
	}
</style>
