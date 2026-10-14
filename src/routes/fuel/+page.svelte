<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import LineChart from '#lib/components/LineChart.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Bar from '#lib/components/ui/Bar.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import SortTh from '#lib/components/ui/SortTh.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { dm, nf } from '#lib/format.ts';
	import { fuelShare, type ShareInfo } from '#lib/share.ts';
	import { distanceKm, findProvince, FUELS, taxShare, zoneFor, type FuelKey, type FuelProvinceDay, type FuelStation } from '#lib/fuel.ts';
	import { place } from '#lib/place.svelte.ts';
	import { sortBy } from '#lib/sort.ts';
	import { Sorter } from '#lib/sorter.svelte.ts';
	import { urlState, writeParams } from '#lib/urlstate.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Parte que son impuestos, sin decimales: «58 %». */
	const pct = (v: number | null) => (v === null ? '—' : `${nf(v, 0)} %`);

	const MENORCA = 'menorca';
	const SHOWN = 60;

	// Estado de la vista (como ref() en Vue). El combustible y la zona van también en la URL
	// (?combustible=diesel&zona=28): un enlace o un favorito abre lo mismo.
	const fuelSel = urlState<FuelKey>('combustible', 'g95', (v) => FUELS.some((f) => f.key === v));
	const fuel = $derived(fuelSel.value);
	let zone = $state(MENORCA);
	let town = $state('ALL');
	let showAll = $state(false);
	let here = $state<{ lat: number; lon: number } | null>(null);
	let locating = $state(false);
	let message = $state('');
	// Gasolineras de cada provincia ya descargadas (se piden al elegir la provincia).
	let loaded = $state<Record<string, FuelStation[]>>({});
	// Y su historial de precios medios (otro archivo pequeño, para el gráfico).
	let histories = $state<Record<string, FuelProvinceDay[]>>({});

	const provinces = $derived(data.spain?.data.provinces ?? []);
	const zoneName = $derived(zone === MENORCA ? 'Menorca' : (provinces.find((p) => p.id === zone)?.name ?? ''));

	async function choose(id: string) {
		zone = id;
		town = 'ALL';
		showAll = false;
		writeParams({ zona: id === MENORCA ? null : id });
		try {
			localStorage.setItem('fuel-zone', id);
		} catch {}
		if (id === MENORCA || loaded[id]) return;
		message = 'Cargando…';
		loadHistory(id);
		try {
			// El archivo existe tras `pnpm data`; su ruta no se conoce al comprobar tipos.
			const url = asset(`data/fuel/${id}.json` as Parameters<typeof asset>[0]);
			const res = await fetch(url);
			if (!res.ok) throw new Error(String(res.status));
			loaded = { ...loaded, [id]: await res.json() };
			message = '';
		} catch {
			message = 'No se han podido cargar las gasolineras de esa provincia.';
		}
	}

	/** El historial no es imprescindible: si falla, el gráfico enseña solo la media de España. */
	async function loadHistory(id: string) {
		try {
			const url = asset(`data/fuel/history/${id}.json` as Parameters<typeof asset>[0]);
			const res = await fetch(url);
			if (res.ok) histories = { ...histories, [id]: await res.json() };
		} catch {}
	}

	// Al abrir la vista sin ?zona: la provincia de «Tu sitio» si la has elegido y está en España (o Menorca, si
	// está en la isla); si no, la última zona elegida. Si cambias de sitio con la vista abierta, cambia de provincia.
	let fromUrl = false;
	onMount(() => (fromUrl = page.url.searchParams.has('zona')));
	$effect(() => {
		if (!place.ready) return;
		const sitio = place.current;
		untrack(() => {
			if (fromUrl) return; // la elige el $effect de abajo
			const id = place.chosen ? zoneFor(sitio, provinces) : null;
			if (id) {
				if (id !== zone) choose(id);
				return;
			}
			try {
				const saved = localStorage.getItem('fuel-zone');
				if (saved && saved !== MENORCA && provinces.some((p) => p.id === saved)) choose(saved);
			} catch {}
		});
	});

	// «FUEL Madrid» o «FUEL 28» en la barra abre /fuel?zona=…. Solo en el navegador (los efectos no
	// se ejecutan al prerenderizar); untrack evita que se repita al cargar la provincia.
	$effect(() => {
		const id = findProvince(page.url.searchParams.get('zona'), provinces);
		if (id) untrack(() => choose(id));
	});

	/** «Cerca de mí»: pide la ubicación al navegador y abre la provincia más cercana. */
	function locate() {
		if (!('geolocation' in navigator)) {
			message = 'Este navegador no permite conocer la ubicación.';
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				locating = false;
				const me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
				here = me;
				// Menorca es una zona aparte: si estás en la isla, se queda en Menorca.
				const inMenorca = me.lat > 39.79 && me.lat < 40.1 && me.lon > 3.78 && me.lon < 4.35;
				const nearest = [...provinces].sort((a, b) => distanceKm(me, a) - distanceKm(me, b))[0];
				await choose(inMenorca || !nearest ? MENORCA : nearest.id);
			},
			() => {
				locating = false;
				message = 'No se ha podido obtener tu ubicación.';
			},
			{ enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 }
		);
	}

	// Valores calculados (como computed() en Vue).
	const stations = $derived(zone === MENORCA ? (data.fuel?.data.stations ?? []) : (loaded[zone] ?? []));
	const towns = $derived([...new Set(stations.map((s) => s.town))].sort((a, b) => a.localeCompare(b, 'es')));
	const priced = $derived(
		stations.flatMap((s) => {
			const price = s.prices[fuel];
			return price == null ? [] : [{ ...s, price, km: here ? distanceKm(here, s) : null }];
		})
	);
	const list = $derived(
		priced.filter((s) => town === 'ALL' || s.town === town).sort((a, b) => a.price - b.price)
	);
	const zonePrices = $derived(priced.map((s) => s.price));
	const avg = $derived(zonePrices.reduce((a, b) => a + b, 0) / (zonePrices.length || 1));
	const min = $derived(Math.min(...zonePrices));
	const max = $derived(Math.max(...zonePrices));
	const best = $derived(list[0]);
	// Lo que ahorras llenando 50 L en la más barata en vez de pagar la media de la zona.
	const save = $derived(best ? (avg - best.price) * 50 : 0);
	const spainAvg = $derived(data.spain?.data.avg[fuel] ?? null);
	const fuelLabel = $derived(FUELS.find((f) => f.key === fuel)?.label ?? '');
	const nearest = $derived(here ? [...list].sort((a, b) => (a.km ?? 0) - (b.km ?? 0)).slice(0, 5) : []);

	const sourceDate = $derived.by(() => {
		const raw = zone === MENORCA ? data.fuel?.data.sourceDate : data.spain?.data.sourceDate;
		const [day, time = ''] = (raw ?? '').split(' ');
		return time ? `${day}, ${time.slice(0, 5)}` : day;
	});

	// La zona elegida frente a la media de España, con el combustible elegido. Los historiales los va
	// guardando la propia web, día a día: Menorca con sus gasolineras y cada provincia con la media del día.
	const spainHistory = $derived(data.spain?.data.history ?? []);
	const zoneToday = $derived(
		zone === MENORCA
			? (data.fuel?.data.history?.at(-1)?.avg[fuel] ?? null)
			: (provinces.find((p) => p.id === zone)?.avg[fuel] ?? null)
	);
	const gapCents = $derived(zoneToday !== null && spainAvg !== null ? (zoneToday - spainAvg) * 100 : null);
	const zoneHistory = $derived(
		zone === MENORCA
			? (data.fuel?.data.history ?? []).map((d) => ({ t: d.date, v: d.avg[fuel] }))
			: (histories[zone] ?? []).map((d) => ({ t: d.date, v: d.avg[fuel] }))
	);
	const historyLines = $derived([
		{
			label: zoneName,
			color: '--amber',
			points: zoneHistory.flatMap((p) => (p.v == null ? [] : [{ t: p.t, v: p.v }]))
		},
		{
			label: 'España',
			color: '--muted',
			points: spainHistory.flatMap((d) => (d.avg[fuel] == null ? [] : [{ t: d.date, v: d.avg[fuel]! }]))
		}
	]);

	// Provincias ordenadas por el precio medio del combustible elegido.
	const ranking = $derived(
		provinces.filter((p) => p.avg[fuel] != null).sort((a, b) => a.avg[fuel]! - b.avg[fuel]!)
	);

	// «Compartir»: la más barata que se ve ahora, con un enlace que abre la misma zona (?zona=…).
	function share(): ShareInfo {
		const url = new URL(location.href);
		url.searchParams.set('zona', zone);
		const place = town === 'ALL' ? zoneName : town;
		if (!best) return { title: `Gasolineras · ${zoneName}`, url: url.href };
		const text = fuelShare({ fuel: fuelLabel, place, station: best.name, town: best.town, price: best.price, avg });
		return { ...text, url: url.href };
	}

	const mapUrl = (s: FuelStation) => `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
	const barWidth = (price: number) => 20 + (80 * (price - min)) / (max - min || 1);

	// Tablas ordenables. Sin ordenar, de más barata a más cara; el «#» es siempre el puesto por precio.
	type Row = (typeof list)[number];
	const stationCols = { name: (s: Row) => s.name, town: (s: Row) => s.town, price: (s: Row) => s.price, km: (s: Row) => s.km };
	const stationSort = new Sorter<keyof typeof stationCols>();
	const sortedList = $derived(stationSort.key ? sortBy(list, stationCols[stationSort.key], stationSort.dir) : list);
	const priceRank = $derived(new Map(list.map((s, i) => [s.id, i + 1])));

	type Province = (typeof ranking)[number];
	const provinceCols = { name: (p: Province) => p.name, avg: (p: Province) => p.avg[fuel], min: (p: Province) => p.min[fuel], count: (p: Province) => p.count };
	const provinceSort = new Sorter<keyof typeof provinceCols>();
	const sortedRanking = $derived(provinceSort.key ? sortBy(ranking, provinceCols[provinceSort.key], provinceSort.dir) : ranking);
	const provinceRank = $derived(new Map(ranking.map((p, i) => [p.id, i + 1])));

	type EuRow = NonNullable<typeof data.europe>['data']['rows'][number];
	const euCols = { name: (r: EuRow) => r.name, g95: (r: EuRow) => r.g95.tax, g95Tax: (r: EuRow) => taxShare(r.g95), diesel: (r: EuRow) => r.diesel.tax, dieselTax: (r: EuRow) => taxShare(r.diesel) };
	const euSort = new Sorter<keyof typeof euCols>();
	const euRows = $derived.by(() => {
		const rows = data.europe?.data.rows ?? [];
		return euSort.key ? sortBy(rows, euCols[euSort.key], euSort.dir) : rows;
	});
</script>

<ViewHeader code="FUEL" title="Gasolineras" sub="Las más baratas de tu provincia o de cualquier otra · API del Ministerio" />

<div class="grid">
	<Panel
		title="{fuelLabel} · {zoneName}"
		meta={list.length > SHOWN && !showAll ? `${SHOWN} de ${list.length} estaciones` : `${list.length} ${list.length === 1 ? 'estación' : 'estaciones'}`}
		{share}
	>

		{#if !data.fuel && !data.spain}
			<p class="empty">Todavía no hay datos. En local, ejecuta <code>pnpm data</code> y recarga.</p>
		{:else}
			<div class="controls">
				<Select label="Zona" value={zone} onchange={choose}>
					<option value={MENORCA}>Menorca</option>
					{#each provinces as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</Select>
				<button class="near" type="button" onclick={locate} disabled={locating}>
					{locating ? 'Buscando…' : here ? '◎ Actualizar ubicación' : '◎ Cerca de mí'}
				</button>
				<Seg label="Combustible" options={FUELS.map((f) => ({ value: f.key, label: f.label }))} bind:value={fuelSel.value} />
				<!-- bind:value es el v-model de Svelte -->
				<Select label="Municipio" bind:value={town}>
					<option value="ALL">Todos</option>
					{#each towns as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</Select>
			</div>

			{#if message}<p class="empty">{message}</p>{/if}

			{#if best}
				<Tiles>
					<Tile
						label="Más barata{town === 'ALL' ? '' : ` en ${town}`}"
						value="{nf(best.price, 3)} €/L"
						sub="{best.town} · {best.name}"
					/>
					<Tile
						label="Media de {zoneName}"
						value="{nf(avg, 3)} €/L"
						sub="{priced.length} estaciones{spainAvg !== null ? ` · España ${nf(spainAvg, 3)}` : ''}"
					/>
					<Tile
						label="{save >= 0 ? 'Ahorras' : 'Pagas de más'} en un depósito de 50 L"
						value="{nf(Math.abs(save), 2)} €"
						sub="en la más barata, frente a la media"
					/>
				</Tiles>

				{#if nearest.length}
					<div class="nearest">
						<span class="lbl">Las más cercanas</span>
						{#each nearest as s (s.id)}
							<a href={mapUrl(s)} target="_blank" rel="noopener">
								{s.name} <b>{nf(s.price, 3)}</b> <small>{nf(s.km, 1)} km</small>
							</a>
						{/each}
					</div>
				{/if}

				<Table>
					<thead>
						<tr>
							<th>#</th>
							<SortTh sort={stationSort} key="name" first="asc" class="l">Estación</SortTh>
							<SortTh sort={stationSort} key="town" first="asc" class="l">Municipio</SortTh>
							<SortTh sort={stationSort} key="price" first="asc">€/L</SortTh>
							<th class="sp"><span class="sr">Comparativa</span></th>
							<th>Frente a la media</th>
							{#if here}<SortTh sort={stationSort} key="km" first="asc">Distancia</SortTh>{/if}
							<th>Horario</th>
						</tr>
					</thead>
					<tbody>
						{#each showAll ? sortedList : sortedList.slice(0, SHOWN) as s (s.id)}
							{@const diff = s.price - avg}
							{@const rank = priceRank.get(s.id) ?? 0}
							<tr class:best={rank === 1}>
								<td class="mut">{rank}</td>
								<td class="l">
									<a class="name" href={mapUrl(s)} target="_blank" rel="noopener">{s.name}</a>
									<span class="sub">{s.address}</span>
								</td>
								<td class="l">{s.town}</td>
								<td>{nf(s.price, 3)}</td>
								<td class="sp"><Bar pct={barWidth(s.price)} tone={rank === 1 ? 'up' : 'faint'} /></td>
								<!-- Más cara que la media es malo: el color va al revés que el signo. -->
								<td><Change value={diff} digits={3} invert /></td>
								{#if here}<td class="mut">{s.km === null ? '—' : `${nf(s.km, 1)} km`}</td>{/if}
								<td class="mut">{s.schedule}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#if list.length > SHOWN}
					<button class="more" type="button" aria-expanded={showAll} onclick={() => (showAll = !showAll)}
						>{showAll ? `Ver solo las ${SHOWN} primeras` : `Ver las ${list.length}`}</button
					>
				{/if}
			{:else if !message}
				<p class="empty">Ninguna estación de {town === 'ALL' ? zoneName : town} vende {fuelLabel.toLowerCase()}.</p>
			{/if}

			<Note>
				Fuente: <a href="https://geoportalgasolineras.es/" target="_blank" rel="noopener"
					>Ministerio para la Transición Ecológica y el Reto Demográfico</a
				>. Datos del {sourceDate}. Toca una estación para abrirla en el mapa.
			</Note>
		{/if}
	</Panel>
</div>

<div class="grid grid-2e">
	<div class="col">
		<Panel title="{zoneName} frente a España" meta="{fuelLabel} · precio medio diario · €/L">
			{#if gapCents !== null}
				<Tiles>
					<Tile
						label="{zoneName}, hoy"
						value="{nf(gapCents >= 0 ? gapCents : -gapCents, 1)} cts/L"
						sub="{gapCents >= 0 ? 'más cara' : 'más barata'} que la media de España"
					/>
				</Tiles>
			{/if}
			<LineChart lines={historyLines} decimals={3} />
			{#snippet note()}
				El historial de la media de España y de cada provincia empieza el 14 de octubre de 2026: la web lo
				guarda día a día.
			{/snippet}
		</Panel>
		{#if data.europe?.data.rows.length}
			{@const eu = data.europe.data}
			<Panel title="España frente a Europa" meta="€/L · y parte que son impuestos">
				<Table>
					<thead>
						<tr>
							<SortTh sort={euSort} key="name" first="asc" class="l">País</SortTh>
							<SortTh sort={euSort} key="g95" first="asc">Gasolina 95</SortTh>
							<SortTh sort={euSort} key="g95Tax">Imp.</SortTh>
							<SortTh sort={euSort} key="diesel" first="asc">Diésel</SortTh>
							<SortTh sort={euSort} key="dieselTax">Imp.</SortTh>
						</tr>
					</thead>
					<tbody>
						{#each euRows as r (r.code)}
							<tr class:current={r.code === 'ES'}>
								<td class="l">{r.name}</td>
								<td>{nf(r.g95.tax, 3)}</td>
								<td class="mut" title="Sin impuestos: {nf(r.g95.net, 3)} €/L">{pct(taxShare(r.g95))}</td>
								<td>{nf(r.diesel.tax, 3)}</td>
								<td class="mut" title="Sin impuestos: {nf(r.diesel.net, 3)} €/L">{pct(taxShare(r.diesel))}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					Precios medios del lunes {dm(eu.date)}. «Imp.»: parte del precio que son impuestos (IVA e impuestos
					especiales); el precio sin ellos, al pasar por encima. Fuente: Comisión Europea,
					<a href="https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en" target="_blank" rel="noopener">Weekly Oil Bulletin</a>;
					la media de la UE está ponderada por consumo · <Updated at={data.europe?.fetchedAt} source="oilbulletin" />
				{/snippet}
			</Panel>
		{/if}
	</div>
	<div class="col">
		<Panel title="Precio medio por provincia" meta="{fuelLabel} · de más barata a más cara">
			{#if ranking.length}
				<Table maxHeight="420px">
					<thead>
						<tr>
							<th>#</th>
							<SortTh sort={provinceSort} key="name" first="asc" class="l">Provincia</SortTh>
							<SortTh sort={provinceSort} key="avg" first="asc">Media</SortTh>
							<SortTh sort={provinceSort} key="min" first="asc">Mínimo</SortTh>
							<SortTh sort={provinceSort} key="count">Estaciones</SortTh>
						</tr>
					</thead>
					<tbody>
						{#each sortedRanking as p (p.id)}
							<tr class:current={p.id === zone}>
								<td class="mut">{provinceRank.get(p.id)}</td>
								<td class="l"><button type="button" class="link" onclick={() => choose(p.id)}>{p.name}</button></td>
								<td>{nf(p.avg[fuel], 3)}</td>
								<td class="up">{nf(p.min[fuel], 3)}</td>
								<td class="mut">{p.count}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}<Updated at={data.spain?.fetchedAt} source="fuel-es" />{/snippet}
		</Panel>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-10) var(--sp-18);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}

	.near {
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.near:disabled {
		opacity: 0.6;
	}

	.nearest {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-6) var(--sp-16);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
		font-size: var(--fs-s);
	}

	.nearest .lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.nearest a {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
	}

	.nearest b {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
		color: var(--amber);
	}

	.nearest small {
		color: var(--faint);
	}

	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.more {
		display: block;
		width: 100%;
		background: none;
		border: 0;
		border-top: var(--border);
		padding: var(--sp-8);
		color: var(--amber);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-m);
		cursor: pointer;
	}

	.link:hover {
		color: var(--amber);
	}

	tr.current td {
		background: var(--amber-soft);
	}

	code {
		color: var(--amber);
	}

	/* En pantallas estrechas la barra cede su sitio a los números. */
	@container (max-width: 480px) {
		.sp {
			display: none;
		}
	}
</style>
