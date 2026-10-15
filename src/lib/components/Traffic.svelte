<!--
	ES, «Tráfico» (F4): incidencias de la DGT en las provincias que elijas (hasta 5, guardadas en `arc-traffic`, que
	viaja con tu cuenta). El resumen por provincia llega con la vista; las incidencias de cada una se piden aparte
	(static/data/traffic/<id>.json). Sin Cataluña ni el País Vasco: tienen su propio servicio.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import Panel from './Panel.svelte';
	import Updated from './Updated.svelte';
	import ChipInput from './ui/ChipInput.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';
	import type { Dataset } from '#lib/data.ts';
	import { dm, hm, nf } from '#lib/format.ts';
	import { place } from '#lib/place.svelte.ts';
	import { KIND_LABEL, provinceId, sortTraffic, type TrafficData, type TrafficItem } from '#lib/traffic.ts';

	let { data }: { data: Dataset<TrafficData> | null } = $props();

	const KEY = 'arc-traffic';
	const SHOWN = 25;
	const provinces = $derived(data?.data.provinces ?? []);
	let chosen = $state<string[]>([]);
	let items = $state<Record<string, TrafficItem[]>>({});
	let failed = $state('');
	let showAll = $state(false);

	function save(next: string[]) {
		chosen = next;
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {}
		next.forEach(load);
	}

	async function load(id: string) {
		if (items[id]) return;
		// Solo hay archivo de las provincias con incidencias: sin ninguna (Madrid un día tranquilo), no se pide y sale
		// «Sin incidencias». Antes daba un 404 y «No se han podido cargar».
		if (!provinces.some((p) => p.id === id)) {
			items = { ...items, [id]: [] };
			return;
		}
		try {
			const res = await fetch(asset(`data/traffic/${id}.json` as Parameters<typeof asset>[0]));
			if (!res.ok) throw new Error(String(res.status));
			items = { ...items, [id]: await res.json() };
		} catch {
			failed = 'No se han podido cargar las incidencias.';
		}
	}

	onMount(() => {
		let saved: string[] = [];
		try {
			saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		} catch {}
		const valid = Array.isArray(saved) ? saved.filter((id) => provinces.some((p) => p.id === id)) : [];
		// Sin elegir: la provincia de Tu sitio, si está en los datos; si no, Madrid.
		const mine = place.current.cc === 'ES' ? provinceId(place.current.admin2 ?? place.current.name) : '';
		chosen = valid.length ? valid : [provinces.some((p) => p.id === mine) ? mine : 'madrid'];
		chosen.forEach(load);
	});

	const name = (id: string) => provinces.find((p) => p.id === id)?.name ?? id;
	function add(text: string) {
		const t = provinceId(text);
		// Sin letras que sirvan («-», «?») no se añade nada: startsWith('') daría la primera provincia.
		if (t.length < 2) return;
		const p = provinces.find((x) => x.id === t) ?? provinces.find((x) => x.id.startsWith(t) || x.id.includes(t));
		if (p && !chosen.includes(p.id)) save([...chosen, p.id].slice(-5));
	}
	const remove = (n: string) => save(chosen.filter((id) => name(id) !== n));

	const summary = $derived(provinces.filter((p) => chosen.includes(p.id)));
	const total = (k: 'total' | 'closed') => summary.reduce((a, p) => a + p[k], 0);
	const kind = (k: TrafficItem['kind']) => summary.reduce((a, p) => a + (p.kinds[k] ?? 0), 0);
	const list = $derived(sortTraffic(chosen.flatMap((id) => (items[id] ?? []).map((i) => ({ ...i, province: name(id) })))));
	const many = $derived(chosen.length > 1);

	const km = (i: TrafficItem) => (!i.km ? '' : i.km[0] === i.km[1] ? `km ${nf(i.km[0], 0)}` : `km ${nf(i.km[0], 0)}–${nf(i.km[1], 0)}`);
	const since = (iso: string) => (iso ? `desde el ${dm(iso)}${Date.now() - Date.parse(iso) < 86_400_000 ? ` a las ${hm(iso)}` : ''}` : '');
</script>

<Panel title="Tráfico" meta={chosen.length ? `Incidencias de la DGT · ${chosen.map(name).join(', ')}` : 'Incidencias de la DGT'}>
	<ChipInput label="Añadir una provincia" placeholder="Provincia" items={chosen.map(name)} onadd={add} onremove={remove} />
	{#if !provinces.length}
		<p class="empty">Sin datos de la DGT todavía.</p>
	{:else}
		<Tiles cols={4}>
			<Tile label="Cortes" value={String(total('closed'))} tone={total('closed') ? 'down' : undefined} />
			<Tile label="Accidentes" value={String(kind('accidente'))} />
			<Tile label="Retenciones" value={String(kind('retencion'))} />
			<Tile label="Obras" value={String(kind('obras'))} />
		</Tiles>
		{#if failed}<p class="empty">{failed}</p>{/if}
		{#if list.length}
			<ul class="mini">
				{#each showAll ? list : list.slice(0, SHOWN) as i (i.id + i.province)}
					<li>
						<span class="l"
							><b class:cut={i.closed}>{i.road}</b> {km(i)}{#if i.what}&nbsp;· {i.what}{/if}<small
								>{[many ? i.province : '', i.town, i.direction, since(i.start)].filter(Boolean).join(' · ')}</small
							></span
						>
						<span class="k" class:cut={i.closed}>{i.closed ? 'Cortada' : KIND_LABEL[i.kind]}</span>
					</li>
				{/each}
			</ul>
			{#if list.length > SHOWN}
				<button class="more" type="button" aria-expanded={showAll} onclick={() => (showAll = !showAll)}
					>{showAll ? `Ver solo las ${SHOWN} primeras` : `Ver las ${list.length}`}</button
				>
			{/if}
		{:else if !failed && chosen.every((id) => items[id])}
			<p class="empty">Sin incidencias ahora mismo.</p>
		{/if}
	{/if}
	{#snippet note()}
		Primero los cortes, luego accidentes, retenciones y obras. Cataluña y el País Vasco no están: tienen su propio
		servicio. Fuente: DGT (Punto de Acceso Nacional, DATEX II){#if data}&nbsp;· <Updated at={data.fetchedAt} source="traffic" />{/if}.
	{/snippet}
</Panel>

<style>
	small {
		display: block;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.k {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.cut {
		color: var(--down);
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
</style>
