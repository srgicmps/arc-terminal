<script lang="ts">
	import { resolve } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const spainEu = new Set(['La Moncloa', 'Banco de España', 'Comisión Europea', 'Parlamento Europeo']);
	const official = $derived((data.gov?.data.items ?? []).filter((i) => spainEu.has(i.source)));
	// Del BOE, las disposiciones generales (leyes, reales decretos, órdenes).
	const general = $derived(data.boe?.data.sections.find((s) => s.code === '1')?.items ?? []);
	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.count).map((f) => f.name).join(', '));
</script>

<ViewHeader code="ES" title="España" sub={sources} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias">
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="BOE de hoy" meta="Disposiciones generales" jump={{ code: 'BOE', href: resolve('/boe') }}>
			{#if general.length}
				<ul class="mini">
					{#each general.slice(0, 12) as item (item.id)}
						<li>
							<a class="l" href={item.html} target="_blank" rel="noopener">{item.title}</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Hoy no hay disposiciones generales.</p>
			{/if}
		</Panel>
		<Panel title="Gobierno y Europa" meta="Comunicados oficiales">
			<NewsList items={official.slice(0, 15)} />
		</Panel>
	</div>
</div>
