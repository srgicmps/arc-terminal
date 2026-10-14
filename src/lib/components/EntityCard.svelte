<!--
	Ficha de lo buscado en NEWS (M29): valor, líder, banco central o país, con lo básico y el salto a su vista.
	Uso: <EntityCard entity={findEntity(query)} /> (src/lib/entities.ts).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import type { Entity } from '#lib/entities.ts';
	import { dm } from '#lib/format.ts';
	import { BANKS, daysBetween, inDays, madridDate, upcoming } from '#lib/meetings.ts';
	import { tvSymbol } from '#lib/tickers.ts';
	import Panel from './Panel.svelte';
	import TvWidget from './TvWidget.svelte';

	let { entity }: { entity: Entity } = $props();

	const today = $derived(madridDate(clock.now || Date.now()));
	const next = $derived(entity.kind === 'bank' ? upcoming(today, entity.bank)[0] : undefined);
</script>

{#if entity.kind === 'ticker'}
	{@const t = entity.ticker}
	<Panel title={t.name} meta="Valor · {t.code}" jump={{ code: t.code, href: `${resolve('/s')}?sym=${encodeURIComponent(t.code)}` }}>
		<TvWidget widget="symbol-info" config={{ symbol: tvSymbol(t.code) }} height={190} credit={false} />
	</Panel>
{:else if entity.kind === 'leader'}
	{@const l = entity.leader}
	<Panel title={l.name} meta="Líder" jump={{ code: 'LIDER', href: resolve('/lider') }}>
		<ul class="mini">
			<li><span class="l">{l.role}</span></li>
			<li><span class="l mut">Agenda de hoy y lo último ({l.recentLabel}) en LIDER</span></li>
		</ul>
	</Panel>
{:else if entity.kind === 'bank'}
	{@const b = BANKS[entity.bank]}
	<Panel title={b.long} meta={b.name} jump={{ code: 'CAL', href: resolve('/cal') }}>
		<ul class="mini">
			{#if next}
				<li>
					<span class="l">Próxima decisión de tipos</span>
					<b>{dm(`${next.date}T12:00:00Z`)} · {inDays(daysBetween(today, next.date))}</b>
				</li>
			{/if}
			<li><a class="l" href={b.url} target="_blank" rel="noopener">Calendario oficial de reuniones</a></li>
		</ul>
	</Panel>
{:else}
	{@const c = entity.country}
	<Panel title={c.name} meta="País · {c.code}" jump={{ code: 'PAIS', href: `${resolve('/pais')}?c=${c.code}` }}>
		<ul class="mini">
			<li><span class="l">Moneda</span><b>{c.currency}{c.euro ? ' · zona euro' : ''}</b></li>
			<li><span class="l mut">Economía, mercados, bono a 10 años y noticias en PAIS</span></li>
		</ul>
	</Panel>
{/if}
