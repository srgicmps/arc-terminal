<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import HnTable from '#lib/components/HnTable.svelte';
	import InternetStatusPanel from '#lib/components/InternetStatusPanel.svelte';
	import KevTable from '#lib/components/KevTable.svelte';
	import LaunchesPanel from '#lib/components/LaunchesPanel.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuoteBoard from '#lib/components/QuoteBoard.svelte';
	import RadarPanel from '#lib/components/RadarPanel.svelte';
	import ReleaseList from '#lib/components/ReleaseList.svelte';
	import TradeList from '#lib/components/TradeList.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { HN_TOPICS, hnByTopic, type HnTopic } from '#lib/hn.ts';
	import { BIG_TECH } from '#lib/tickers/bigtech.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Vulnerabilidades añadidas hoy (día UTC, el de la CISA). Solo se destacan a partir de 3, y solo si los
	// datos son de hoy: clock.now vale 0 al construir, así que el HTML estático sale sin destacar.
	const HOT = 3;
	const kev = $derived(data.kev?.data);
	const kevToday = $derived(
		kev && clock.now && kev.day === new Date(clock.now).toISOString().slice(0, 10) ? kev.today : 0
	);

	// Filtro de la portada de Hacker News por tema (src/lib/hn.ts).
	let topic = $state<HnTopic>('all');
	const hn = $derived(hnByTopic(data.hn?.data ?? [], topic));

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="TECH" title="Tecnología" sub={sources ? `Hacker News, ${sources}` : 'Hacker News'} />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Titulares" meta="Tecnología" jump={{ code: 'NEWS', href: `${resolve('/news')}?s=tech` }}>
			<NewsList items={data.news?.data.items ?? []} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-tech" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Tecnológicas en bolsa" meta="TradingView · toca un código para su ficha">
			<QuoteBoard name="Tecnológicas" codes={BIG_TECH} />
		</Panel>
		<InternetStatusPanel />
		<!-- Sin el token CLOUDFLARE_RADAR_TOKEN no hay datos: el panel no sale. -->
		{#if data.ddos}<RadarPanel {...data.ddos} />{/if}
		<LaunchesPanel />
		{#if data.reg?.data.items.length}
			<Panel title="Regulación" meta="UE · ley de IA, mercado digital y multas de datos">
				<NewsList items={data.reg.data.items} />
				{#snippet note()}
					Comisión Europea (estrategia digital) y Comité Europeo de Protección de Datos ·
					<Updated at={data.reg?.fetchedAt} source="news-reg" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Hacker News" meta="Portada, por puntos">
			<div class="topics"><Seg label="Tema" options={HN_TOPICS} bind:value={topic} /></div>
			{#if hn.length}<HnTable items={hn} />{:else}<p class="empty">Nada de este tema en la portada ahora mismo.</p>{/if}
			{#snippet note()}Fuente: Hacker News (API de Algolia) · <Updated at={data.hn?.fetchedAt} source="hn" />{/snippet}
		</Panel>
		<Panel
			title="Vulnerabilidades explotadas (CISA)"
			meta={kevToday >= HOT ? `${kevToday} nuevas hoy` : kev ? `${kev.total} en el catálogo` : undefined}
			accent={kevToday >= HOT}
		>
			<KevTable items={kev?.items ?? []} />
			{#snippet note()}
				Catálogo KEV de la <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener">CISA</a>: fallos que
				ya se están aprovechando. Cada CVE enlaza a su ficha en el NVD · <Updated at={data.kev?.fetchedAt} source="cisa-kev" />
			{/snippet}
		</Panel>
		{#if data.exports?.data.length}
			<Panel title="Chips y exportaciones" meta="Control de exportaciones de EE. UU. · BIS">
				<TradeList items={data.exports.data} />
				{#snippet note()}
					Normas de la BIS (Departamento de Comercio): Entity List, chips y computación avanzada; las de chips, primero.
					Fuente: Federal Register · <Updated at={data.exports?.fetchedAt} source="sanctions" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Versiones" meta="Última estable · ámbar: últimos 7 días">
			<ReleaseList items={data.releases?.data ?? []} />
			{#snippet note()}Fuente: releases de GitHub · <Updated at={data.releases?.fetchedAt} source="releases" />{/snippet}
		</Panel>
	</div>
</div>

<style>
	/* Filtro por tema encima de la tabla, con el espaciado de la cabecera del panel. */
	.topics {
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
	}
</style>
