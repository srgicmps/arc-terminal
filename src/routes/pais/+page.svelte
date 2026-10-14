<!--
	Ficha de un país: /pais?c=DE (en la barra, «PAIS Alemania» o «PAIS DE»). Como el CTRY de Bloomberg.
	Todo sale de datos que ya descarga la terminal (src/lib/country.ts): si un dato no existe para el país,
	su bloque no se pinta. El país se lee de la URL al arrancar en el navegador, como el valor en /s.
-->
<script lang="ts">
	import EuPowerTable from '#lib/components/EuPowerTable.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { COUNTRIES, findCountry } from '#lib/countries.ts';
	import type { CountryProfile, Rate } from '#lib/country.ts';
	import { nf, period, signed } from '#lib/format.ts';
	import { sectionLabel } from '#lib/news.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	$effect(() => {
		query = page.url.searchParams.get('c') ?? '';
	});

	const country = $derived(findCountry(query));
	// La ficha viene calculada del servidor; un país sin ningún dato tiene la ficha vacía (solo titulares).
	const EMPTY: CountryProfile = { kpis: [], policy: null, bond: null, premium: null, fx: [], imf: null };
	const profile = $derived(country && (data.profiles[country.code] ?? EMPTY));
	const news = $derived(country ? (data.news[country.code] ?? []) : []);
	const hasPower = $derived(!!country && data.eupower.some((z) => z.country === country.code));
	const rates = $derived(profile ? [profile.policy, profile.bond, profile.premium].filter((r): r is Rate => r !== null) : []);
	const empty = $derived(profile && !profile.kpis.length && !rates.length && !profile.fx.length && !profile.imf && !news.length);

	// Para la lista y el desplegable, por orden alfabético.
	const sorted = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'es'));

	function choose(code: string) {
		goto(resolve('/pais') + `?c=${code}`);
	}

	// Color de la variación en la tira: el PIB, cuanto más alto mejor; el paro y la deuda, cuanto más bajos.
	// El IPC va en gris: subir o bajar no es bueno ni malo de por sí.
	const better: Record<string, 1 | -1 | 0> = { gdp: 1, cpi: 0, unemployment: -1, debt: -1 };
	const decimals = (unit: string) => (unit === 'pb' ? 0 : 2);

</script>

<ViewHeader
	code="PAIS"
	title={country?.name ?? 'Ficha de país'}
	sub={country
		? `${country.code} · ${country.currency}${country.euro ? ' · zona euro' : ''}`
		: 'Cifras, tipos, moneda, previsiones y titulares de cada país'}
>
	{#snippet aside()}
		<Select label="País" value={country?.code ?? ''} onchange={choose}>
			{#if !country}<option value="" disabled>Elige…</option>{/if}
			{#each sorted as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
		</Select>
	{/snippet}
</ViewHeader>

{#if !country}
	<div class="grid">
		<div class="col">
			<Panel title="Países" meta="{COUNTRIES.length} países">
				{#if query}<p class="empty">No conozco «{query}». Prueba con el nombre o el código: PAIS Alemania, PAIS DE.</p>{/if}
				<Table>
					<thead><tr><th>País</th><th>Código</th><th>Moneda</th></tr></thead>
					<tbody>
						{#each sorted as c (c.code)}
							<tr>
								<td class="name"><a class="pick" href="{resolve('/pais')}?c={c.code}">{c.name}</a></td>
								<td>{c.code}</td>
								<td class="mut">{c.currency}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</Panel>
		</div>
	</div>
{:else if profile}
	{#if profile.kpis.length}
		<Tiles cols={profile.kpis.length}>
			{#each profile.kpis as k (k.key)}
				{@const d = k.prev === null ? null : k.value - k.prev}
				<Tile label={k.label} value="{nf(k.value, 1)} %">
					{#if d !== null}<Change value={d * better[k.key]} text="{signed(d, 1)} pp" />{' · '}{/if}{period(k.t)} · {k.source}
				</Tile>
			{/each}
		</Tiles>
	{/if}

	<div class="grid grid-2">
		<div class="col">
			{#if rates.length}
				<Panel title="Tipos y deuda">
					<Table>
						<thead><tr><th></th><th>Último</th><th>Var.</th><th>Fecha</th></tr></thead>
						<tbody>
							{#each rates as r (r.label)}
								<tr>
									<td class="name">{r.label}<span class="sub">{r.source}</span></td>
									<td>{nf(r.value, decimals(r.unit))}{r.unit === 'pb' ? ' pb' : ' %'}</td>
									<td>
										{#if r.prev !== null}<Change value={r.unit === 'pb' ? r.value - r.prev : (r.value - r.prev) * 100} digits={0} unit=" pb" />{:else}<span class="mut">—</span>{/if}
									</td>
									<td class="mut">{period(r.t)}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
					{#snippet note()}{#if profile.policy}Tipo oficial: BIS, con el mes del último cambio.{/if}
						{#if profile.bond}Bono: {profile.bond.source === 'BCE' ? 'BCE, media mensual' : 'Tesoro de EE. UU., diario'}.{/if}
						Var.: frente al dato anterior, en puntos básicos.{/snippet}
				</Panel>
			{/if}

			{#if hasPower}
				<Panel title="Luz" meta="Mercado mayorista · €/MWh">
					<EuPowerTable zones={data.eupower} country={country.code} />
					{#snippet note()}
						Media del día, frente a la media de las zonas europeas que sigue la terminal. Fuente:
						{country.code === 'ES' ? 'Red Eléctrica' : 'Energy-Charts / SMARD (Bundesnetzagentur), CC BY 4.0'} ·
						<Updated at={data.eupowerAt} source="energycharts" />
					{/snippet}
				</Panel>
			{/if}

			{#if profile.fx.length}
				<Panel title="Moneda" meta={country.currency}>
					<Table>
						<thead><tr><th>Cambio</th><th>Último</th><th>1 mes</th><th>Fecha</th></tr></thead>
						<tbody>
							{#each profile.fx as f (f.pair)}
								<tr>
									<td>{f.pair}</td>
									<td>{nf(f.value, 4)}</td>
									<td><Change value={f.month} unit=" %" /></td>
									<td class="mut">{period(f.date)}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
					{#snippet note()}Tipos de referencia del BCE. Frente al dólar, cruzados con el EUR/USD del mismo día.{/snippet}
				</Panel>
			{/if}

			{#if profile.imf}
				<Panel title="Previsiones del FMI" meta={profile.imf.edition ?? undefined}>
					<Table>
						<thead>
							<tr><th></th><th>PIB {profile.imf.years[0]}</th><th>PIB {profile.imf.years[1]}</th><th>IPC {profile.imf.years[0]}</th><th>IPC {profile.imf.years[1]}</th></tr>
						</thead>
						<tbody>
							{#each profile.imf.rows as r, i (r.code)}
								<tr class:own={i === 0}>
									<td class="name">{i === 0 ? country.name : r.name}</td>
									{#each [...r.gdp, ...r.cpi] as v, j (j)}<td>{v === null ? '—' : `${nf(v, 1)} %`}</td>{/each}
								</tr>
							{/each}
						</tbody>
					</Table>
					{#snippet note()}World Economic Outlook: crecimiento del PIB real e inflación media del año.{/snippet}
				</Panel>
			{/if}

			{#if empty}
				<Panel title="Datos">
					<p class="empty">Ninguna fuente de la terminal publica cifras de {country.name}: aquí solo saldrán sus titulares.</p>
				</Panel>
			{/if}
		</div>

		<div class="col">
			<Panel title="En las noticias" meta="{news.length} {news.length === 1 ? 'titular' : 'titulares'}">
				{#if news.length}
					<NewsList items={news} tag={(item) => sectionLabel(item)} />
				{:else}
					<p class="empty">Ningún titular reciente nombra a {country.name}.</p>
				{/if}
				{#snippet note()}Titulares de todas las secciones que nombran el país o su gentilicio.{/snippet}
			</Panel>
		</div>
	</div>
{/if}

<style>
	.pick {
		color: var(--fg);
		text-decoration: none;
	}

	.pick:hover {
		color: var(--amber);
	}

	.own td {
		color: var(--amber);
	}
</style>
