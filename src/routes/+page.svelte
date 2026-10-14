<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { latestWatched } from '#lib/boe.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import { dm, nf, when } from '#lib/format.ts';
	import { cheapestNow, hourLabel, hourly, isHour, madridNow } from '#lib/power.ts';
	import { seriesMap, spread } from '#lib/series.ts';
	import { compass, sky } from '#lib/weather.ts';
	import ModularGrid from '#lib/components/ModularGrid.svelte';
	import Morning from '#lib/components/Morning.svelte';
	import MarketSessions from '#lib/components/MarketSessions.svelte';
	import RiskGauge from '#lib/components/RiskGauge.svelte';
	import Agenda from '#lib/components/top/Agenda.svelte';
	import Markets from '#lib/components/top/Markets.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Listen from '#lib/components/ui/Listen.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { initRefCountry, REF_COUNTRIES, refCountry, refName, setRefCountry } from '#lib/refcountry.svelte.ts';
	import { mode, ViewLayout } from '#lib/layout.svelte.ts';
	import type { BoeWeek } from '#lib/types.ts';
	import { initWatchwords, matches, watchwords } from '#lib/watchwords.svelte.ts';
	import { place } from '#lib/place.svelte.ts';
	import { initVisit, newCount, newSinceText, visit } from '#lib/visit.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Vista modular: los paneles de la portada, con un id estable cada uno (es la clave de lo guardado).
	const top = new ViewLayout('top', [
		{ id: 'rates', title: 'Tipos y bonos' },
		{ id: 'macro', title: 'Macro' },
		{ id: 'fx', title: 'Divisas y cripto' },
		{ id: 'important', title: 'Lo importante' },
		{ id: 'news', title: 'Titulares' },
		{ id: 'weather', title: 'Tiempo' },
		{ id: 'power', title: 'Luz' },
		{ id: 'fuel', title: 'Gasolina' },
		{ id: 'boe', title: 'BOE de hoy' },
		{ id: 'quakes', title: 'Terremotos' },
		{ id: 'predictions', title: 'Mercados de predicción' },
		{ id: 'hn', title: 'Hacker News' },
		// Solo en la portada modular (en la general ya están la cinta de cotizaciones y CAL).
		{ id: 'agenda', title: 'Hoy en la agenda' },
		{ id: 'markets', title: 'Mercados' },
		{ id: 'sessions', title: 'Sesiones de las bolsas' },
		{ id: 'risk', title: 'Termómetro de riesgo' },
		{ id: 'puzzle', title: 'Problema del día' }
	]);
	// Como onMounted en Vue: lo guardado en el navegador se lee al arrancar en él.
	$effect(() => top.load());
	$effect(initVisit);
	$effect(initRefCountry);

	const get = $derived(seriesMap(data.ecb, data.eurostat, data.bls));
	const premium = $derived(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo'));

	const tags = $derived(new Map(data.headlines.map((h) => [h.url, h.section])));

	// Luz: precio de la hora actual (en el navegador) y el más barato del día.
	const pvpc = $derived(hourly(data.power?.data.pvpc ?? []));
	const now = $derived(clock.now ? madridNow(clock.now) : null);
	const today = $derived(pvpc.filter((p) => p.day === (now?.day ?? pvpc[0]?.day)));
	const current = $derived(now ? today.find((p) => isHour(p, now)) : undefined);
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

	// Los 3 temas de más peso de hoy (vista IMP); los elige +page.server.ts.
	const important = $derived(data.important.slice(0, 3));

	// «Escuchar» (lote 25): los 5 titulares más importantes de hoy y las cifras clave, en voz alta.
	const spoken = () => {
		const figure = (id: string, name: string, d = 1) => {
			const v = get(id)?.points.at(-1)?.v;
			return v === undefined ? [] : [{ text: `${name}: ${nf(v, d)} %.`, lang: 'es' as const }];
		};
		return [
			{ text: 'Lo más importante de hoy.', lang: 'es' as const },
			...data.important.map((e) => ({ text: `${e.titleEs ?? e.title}.`, lang: e.titleEs || e.lang !== 'en' ? ('es' as const) : ('en' as const) })),
			{ text: 'Las cifras.', lang: 'es' as const },
			...figure(`unemployment-${refCountry.code}`, `Paro en ${refName()}`),
			...figure(`inflation-${refCountry.code}`, `Inflación en ${refName()}`),
			...figure('euribor-12m', 'Euríbor a doce meses', 2)
		];
	};

	const boeGeneral = $derived(data.boe?.data.sections.find((s) => s.code === '1'));
	// Titulares de la portada que nombran alguna palabra vigilada (resaltadas en la lista).
	const watchedNews = $derived(data.headlines.filter((h) => matches(h.title, watchwords.words).length).length);
	const boeTotal = $derived((data.boe?.data.sections ?? []).reduce((n, s) => n + s.total, 0));

	// Palabras vigiladas (las de la vista BOE, guardadas en este navegador): cuántas disposiciones del último
	// sumario las nombran. boe-week.json se pide en el navegador y solo si hay alguna palabra.
	let boeWeek = $state.raw<BoeWeek | null>(null);
	$effect(() => initWatchwords());
	$effect(() => {
		if (!watchwords.ready || !watchwords.words.length || boeWeek) return;
		fetch(asset('data/boe-week.json' as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<BoeWeek>) : null))
			.then((w) => (boeWeek = w))
			.catch(() => {});
	});
	const boeWatch = $derived(latestWatched(boeWeek, watchwords.words));

	// Línea de arriba: titulares nuevos desde la última visita y la franja de luz más barata.
	const fresh = $derived(clock.now && visit.ready ? newSinceText(newCount(data.headlines, visit.last), visit.last, clock.now) : '');
	const cheapWindow = $derived(clock.now ? cheapestNow(pvpc, clock.now) : null);

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

{#snippet tipos()}
	<Panel id="rates" title="Tipos y bonos" meta="Zona euro" jump={{ code: 'ECO', href: resolve('/eco') }}>
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
{/snippet}

{#snippet macro()}
	<Panel id="macro" title="Macro" meta="Último dato" jump={{ code: 'ECO', href: resolve('/eco') }}>
		<div class="ref">
			<Select label="País" value={refCountry.code} onchange={setRefCountry}>
				{#each REF_COUNTRIES as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
			</Select>
		</div>
		<SeriesTable
			head="Indicador"
			spark={13}
			rows={[
				{ series: get(`unemployment-${refCountry.code}`), name: `Paro ${refName()}`, inverse: true },
				{ series: get(`inflation-${refCountry.code}`), name: `IPCA ${refName()}`, inverse: true },
				{ series: get(`debt-${refCountry.code}`), name: `Deuda ${refName()} (% PIB)`, decimals: 1, inverse: true },
				{ series: get('inflation-ea'), name: 'IPCA zona euro', inverse: true },
				{ series: get('cpi-us'), name: 'IPC EE. UU.', inverse: true },
				{ series: get('unemployment-us'), name: 'Paro EE. UU.', inverse: true }
			]}
		/>
	</Panel>
{/snippet}

{#snippet divisas()}
	<Panel id="fx" title="Divisas y cripto" jump={{ code: 'WS', href: resolve('/ws') }}>
		<ul class="mini">
			{#each ['eurusd', 'eurgbp', 'eurjpy'] as id (id)}
				{@const s = get(id)}
				{#if s}
					{@const pts = s.points}
					{@const d = pts.length > 1 ? ((pts.at(-1)!.v / pts.at(-2)!.v - 1) * 100) : null}
					<li>
						<span class="l">{s.label}</span>
						<b>{nf(pts.at(-1)!.v, 4)} <em><Change value={d} unit=" %" /></em></b>
					</li>
				{/if}
			{/each}
			{#each (data.crypto?.data.coins ?? []).slice(0, 2) as c (c.id)}
				<li>
					<span class="l">{c.name}</span>
					<b>{nf(c.usd, 0)} $ <em><Change value={c.change24h} digits={1} unit=" %" /></em></b>
				</li>
			{/each}
		</ul>
	</Panel>
{/snippet}

{#snippet importante()}
	<Panel id="important" title="Lo importante" meta="Hoy" jump={{ code: 'IMP', href: resolve('/imp') }}>
		{#if important.length}
			<ul class="mini">
				{#each important as e (e.k)}
					<li>
						<a class="l" href={e.url} target="_blank" rel="noopener">{e.title}</a>
						<b class="mut">{e.sources.length} {e.sources.length === 1 ? 'medio' : 'medios'}</b>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Sin datos todavía</p>
		{/if}
		{#snippet note()}<Listen lines={spoken} label="Escuchar los 5 titulares y las cifras" />{/snippet}
	</Panel>
{/snippet}

{#snippet agenda()}
	<Agenda earnings={data.earnings} holidays={data.holidays} />
{/snippet}

{#snippet markets()}
	<Markets />
{/snippet}

{#snippet sessions()}
	<Panel id="sessions" title="Sesiones de las bolsas" meta="24 h · hora de Madrid" jump={{ code: 'WS', href: resolve('/ws') }}>
		<MarketSessions />
	</Panel>
{/snippet}

{#snippet risk()}
	<RiskGauge id="risk" risk={data.risk} />
{/snippet}

{#snippet puzzle()}
	<!-- Se carga aparte (import dinámico): lleva chess.js, unos 17 KB que la portada no necesita si no está este panel. -->
	{#await import('#lib/components/PuzzleCard.svelte')}
		<Panel id="puzzle" title="Problema del día"><p class="empty">Cargando…</p></Panel>
	{:then { default: PuzzleCard }}
		<PuzzleCard id="puzzle" puzzle={data.puzzle} />
	{/await}
{/snippet}

{#snippet titulares()}
	<Panel
		id="news"
		title="Titulares"
		meta={`${data.headlines.length} de ${data.headlinesTotal}${watchedNews ? ` · ${watchedNews} con tus palabras` : ''}`}
		jump={{ code: 'NEWS', href: resolve('/news') }}
	>
		<NewsList items={data.headlines} tag={(i) => tags.get(i.url)} />
	</Panel>
{/snippet}

{#snippet menorca()}
	{#if mao}
		{@const s = sky(mao.current.code)}
		<Panel id="weather" title="Menorca" meta={s.label} jump={{ code: 'WX', href: resolve('/wx') }}>
			<ul class="mini">
				<li><span class="l">Maó ahora</span><b>{nf(mao.current.temp, 0)}° · {nf(mao.current.wind, 0)} km/h {compass(mao.current.windDir)}</b></li>
				{#if mao.sea !== null}<li><span class="l">Agua del mar</span><b>{nf(mao.sea, 1)}°</b></li>{/if}
				{#if mao.daily[1]}<li><span class="l">Mañana</span><b>{nf(mao.daily[1].min, 0)}° / {nf(mao.daily[1].max, 0)}° · {sky(mao.daily[1].code).label}</b></li>{/if}
			</ul>
		</Panel>
	{/if}
{/snippet}

{#snippet luz()}
	<Panel id="power" title="Luz" meta="PVPC · €/kWh" jump={{ code: 'LUZ', href: resolve('/luz') }}>
		<ul class="mini">
			{#if current}<li><span class="l">Ahora</span><b>{nf(current.kwh, 3)}</b></li>{/if}
			{#if cheapest}<li><span class="l">Más barata hoy</span><b class="up">{hourLabel(cheapest)} · {nf(cheapest.kwh, 3)}</b></li>{/if}
			{#if cheapWindow}<li><span class="l">Franja de 2 h{cheapWindow.tomorrow ? ', mañana' : ''}</span><b class="up">{hourLabel(cheapWindow.first)}–{hourLabel(cheapWindow.after)} · {nf(cheapWindow.avg, 3)}</b></li>{/if}
			{#if tomorrow !== null}
				<li>
					<span class="l">Mañana, media</span>
					<b class={todayAvg !== null && tomorrow < todayAvg ? 'up' : 'down'}>{nf(tomorrow, 3)}</b>
				</li>
			{/if}
			{#if !today.length}<li><span class="l">Sin datos todavía</span></li>{/if}
		</ul>
	</Panel>
{/snippet}

{#snippet gasolina()}
	<Panel id="fuel" title="Gasolina 95 · Menorca" meta="€/L" jump={{ code: 'FUEL', href: resolve('/fuel') }}>
		<ul class="mini">
			{#each g95 as st, i (st.id)}
				<li>
					<span class="l">{st.name}<small>{st.town}</small></span>
					<b class:up={i === 0}>{nf(st.prices.g95, 3)}</b>
				</li>
			{/each}
		</ul>
	</Panel>
{/snippet}

{#snippet boe()}
	<Panel id="boe" title="BOE de hoy" meta="{boeTotal} publicaciones" jump={{ code: 'BOE', href: resolve('/boe') }}>
		<ul class="mini">
			{#if boeWatch}
				<li>
					<a class="l" href={resolve('/boe')}
						>Con tus palabras vigiladas{#if boeWatch.date !== now?.day}<small>BOE del {dm(boeWatch.date)}</small>{/if}</a
					>
					<b class:strong={boeWatch.count > 0}>{boeWatch.count}</b>
				</li>
			{/if}
			{#each (boeGeneral?.items ?? []).slice(0, 4) as item (item.id)}
				<li><a class="l" href={item.html || item.pdf} target="_blank" rel="noopener">{item.title}</a></li>
			{:else}
				<li><span class="l">Hoy no hay disposiciones generales.</span></li>
			{/each}
		</ul>
	</Panel>
{/snippet}

{#snippet terremotos()}
	<Panel id="quakes" title="Terremotos" meta="Últimas 48 h" jump={{ code: 'GEO', href: resolve('/geo') }}>
		<ul class="mini">
			{#each quakes as q (q.id)}
				<li>
					<a class="l" href={q.url} target="_blank" rel="noopener">{q.place}<small>{when(q.time, clock.now)}</small></a>
					<b class:strong={q.mag >= 6}>M{nf(q.mag, 1)}</b>
				</li>
			{:else}
				<li><span class="l">Ninguno de M4,5 o más.</span></li>
			{/each}
		</ul>
	</Panel>
{/snippet}

{#snippet predicciones()}
	<Panel id="predictions" title="Mercados de predicción" meta="Polymarket" jump={{ code: 'GEO', href: resolve('/geo') }}>
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
{/snippet}

{#snippet hn()}
	<Panel id="hn" title="Hacker News" jump={{ code: 'TECH', href: resolve('/tech') }}>
		<ul class="mini">
			{#each (data.hn?.data ?? []).slice(0, 5) as item (item.id)}
				<li>
					<a class="l" href={item.url} target="_blank" rel="noopener">{item.title}<small>{item.domain}</small></a>
					<b class="mut">{item.points}</b>
				</li>
			{/each}
		</ul>
	</Panel>
{/snippet}

<!-- «Mi mañana»: el tiempo de «Tu sitio», la luz, la agenda y los avisos de hoy (se pliega a partir de las 11). -->
<Morning
	weather={data.weather?.data}
	power={data.power?.data}
	earnings={data.earnings}
	holidays={{ items: data.holidays }}
	alerts={data.alerts?.data}
	city={place.current.name}
/>

<!-- Hoy, en una línea: titulares nuevos y la luz de mañana (la de hoy ya está en «Mi mañana»). Siempre ocupa su
	sitio para que nada salte al cargar. -->
<p class="today">
	{fresh}{#if fresh && cheapWindow?.tomorrow}{' · '}{/if}{#if cheapWindow?.tomorrow}Luz más barata mañana: <b>{hourLabel(cheapWindow.first)}–{hourLabel(cheapWindow.after)}</b> · {nf(cheapWindow.avg, 3)} €/kWh{/if}
</p>

{#if mode.modular}
	<ModularGrid
		layout={top}
		panels={{ rates: tipos, macro, fx: divisas, important: importante, news: titulares, weather: menorca, power: luz, fuel: gasolina, boe, quakes: terremotos, predictions: predicciones, hn, agenda, markets, sessions, risk, puzzle }}
	/>
{:else}
	<div class="grid grid-3">
		<div class="col">
			{@render tipos()}
			{@render macro()}
			{@render divisas()}
		</div>

		<div class="col">
			{@render importante()}
			{@render titulares()}
		</div>

		<div class="col">
			{@render menorca()}
			{@render luz()}
			{@render gasolina()}
			{@render boe()}
			{@render terremotos()}
			{@render predicciones()}
			{@render hn()}
		</div>
	</div>
{/if}

<style>
	/* «País» del panel Macro: una fila discreta encima de la tabla. */
	.ref {
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}

	.today {
		min-height: calc(var(--fs-xs) * var(--lh));
		margin: 0 0 var(--sp-8);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.today b {
		color: var(--up);
		font-weight: var(--fw-medium);
	}

	.strong {
		color: var(--amber);
	}

	em {
		margin-left: var(--sp-6);
		font-style: normal;
		font-weight: var(--fw-regular);
		font-size: var(--fs-s);
	}
</style>
