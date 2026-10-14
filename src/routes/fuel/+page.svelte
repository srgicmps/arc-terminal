<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import LineChart from '#lib/components/LineChart.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { nf, signed, trend } from '#lib/format.ts';
	import { distanceKm, findProvince, FUELS, type FuelKey, type FuelStation } from '#lib/fuel.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const MENORCA = 'menorca';
	const SHOWN = 60;

	// Estado de la vista (como ref() en Vue).
	let fuel = $state<FuelKey>('g95');
	let zone = $state(MENORCA);
	let town = $state('ALL');
	let showAll = $state(false);
	let here = $state<{ lat: number; lon: number } | null>(null);
	let locating = $state(false);
	let message = $state('');
	// Gasolineras de cada provincia ya descargadas (se piden al elegir la provincia).
	let loaded = $state<Record<string, FuelStation[]>>({});

	const provinces = $derived(data.spain?.data.provinces ?? []);
	const zoneName = $derived(zone === MENORCA ? 'Menorca' : (provinces.find((p) => p.id === zone)?.name ?? ''));

	async function choose(id: string) {
		zone = id;
		town = 'ALL';
		showAll = false;
		try {
			localStorage.setItem('fuel-zone', id);
		} catch {}
		if (id === MENORCA || loaded[id]) return;
		message = 'Cargando…';
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

	// Al abrir la vista en el navegador, recupera la última zona elegida (igual que onMounted en Vue).
	onMount(() => {
		if (page.url.searchParams.has('zona')) return; // la elige el $effect de abajo
		try {
			const saved = localStorage.getItem('fuel-zone');
			if (saved && saved !== MENORCA && provinces.some((p) => p.id === saved)) choose(saved);
		} catch {}
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
			: spainHistory.map((d) => ({ t: d.date, v: d.provinces?.[zone]?.[fuel] ?? null }))
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

	const mapUrl = (s: FuelStation) => `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
	const barWidth = (price: number) => 20 + (80 * (price - min)) / (max - min || 1);
</script>

<ViewHeader code="FUEL" title="Gasolineras" sub="Las más baratas de Menorca o de cualquier provincia · API del Ministerio" />

<div class="grid">
	<section class="panel">
		<header class="ph">
			<h2>{fuelLabel} · {zoneName}</h2>
			<div class="ph-r">
				<span>{list.length} {list.length === 1 ? 'estación' : 'estaciones'}</span>
			</div>
		</header>

		{#if !data.fuel && !data.spain}
			<p class="empty">Todavía no hay datos. En local, ejecuta <code>pnpm data</code> y recarga.</p>
		{:else}
			<div class="controls">
				<label class="sel">
					Zona
					<select value={zone} onchange={(e) => choose(e.currentTarget.value)}>
						<option value={MENORCA}>Menorca</option>
						{#each provinces as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</label>
				<button class="near" type="button" onclick={locate} disabled={locating}>
					{locating ? 'Buscando…' : here ? '◎ Actualizar ubicación' : '◎ Cerca de mí'}
				</button>
				<div class="seg" role="group" aria-label="Combustible">
					{#each FUELS as f (f.key)}
						<button type="button" aria-pressed={fuel === f.key} onclick={() => (fuel = f.key)}>{f.label}</button>
					{/each}
				</div>
				<label class="sel">
					Municipio
					<!-- bind:value es el v-model de Svelte -->
					<select bind:value={town}>
						<option value="ALL">Todos</option>
						{#each towns as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if message}<p class="empty">{message}</p>{/if}

			{#if best}
				<div class="tiles">
					<div class="tile">
						<span class="lbl">Más barata{town === 'ALL' ? '' : ` en ${town}`}</span>
						<b>{nf(best.price, 3)} €/L</b>
						<span class="sub">{best.town} · {best.name}</span>
					</div>
					<div class="tile">
						<span class="lbl">Media de {zoneName}</span>
						<b>{nf(avg, 3)} €/L</b>
						<span class="sub">
							{priced.length} estaciones{spainAvg !== null ? ` · España ${nf(spainAvg, 3)}` : ''}
						</span>
					</div>
					<div class="tile">
						<span class="lbl">{save >= 0 ? 'Ahorras' : 'Pagas de más'} en un depósito de 50 L</span>
						<b>{nf(Math.abs(save), 2)} €</b>
						<span class="sub">en la más barata, frente a la media</span>
					</div>
				</div>

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

				<div class="scroll">
					<table class="t">
						<thead>
							<tr>
								<th>#</th>
								<th class="l">Estación</th>
								<th class="l">Municipio</th>
								<th>€/L</th>
								<th class="sp"><span class="sr">Comparativa</span></th>
								<th>Frente a la media</th>
								{#if here}<th>Distancia</th>{/if}
								<th>Horario</th>
							</tr>
						</thead>
						<tbody>
							{#each showAll ? list : list.slice(0, SHOWN) as s, i (s.id)}
								{@const diff = s.price - avg}
								<tr class:best={i === 0}>
									<td class="mut">{i + 1}</td>
									<td class="l">
										<a class="name" href={mapUrl(s)} target="_blank" rel="noopener">{s.name}</a>
										<span class="sub">{s.address}</span>
									</td>
									<td class="l">{s.town}</td>
									<td>{nf(s.price, 3)}</td>
									<td class="sp">
										<span class="bar" aria-hidden="true"><i style:width="{barWidth(s.price).toFixed(0)}%"></i></span>
									</td>
									<td class={trend(-diff)}>{signed(diff, 3)}</td>
									{#if here}<td class="mut">{s.km === null ? '—' : `${nf(s.km, 1)} km`}</td>{/if}
									<td class="mut">{s.schedule}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if list.length > SHOWN && !showAll}
					<button class="more" type="button" onclick={() => (showAll = true)}>Ver las {list.length}</button>
				{/if}
			{:else if !message}
				<p class="empty">Ninguna estación de {town === 'ALL' ? zoneName : town} vende {fuelLabel.toLowerCase()}.</p>
			{/if}

			<p class="pnote">
				Fuente: <a href="https://geoportalgasolineras.es/" target="_blank" rel="noopener"
					>Ministerio para la Transición Ecológica y el Reto Demográfico</a
				>. Datos del {sourceDate}. Toca una estación para abrirla en el mapa.
			</p>
		{/if}
	</section>
</div>

<div class="grid grid-2e">
	<div class="col">
		<Panel title="{zoneName} frente a España" meta="{fuelLabel} · precio medio diario · €/L">
			{#if gapCents !== null}
				<div class="tiles">
					<div class="tile">
						<span class="lbl">{zoneName}, hoy</span>
						<b>{nf(gapCents >= 0 ? gapCents : -gapCents, 1)} cts/L</b>
						<span class="sub">{gapCents >= 0 ? 'más cara' : 'más barata'} que la media de España</span>
					</div>
				</div>
			{/if}
			<LineChart lines={historyLines} decimals={3} />
			{#snippet note()}
				El historial de la media de España y de cada provincia empieza el 14 de octubre de 2026: la web lo
				guarda día a día.
			{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Precio medio por provincia" meta="{fuelLabel} · de más barata a más cara">
			{#if ranking.length}
				<div class="scroll rank">
					<table class="t">
						<thead><tr><th>#</th><th class="l">Provincia</th><th>Media</th><th>Mínimo</th><th>Estaciones</th></tr></thead>
						<tbody>
							{#each ranking as p, i (p.id)}
								<tr class:current={p.id === zone}>
									<td class="mut">{i + 1}</td>
									<td class="l"><button type="button" class="link" onclick={() => choose(p.id)}>{p.name}</button></td>
									<td>{nf(p.avg[fuel], 3)}</td>
									<td class="up">{nf(p.min[fuel], 3)}</td>
									<td class="mut">{p.count}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
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
		gap: 10px 18px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
	}

	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		border: 1px solid var(--line);
	}

	.seg button {
		background: none;
		border: 0;
		padding: 5px 12px;
		cursor: pointer;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.seg button[aria-pressed='true'] {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: 500;
	}

	.sel {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.sel select {
		background: var(--raise);
		border: 1px solid var(--line);
		color: var(--fg);
		padding: 4px 8px;
		font-size: var(--fs-s);
		max-width: 180px;
	}

	.near {
		background: none;
		border: 1px solid var(--amber-edge);
		color: var(--amber);
		padding: 4px 10px;
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
		gap: 6px 16px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--line);
		font-size: var(--fs-s);
	}

	.nearest .lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.nearest a {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
	}

	.nearest b {
		font-family: var(--mono);
		font-weight: 500;
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

	.bar {
		display: block;
		position: relative;
		height: 6px;
		min-width: 80px;
		background: var(--raise);
	}

	.bar i {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--faint);
	}

	tr.best .bar i {
		background: var(--up);
	}

	.more {
		display: block;
		width: 100%;
		background: none;
		border: 0;
		border-top: 1px solid var(--line);
		padding: 8px;
		color: var(--amber);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.rank {
		max-height: 420px;
		overflow-y: auto;
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
