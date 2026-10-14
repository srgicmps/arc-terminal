<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import { nf, signed, trend, when } from '#lib/format.ts';
	import { hourly, madridNow } from '#lib/power.ts';
	import { seriesMap, spread } from '#lib/series.ts';
	import { compass, sky } from '#lib/weather.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const get = $derived(seriesMap(data.ecb, data.eurostat, data.bls));
	const premium = $derived(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo'));

	const tags = $derived(new Map(data.headlines.map((h) => [h.url, h.section])));

	// Luz: precio de la hora actual (en el navegador) y el más barato del día.
	const pvpc = $derived(hourly(data.power?.data.pvpc ?? []));
	const now = $derived(clock.now ? madridNow(clock.now) : null);
	const today = $derived(pvpc.filter((p) => p.day === (now?.day ?? pvpc[0]?.day)));
	const current = $derived(now ? today.find((p) => p.hour === now.hour) : undefined);
	const cheapest = $derived([...today].sort((a, b) => a.kwh - b.kwh)[0]);
	// El PVPC de mañana se publica hacia las 20:30: si ya está, su media.
	const tomorrow = $derived.by(() => {
		const day = today[0]?.day;
		const next = pvpc.filter((p) => day && p.day > day);
		return next.length >= 23 ? next.reduce((a, p) => a + p.kwh, 0) / next.length : null;
	});
	const todayAvg = $derived(today.length ? today.reduce((a, p) => a + p.kwh, 0) / today.length : null);

	const mao = $derived(data.weather?.data.places.find((p) => p.name === 'Maó'));

	const g95 = $derived(
		(data.fuel?.data.stations ?? [])
			.filter((s) => s.prices.g95 !== null)
			.sort((a, b) => (a.prices.g95 ?? 0) - (b.prices.g95 ?? 0))
			.slice(0, 3)
	);

	const boeGeneral = $derived(data.boe?.data.sections.find((s) => s.code === '1'));
	const boeTotal = $derived((data.boe?.data.sections ?? []).reduce((n, s) => n + s.total, 0));

	// Terremotos de las últimas 48 h, los más fuertes.
	const quakes = $derived(
		(data.quakes?.data ?? [])
			.filter((q) => Date.parse(data.quakes!.fetchedAt) - Date.parse(q.time) < 48 * 3600_000)
			.sort((a, b) => b.mag - a.mag)
			.slice(0, 4)
	);
</script>

<svelte:head>
	<title>Arc Terminal</title>
</svelte:head>

<div class="grid grid-3">
	<div class="col">
		<Panel title="Tipos y bonos" meta="Zona euro" jump={{ code: 'ECO', href: resolve('/eco') }}>
			<SeriesTable
				head="Indicador"
				spark={36}
				rows={[
					{ series: get('ecb-dfr'), name: 'Tipo depósito BCE', decimals: 2 },
					{ series: get('euribor-12m'), name: 'Euríbor 12 m', decimals: 3 },
					{ series: get('bond10-es'), name: 'Bono España 10 a', decimals: 2 },
					{ series: premium, name: 'Prima de riesgo (pb)', decimals: 0, inverse: true }
				]}
			/>
		</Panel>
		<Panel title="Macro" meta="Último dato" jump={{ code: 'ECO', href: resolve('/eco') }}>
			<SeriesTable
				head="Indicador"
				spark={13}
				rows={[
					{ series: get('unemployment-es'), name: 'Paro España', inverse: true },
					{ series: get('inflation-es'), name: 'IPCA España', inverse: true },
					{ series: get('inflation-ea'), name: 'IPCA zona euro', inverse: true },
					{ series: get('cpi-us'), name: 'IPC EE. UU.', inverse: true },
					{ series: get('unemployment-us'), name: 'Paro EE. UU.', inverse: true }
				]}
			/>
		</Panel>
		<Panel title="Divisas y cripto" jump={{ code: 'WS', href: resolve('/ws') }}>
			<ul class="mini">
				{#each ['eurusd', 'eurgbp', 'eurjpy'] as id (id)}
					{@const s = get(id)}
					{#if s}
						{@const pts = s.points}
						{@const d = pts.length > 1 ? ((pts.at(-1)!.v / pts.at(-2)!.v - 1) * 100) : null}
						<li>
							<span class="l">{s.label}</span>
							<b>{nf(pts.at(-1)!.v, 4)} <em class={trend(d)}>{signed(d, 2)} %</em></b>
						</li>
					{/if}
				{/each}
				{#each (data.crypto?.data.coins ?? []).slice(0, 2) as c (c.id)}
					<li>
						<span class="l">{c.name}</span>
						<b>{nf(c.usd, 0)} $ <em class={trend(c.change24h)}>{signed(c.change24h, 1)} %</em></b>
					</li>
				{/each}
			</ul>
		</Panel>
	</div>

	<div class="col">
		<Panel title="Titulares" meta="Todas las secciones">
			<NewsList items={data.headlines} tag={(i) => tags.get(i.url)} />
		</Panel>
	</div>

	<div class="col">
		{#if mao}
			{@const s = sky(mao.current.code)}
			<Panel title="Menorca" meta={s.label} jump={{ code: 'WX', href: resolve('/wx') }}>
				<ul class="mini">
					<li><span class="l">Maó ahora</span><b>{nf(mao.current.temp, 0)}° · {nf(mao.current.wind, 0)} km/h {compass(mao.current.windDir)}</b></li>
					{#if mao.sea !== null}<li><span class="l">Agua del mar</span><b>{nf(mao.sea, 1)}°</b></li>{/if}
					{#if mao.daily[1]}<li><span class="l">Mañana</span><b>{nf(mao.daily[1].min, 0)}° / {nf(mao.daily[1].max, 0)}° · {sky(mao.daily[1].code).label}</b></li>{/if}
				</ul>
			</Panel>
		{/if}
		<Panel title="Luz" meta="PVPC · €/kWh" jump={{ code: 'LUZ', href: resolve('/luz') }}>
			<ul class="mini">
				{#if current}<li><span class="l">Ahora</span><b>{nf(current.kwh, 3)}</b></li>{/if}
				{#if cheapest}<li><span class="l">Más barata hoy</span><b class="up">{String(cheapest.hour).padStart(2, '0')}:00 · {nf(cheapest.kwh, 3)}</b></li>{/if}
				{#if tomorrow !== null}
					<li>
						<span class="l">Mañana, media</span>
						<b class={todayAvg !== null && tomorrow < todayAvg ? 'up' : 'down'}>{nf(tomorrow, 3)}</b>
					</li>
				{/if}
				{#if !today.length}<li><span class="l">Sin datos todavía</span></li>{/if}
			</ul>
		</Panel>
		<Panel title="Gasolina 95 · Menorca" meta="€/L" jump={{ code: 'FUEL', href: resolve('/fuel') }}>
			<ul class="mini">
				{#each g95 as st, i (st.id)}
					<li>
						<span class="l">{st.name}<small>{st.town}</small></span>
						<b class:up={i === 0}>{nf(st.prices.g95, 3)}</b>
					</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="BOE de hoy" meta="{boeTotal} publicaciones" jump={{ code: 'BOE', href: resolve('/boe') }}>
			<ul class="mini">
				{#each (boeGeneral?.items ?? []).slice(0, 4) as item (item.id)}
					<li><a class="l" href={item.html} target="_blank" rel="noopener">{item.title}</a></li>
				{:else}
					<li><span class="l">Hoy no hay disposiciones generales.</span></li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Terremotos" meta="Últimas 48 h" jump={{ code: 'GEO', href: resolve('/geo') }}>
			<ul class="mini">
				{#each quakes as q (q.id)}
					<li>
						<a class="l" href={q.url} target="_blank" rel="noopener">{q.place}<small>{when(q.time, clock.now)}</small></a>
						<b class:down={q.mag >= 6}>M{nf(q.mag, 1)}</b>
					</li>
				{:else}
					<li><span class="l">Ninguno de M4,5 o más.</span></li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Mercados de predicción" meta="Polymarket" jump={{ code: 'GEO', href: resolve('/geo') }}>
			<ul class="mini">
				{#each (data.predictions?.data.geopolitics ?? []).slice(0, 4) as e (e.id)}
					{@const top = e.outcomes[0]}
					<li>
						<a class="l" href={e.url} target="_blank" rel="noopener">{e.title}<small>{top.label}</small></a>
						<b>{nf(top.p * 100, 0)} %</b>
					</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Hacker News" jump={{ code: 'TECH', href: resolve('/tech') }}>
			<ul class="mini">
				{#each (data.hn?.data ?? []).slice(0, 5) as item (item.id)}
					<li>
						<a class="l" href={item.url} target="_blank" rel="noopener">{item.title}<small>{item.domain}</small></a>
						<b class="mut">{item.points}</b>
					</li>
				{/each}
			</ul>
		</Panel>
	</div>
</div>

<style>
	em {
		margin-left: 6px;
		font-style: normal;
		font-weight: 400;
		font-size: var(--fs-s);
	}
</style>
