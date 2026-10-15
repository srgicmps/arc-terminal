<script lang="ts">
	import { resolve } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Traffic from '#lib/components/Traffic.svelte';
	import QuakeTable from '#lib/components/QuakeTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import { euriborPhrase, fuelPhrase, gdpPhrase, inflationPhrase, phrases, powerPhrase, premiumPhrase, unemploymentPhrase } from '#lib/plain.ts';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { dm, nf, period } from '#lib/format.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { hourly, madridNow } from '#lib/power.ts';
	import { seriesMap, spread } from '#lib/series.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const items = $derived(data.news?.data.items ?? []);
	const spainEu = new Set(['La Moncloa', 'Banco de España', 'Comisión Europea']);
	const official = $derived((data.gov?.data.items ?? []).filter((i) => spainEu.has(i.source)));
	// Del BOE, las disposiciones generales (leyes, reales decretos, órdenes).
	const general = $derived(data.boe?.data.sections.find((s) => s.code === '1')?.items ?? []);
	const get = $derived(seriesMap(data.eurostat, data.ecb, data.ine, data.afiliacion));
	const premium = $derived(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo'));
	const fuelAvg = $derived(data.fuel?.data.avg);
	const pvpc = $derived(hourly(data.power?.data.pvpc ?? []));
	const luzHoy = $derived.by(() => {
		// El día de hoy en Madrid (en el navegador); sin reloj aún, el primero que trae la descarga.
		const day = (clock.now ? madridNow(clock.now).day : null) ?? pvpc[0]?.day;
		const today = pvpc.filter((p) => p.day === day);
		return today.length ? today.reduce((a, p) => a + p.kwh, 0) / today.length : null;
	});
	const paro = $derived(data.paro?.data);
	const paroPct = (now: number, before: number | undefined) => (before ? ((now - before) / before) * 100 : null);
	const strongestQuake = $derived([...(data.quakes?.data ?? [])].sort((a, b) => b.mag - a.mag)[0]);

	// Modo Sencillo: los datos clave de España contados en frases (src/lib/plain.ts).
	const plain = $derived(
		phrases([
			inflationPhrase('España', get('ipc-es')?.points),
			unemploymentPhrase('España', get('unemployment-es')?.points),
			gdpPhrase('España', get('gdp-es')?.points),
			premiumPhrase('España', premium?.points.at(-1)?.v),
			euriborPhrase(get('euribor-12m')?.points),
			powerPhrase(luzHoy),
			fuelPhrase('España', fuelAvg?.g95)
		])
	);

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="ES" title="España" sub={sources} {plain} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="{items.length} noticias" jump={{ code: 'NEWS', href: `${resolve('/news')}?s=es` }}>
			<NewsList {items} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-es" />{/snippet}
		</Panel>
		<Traffic data={data.traffic} />
		<Panel title="Terremotos en España" meta="Últimos 10 días · los 15 más fuertes">
			<QuakeTable
				quakes={[...(data.quakes?.data ?? [])].sort((a, b) => b.mag - a.mag).slice(0, 15)}
				empty={data.quakes ? 'Sin terremotos en España en los últimos 10 días.' : undefined}
			/>
			{#snippet note()}Fuente: Instituto Geográfico Nacional · <Updated at={data.quakes?.fetchedAt} source="quakes-es" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="España en cifras" meta="Último dato">
			<SeriesTable next={data.next}
				head="Indicador"
				rows={[
					{ series: get('ipc-es'), name: 'Inflación (IPC)', inverse: true, alt: { series: get('inflation-es'), label: 'IPCA' } },
					{ series: get('ipc-ib'), name: 'IPC Baleares', inverse: true },
					{ series: get('epa-es'), name: 'Paro (EPA)', decimals: 2, inverse: true, alt: { series: get('unemployment-es'), label: 'Mensual', decimals: 1 } },
					{ series: get('epa-ib'), name: 'Paro Baleares (EPA)', decimals: 2, inverse: true },
					{ series: get('afiliados-es'), name: 'Afiliados a la Seguridad Social (mill.)', decimals: 2 },
					{ series: get('youth-unemployment-es'), name: 'Paro juvenil', inverse: true },
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
			{#snippet note()}Fuentes: INE, Eurostat, Seguridad Social, BCE, Ministerio para la Transición Ecológica, REE e IGN{/snippet}
		</Panel>
		{#if paro?.regions.length}
			{@const nat = paro.national}
			{@const total = nat.at(-1)?.v ?? 0}
			{@const yearAgo = nat.find((p) => p.t === `${Number(paro.month.slice(0, 4)) - 1}${paro.month.slice(4)}`)?.v}
			<Panel title="Paro registrado por comunidad" meta="SEPE · {period(paro.month)}">
				<Table>
					<thead><tr><th>Comunidad</th><th>Parados</th><th>Mes</th><th>Año</th></tr></thead>
					<tbody>
						<tr class="total">
							<td class="name">España</td>
							<td>{nf(total, 0)}</td>
							<td><Change value={paroPct(total, nat.at(-2)?.v)} digits={1} unit=" %" invert /></td>
							<td><Change value={paroPct(total, yearAgo)} digits={1} unit=" %" invert /></td>
						</tr>
						{#each paro.regions as r (r.code)}
							<tr>
								<td class="name">{r.name}</td>
								<td>{nf(r.value, 0)}</td>
								<td><Change value={r.mom} digits={1} unit=" %" invert /></td>
								<td><Change value={r.yoy} digits={1} unit=" %" invert /></td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					Demandantes de empleo parados a fin de mes, variación frente al mes anterior y al mismo mes del año pasado.
					Suma de los municipios (el SEPE da «&lt;5» en los pequeños), así que el total es aproximado. La afiliación,
					en «España en cifras». Fuente: SEPE, datos abiertos · <Updated at={data.paro?.fetchedAt} source="paro" />
				{/snippet}
			</Panel>
		{/if}
		{#if get('turistas-es') || get('ipv-es')}
			<Panel title="Turismo y vivienda" meta="INE · último dato">
				<SeriesTable next={data.next}
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
		<Panel
			title="BOE de hoy"
			meta={data.boe ? `Disposiciones generales · ${dm(`${data.boe.data.date}T12:00:00Z`)}` : 'Disposiciones generales'}
			jump={{ code: 'BOE', href: resolve('/boe') }}>
			{#if general.length}
				<ul class="mini">
					{#each general.slice(0, 12) as item (item.id)}
						<li>
							<a class="l" href={item.html || item.pdf} target="_blank" rel="noopener">{item.title}</a>
						</li>
					{/each}
				</ul>
			{:else if data.boe}
				<p class="empty">Este sumario no trae disposiciones generales.</p>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
		</Panel>
		<Panel title="Gobierno y Europa" meta="Comunicados oficiales">
			<NewsList items={official.slice(0, 15)} />
		</Panel>
	</div>
</div>

<style>
	.total td {
		font-weight: var(--fw-medium);
	}
</style>
