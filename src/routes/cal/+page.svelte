<script lang="ts">
	import { resolve } from '$app/paths';
	import { clock } from '#lib/clock.svelte.ts';
	import { dayParam } from '#lib/dayparam.svelte.ts';
	import Panel from '#lib/components/Panel.svelte';
	import Puentes from '#lib/components/Puentes.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { CAL_COUNTRIES, CAL_DEFAULT, CAL_IMPORTANCE, calConfig, parseCalFilters, type CalFilters } from '#lib/cal-filters.ts';
	import { compact, dm, hm, nf, weekday } from '#lib/format.ts';
	import { bmeHolidays, nyseHolidays } from '#lib/markets.ts';
	import { CB, cbUpcoming } from '#lib/cb-calendar.ts';
	import { madridDate } from '#lib/meetings.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Filtros del calendario (países e importancia), guardados en este navegador (arc-cal). Si no deja
	// guardar, se quedan en memoria.
	const CAL_KEY = 'arc-cal';
	let filters = $state<CalFilters>(CAL_DEFAULT);
	let loaded = $state(false);
	$effect(() => {
		try {
			filters = parseCalFilters(localStorage.getItem(CAL_KEY));
		} catch {}
		loaded = true;
	});
	$effect(() => {
		const json = JSON.stringify(filters);
		if (!loaded) return;
		try {
			localStorage.setItem(CAL_KEY, json);
		} catch {}
	});
	const calendar = $derived(calConfig(filters));

	const earnings = $derived(data.finnhub?.data.earnings ?? []);

	// Salidas a bolsa desde hoy (las de los últimos días quedan en el JSON por si la web se construyó ayer).
	const ipos = $derived((data.finnhub?.data.ipos ?? []).filter((i) => i.date >= today).slice(0, 20));
	/** «18.00-20.00» → «18–20» · «12.50» → «12,50» */
	const price = (p: string) =>
		p
			? p
					.split('-')
					.map((n) => nf(Number(n), Number(n) % 1 ? 2 : 0))
					.join('–')
			: '—';

	// Agenda .ics (src/routes/agenda.ics): https al construir (así el prerender la genera) y webcal:// en el navegador.
	const icsPath = resolve('/agenda.ics');
	let icsHref = $state<string>(icsPath);
	$effect(() => {
		icsHref = `webcal://${location.host}${icsPath}`;
	});

	const HOUR: Record<string, string> = { bmo: 'Pre', amc: 'Post', dmh: 'Sesión' };

	// Festivos de los próximos 12 meses: España y Baleares (Nager.Date) y días sin bolsa (por reglas).
	// Fecha de hoy en Madrid. Hasta que arranca el reloj en el navegador se usa la fecha en la que se
	// construyó la página.
	const today = $derived(madridDate(clock.now || Date.now()));
	// «CAL viernes» (M49): las filas de ese día, resaltadas.
	const pick = dayParam();
	// Modo Sencillo: el próximo puente, en una frase (lo calcula el panel «Puentes»).
	let nextBreak = $state<string | null>(null);

	// Próximas decisiones de tipos de los grandes bancos centrales (src/lib/cb-calendar.ts).
	const decisions = $derived(cbUpcoming(today).slice(0, 10));

	// Próximos datos de los calendarios oficiales (con tema), desde hoy en hora de Madrid.
	const releases = $derived(
		(data.releases?.data.events ?? []).filter((e) => e.topic && madridDate(Date.parse(e.date)) >= today).slice(0, 14)
	);
	const days = $derived.by(() => {
		const year = Number(today.slice(0, 4));
		const limit = `${year + 1}${today.slice(4)}`;
		const all = [
			...(data.holidays?.data.items ?? []).map((h) => ({ date: h.date, name: h.name, tag: h.scope })),
			...[year, year + 1].flatMap((y) => [...nyseHolidays(y), ...bmeHolidays(y)]).map((h) => ({ ...h, tag: h.market }))
		].filter((h) => h.date >= today && h.date < limit);
		// Un día por fila: si coinciden varios, se juntan las etiquetas y los nombres distintos.
		const byDate = new Map<string, { date: string; names: string[]; tags: string[] }>();
		for (const h of all.sort((a, b) => a.date.localeCompare(b.date))) {
			const row = byDate.get(h.date) ?? { date: h.date, names: [], tags: [] };
			if (!row.names.includes(h.name)) row.names.push(h.name);
			if (!row.tags.includes(h.tag)) row.tags.push(h.tag);
			byDate.set(h.date, row);
		}
		return [...byDate.values()];
	});
	// El próximo festivo de España o Baleares (los días sin bolsa no cuentan).
	const next = $derived(days.find((d) => d.tags.includes('ES') || d.tags.includes('IB')));
	const inDays = (date: string) => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
</script>

<ViewHeader
	plain={nextBreak ? [nextBreak] : undefined}
	code="CAL"
	title="Agenda económica"
	sub="Datos macro de la semana (TradingView), resultados empresariales y salidas a bolsa (Finnhub)"
>
	{#snippet aside()}
		<!-- webcal:// abre «Suscribirse» en el calendario del móvil; antes de arrancar, el enlace https al .ics. -->
		<a
			class="ics"
			href={icsHref}
			title="Bancos centrales, datos macro y resultados en tu calendario (se actualiza solo). En Google Calendar: «Desde URL» con la dirección del .ics."
			>Suscribirse a la agenda ›</a
		>
	{/snippet}
</ViewHeader>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Calendario" meta="{CAL_IMPORTANCE.find((i) => i.value === filters.importance)?.label} · hora de tu dispositivo">
			<div class="filters">
				<Seg label="Importancia" options={CAL_IMPORTANCE} bind:value={filters.importance} />
				<Seg label="Países" options={CAL_COUNTRIES} bind:values={filters.countries} />
			</div>
			<TvWidget widget="events" config={calendar} height={720} />
		</Panel>
	</div>
	<div class="col">
		<Panel title="Bancos centrales" meta="Próximas decisiones de tipos · hora de Madrid">
			<Table>
				<thead><tr><th>Día</th><th>Hora</th><th class="l">Banco</th><th class="l">Publica</th></tr></thead>
				<tbody>
					{#each decisions as m (m.bank + m.date)}
						<tr class:hl={m.date === pick.day}>
							<td class="mut">{weekday(m.date)} {dm(`${m.date}T12:00:00Z`).split(' ')[1]}</td>
							<td class="mut">{m.at ? hm(m.at) : '—'}</td>
							<td class="l name"
								><a href={CB[m.bank].url} target="_blank" rel="noopener" title={CB[m.bank].long}>{CB[m.bank].name}</a></td
							>
							<td class="l mut">{m.report ? (m.bank === 'fed' ? 'Proyecciones' : 'Informe') : ''}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
			{#snippet note()}
				BCE, Fed, Inglaterra, Japón (sin hora fija), Suiza, Canadá, Australia y el LPR de China (día 20). Fuentes:
				calendarios oficiales de cada banco.
			{/snippet}
		</Panel>
		<Panel title="Próximos datos" meta="Calendarios oficiales · hora de Madrid">
			{#if releases.length}
				<Table>
					<thead><tr><th>Día</th><th>Hora</th><th class="l">Dato</th><th class="l">Fuente</th></tr></thead>
					<tbody>
						{#each releases as e (e.source + e.date + e.title)}
							<tr class:hl={madridDate(Date.parse(e.date)) === pick.day}>
								<td class="mut">{weekday(madridDate(Date.parse(e.date)))} {dm(e.date).split(' ')[1]}</td>
								<td class="mut">{e.allDay ? '—' : hm(e.date)}</td>
								<td class="l name wrap"
									>{#if e.url}<a href={e.url} target="_blank" rel="noopener">{e.title}</a>{:else}{e.title}{/if}</td
								>
								<td class="l mut">{e.source}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">
					{data.releases
						? 'Sin publicaciones de los datos que sigue la terminal en las próximas semanas.'
						: 'Sin datos todavía.'}
				</p>
			{/if}
			{#snippet note()}
				EE. UU.: IPC y empleo (BLS), PIB y PCE (BEA), paro semanal (Departamento de Trabajo) y balance de la Fed (H.4.1), con las fechas de FRED. España: IPC, PIB, EPA, vivienda y turistas del INE.
				{#if data.releases}<Updated at={data.releases.fetchedAt} source="releases-cal" />{/if}
			{/snippet}
		</Panel>
		<Panel title="Festivos" meta="Próximos 12 meses">
			{#if next}
				<ul class="mini">
					<li>
						<span class="l">Próximo festivo<small>{next.names.join(' · ')}</small></span>
						<b>{dm(`${next.date}T12:00:00Z`)} · {inDays(next.date) === 0 ? 'hoy' : `en ${inDays(next.date)} días`}</b>
					</li>
				</ul>
			{/if}
			{#if days.length}
				<Table>
					<thead>
						<tr><th>Día</th><th class="l">Festivo</th><th class="l">Dónde</th></tr>
					</thead>
					<tbody>
						{#each days as d (d.date)}
							<tr class:hl={d.date === pick.day}>
								<td class="mut">{weekday(d.date)} {dm(`${d.date}T12:00:00Z`).split(' ')[1]}</td>
								<td class="l name wrap">{d.names.join(' · ')}</td>
								<td class="l mut">{d.tags.join(' ')}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{/if}
			{#snippet note()}
				ES: festivo en toda España · IB: en Baleares · NYSE y BME: sin bolsa en Nueva York o en Madrid. Festivos:
				Nager.Date{#if data.holidays}&nbsp;· <Updated at={data.holidays.fetchedAt} source="holidays" />{/if}. Días sin bolsa calculados
				con las reglas de la NYSE y del calendario TARGET2 (BME). Los festivos locales de cada municipio no están
				incluidos.
			{/snippet}
		</Panel>
		<Puentes {today} pick={pick.day} onnext={(t) => (nextBreak = t)} />
		<Panel title="Resultados" meta="Grandes empresas de EE. UU. · últimos 3 días y próximas 2 semanas">
			{#if !data.finnhub}
				<p class="empty">{data.finnhubMissing}</p>
			{:else if earnings.length}
				<Table>
					<thead>
						<tr>
							<th>Día</th>
							<th class="l">Valor</th>
							<th class="h">Hora</th>
							<th>BPA prev.</th>
							<th>BPA real</th>
							<th class="rev">Ventas prev.</th>
						</tr>
					</thead>
					<tbody>
						{#each earnings as e, i (e.symbol + e.date)}
							<tr class:hl={e.date === pick.day}>
								<td class="mut">{i === 0 || earnings[i - 1].date !== e.date ? weekday(e.date) : ''}</td>
								<td class="l"
									><a class="sym" href="{resolve('/s')}?sym={encodeURIComponent(e.symbol)}">{e.symbol}</a></td
								>
								<td class="mut h">{HOUR[e.hour] ?? ''}</td>
								<td>{nf(e.epsEstimate)}</td>
								<td>
									<Change
										value={e.epsActual !== null && e.epsEstimate !== null ? e.epsActual - e.epsEstimate : null}
										text={nf(e.epsActual)}
									/>
								</td>
								<td class="mut rev">{e.revenueEstimate ? compact(e.revenueEstimate) : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">No hay resultados de grandes empresas en estas fechas.</p>
			{/if}
			{#snippet note()}
				BPA: beneficio por acción, en $. Pre: antes de la apertura · Post: tras el cierre. Fuente: Finnhub
				{#if data.finnhub}· <Updated at={data.finnhub.fetchedAt} source="finnhub" />{/if}
			{/snippet}
		</Panel>
		{#if data.finnhub}
			<Panel title="Salidas a bolsa" meta="EE. UU. · próximas 4 semanas">
				{#if ipos.length}
					<Table>
						<thead>
							<tr>
								<th>Día</th>
								<th class="l">Empresa</th>
								<th class="ex l">Bolsa</th>
								<th>Precio</th>
								<th>Importe</th>
							</tr>
						</thead>
						<tbody>
							{#each ipos as i, n (i.name + i.date)}
								<tr class:hl={i.date === pick.day}>
									<td class="mut">{n === 0 || ipos[n - 1].date !== i.date ? weekday(i.date) : ''}</td>
									<td class="l name wrap"
										>{i.name}{#if i.symbol}<span class="sub">{i.symbol}</span>{/if}</td
									>
									<td class="ex l mut">{i.exchange.replace(/ (Global|Capital)( Select)?( Market)?$/, '')}</td>
									<td class:mut={i.status !== 'priced'}>{price(i.price)}</td>
									<td class="mut">{i.value ? compact(i.value) : '—'}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">No hay salidas a bolsa de más de 50 M$ previstas en estas fechas.</p>
				{/if}
				{#snippet note()}
					Precio por acción en $ (en gris, aún sin fijar: horquilla prevista) e importe de la colocación. Solo las de más de 50 M$.
					Fuente: Finnhub
					{#if data.finnhub}· <Updated at={data.finnhub.fetchedAt} source="finnhub" />{/if}
				{/snippet}
			</Panel>
		{/if}
	</div>
</div>

<style>
	.ics {
		color: var(--amber-dim);
	}

	.ics:hover {
		color: var(--amber);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
	}

	/* Los nombres largos pasan a otra línea para que quepa la columna «Dónde» en el móvil. */
	/* Los nombres de los festivos pueden ocupar varias líneas. */
	.wrap {
		white-space: normal;
	}

	a.sym {
		color: inherit;
		text-decoration: none;
	}

	a.sym:hover {
		color: var(--amber);
	}

	@container (max-width: 440px) {
		.rev,
		.ex {
			display: none;
		}
	}

	@container (max-width: 340px) {
		.h {
			display: none;
		}
	}
</style>
