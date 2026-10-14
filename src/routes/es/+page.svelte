<script lang="ts">
	import { resolve } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { nf } from '#lib/format.ts';
	import { hourly } from '#lib/power.ts';
	import { seriesMap, spread } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const spainEu = new Set(['La Moncloa', 'Banco de España', 'Comisión Europea']);
	const official = $derived((data.gov?.data.items ?? []).filter((i) => spainEu.has(i.source)));
	// Del BOE, las disposiciones generales (leyes, reales decretos, órdenes).
	const general = $derived(data.boe?.data.sections.find((s) => s.code === '1')?.items ?? []);
	const get = $derived(seriesMap(data.eurostat, data.ecb, data.ine));
	const premium = $derived(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo'));
	const fuelAvg = $derived(data.fuel?.data.avg);
	const pvpc = $derived(hourly(data.power?.data.pvpc ?? []));
	const luzHoy = $derived.by(() => {
		const day = pvpc[0]?.day;
		const today = pvpc.filter((p) => p.day === day);
		return today.length ? today.reduce((a, p) => a + p.kwh, 0) / today.length : null;
	});
	const strongestQuake = $derived([...(data.quakes?.data ?? [])].sort((a, b) => b.mag - a.mag)[0]);

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="ES" title="España" sub={sources} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias">
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-es" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="España en cifras" meta="Último dato">
			<SeriesTable
				head="Indicador"
				rows={[
					{ series: get('ipc-es'), name: 'IPC (INE)', inverse: true },
					{ series: get('ipc-ib'), name: 'IPC Baleares', inverse: true },
					{ series: get('epa-es'), name: 'Paro (EPA)', decimals: 2, inverse: true },
					{ series: get('epa-ib'), name: 'Paro Baleares (EPA)', decimals: 2, inverse: true },
					{ series: get('unemployment-es'), name: 'Paro mensual (Eurostat)', inverse: true },
					{ series: get('youth-unemployment-es'), name: 'Paro juvenil', inverse: true },
					{ series: get('inflation-es'), name: 'Inflación (IPCA)', inverse: true },
					{ series: get('gdp-es'), name: 'PIB, trimestral' },
					{ series: get('debt-es'), name: 'Deuda pública (% PIB)', inverse: true },
					{ series: get('bond10-es'), name: 'Bono a 10 años', decimals: 2 },
					{ series: premium, name: 'Prima de riesgo (pb)', decimals: 0, inverse: true },
					{ series: get('mortgage-es'), name: 'Hipotecas nuevas', decimals: 2, inverse: true }
				]}
			/>
			<ul class="mini">
				{#if fuelAvg}
					<li><span class="l">Gasolina 95, media de España</span><b>{nf(fuelAvg.g95, 3)} €/L</b></li>
					<li><span class="l">Diésel, media de España</span><b>{nf(fuelAvg.diesel, 3)} €/L</b></li>
				{/if}
				{#if luzHoy !== null}<li><span class="l">Luz hoy, media PVPC</span><b>{nf(luzHoy, 3)} €/kWh</b></li>{/if}
				{#if strongestQuake}
					<li>
						<span class="l">Terremoto más fuerte (10 días)<small>{strongestQuake.place}</small></span>
						<b>M{nf(strongestQuake.mag, 1)}</b>
					</li>
				{/if}
			</ul>
			{#snippet note()}Fuentes: INE, Eurostat, BCE, Ministerio para la Transición Ecológica, REE e IGN{/snippet}
		</Panel>
		{#if get('turistas-es') || get('ipv-es')}
			<Panel title="Turismo y vivienda" meta="INE · último dato">
				<SeriesTable
					head="Indicador"
					rows={[
						{ series: get('turistas-es'), name: 'Turistas internacionales (mill.)', decimals: 2 },
						{ series: get('turistas-ib'), name: 'Turistas en Baleares (mill.)', decimals: 2 },
						{ series: get('ipv-es'), name: 'Precio de la vivienda, var. anual' },
						{ series: get('ipv-ib'), name: 'Vivienda Baleares, var. anual' }
					]}
				/>
				{#snippet note()}
					Turistas que llegan en el mes (FRONTUR) e Índice de Precios de Vivienda, trimestral. Fuente: INE ·
					<Updated at={data.ine?.fetchedAt} source="ine" />
				{/snippet}
			</Panel>
		{/if}
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
