<!--
	Centro de registros de Arc OS, como el visor de registros de un NAS: «Fuentes» (cada descarga de status.json y los
	fallos y recuperaciones de los últimos 7 días de status-history.json), «Avisos» (los avisos al móvil de
	notify-log.json y el centro de notificaciones) y «Todo» (más lo que ha pasado en esta sesión). Filtros por nivel,
	origen, texto e intervalo, y CSV. Lee los JSON al abrir y cada minuto mientras la pestaña está visible.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import Search from '../../../components/ui/Search.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import Select from '../../../components/ui/Select.svelte';
	import Table from '../../../components/ui/Table.svelte';
	import Tile from '../../../components/ui/Tile.svelte';
	import Tiles from '../../../components/ui/Tiles.svelte';
	import { csvName } from '../../../csv.ts';
	import type { SourceHistory, SourceStatus } from '../../../data.ts';
	import { queryWords } from '../../../search.ts';
	import type { AppProps } from '../../apps.ts';
	import { shell } from '../../shell/shell.svelte.ts';
	import Tool from '../kit/Tool.svelte';
	import {
		filterLines,
		fromHistory,
		fromNotices,
		fromNotifyLog,
		fromSession,
		fromStatus,
		LEVEL_TEXT,
		linesCsv,
		origins,
		sortLines,
		summarize,
		timeText,
		type Kind,
		type Level,
		type Range
	} from './logs.ts';
	import { session } from './session.svelte.ts';

	let { win }: AppProps = $props();

	type Tab = 'src' | 'alerts' | 'all';
	let tab = $state<Tab>('src');
	const TABS = [
		{ value: 'src', label: 'Fuentes' },
		{ value: 'alerts', label: 'Avisos' },
		{ value: 'all', label: 'Todo' }
	] as const;
	const KINDS: Record<Tab, Kind[]> = { src: ['fuente'], alerts: ['movil', 'sistema'], all: [] };
	const LEVELS = [
		{ value: 'error', label: 'Error' },
		{ value: 'aviso', label: 'Aviso' },
		{ value: 'info', label: 'Info' }
	] as const;
	const RANGES = [
		{ value: 'hoy', label: 'Hoy' },
		{ value: '7d', label: '7 días' },
		{ value: 'todo', label: 'Todo' }
	] as const;
	/** Filas que se pintan como mucho (el CSV lleva todas las filtradas). */
	const SHOW = 400;

	let status = $state<SourceStatus[]>([]);
	let history = $state<SourceHistory[]>([]);
	let notify = $state<unknown>(null);
	let loaded = $state(false);
	let failed = $state(false);
	let now = $state(Date.now());

	let levels = $state<Level[]>([]);
	let origin = $state('');
	let query = $state('');
	let range = $state<Range>('7d');

	async function getData<T>(name: string): Promise<T | null> {
		try {
			const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
			return r.ok ? (((await r.json()) as { data: T }).data ?? null) : null;
		} catch {
			return null;
		}
	}

	async function load() {
		const [s, h, n] = await Promise.all([
			getData<SourceStatus[]>('status'),
			getData<SourceHistory[]>('status-history'),
			getData<{ entries?: unknown }>('notify-log')
		]);
		if (Array.isArray(s)) status = s;
		if (Array.isArray(h)) history = h;
		if (n) notify = n.entries;
		failed = !Array.isArray(s);
		loaded = true;
		now = Date.now();
	}

	onMount(() => {
		void load();
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') void load();
		}, 60_000);
		const back = () => document.visibilityState === 'visible' && void load();
		document.addEventListener('visibilitychange', back);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', back);
		};
	});

	const labels = $derived(Object.fromEntries(status.map((s) => [s.name, s.label])));
	const all = $derived(
		sortLines([
			...fromStatus(status, now),
			...fromHistory(history, labels),
			...fromNotifyLog(notify),
			...fromNotices(shell.notices),
			...fromSession(session.events)
		])
	);
	const inTab = $derived(filterLines(all, { levels: [], kinds: KINDS[tab], origin: '', words: [], range: 'todo', now }));
	const originList = $derived(origins(inTab));
	$effect(() => {
		if (origin && !originList.includes(origin)) origin = '';
	});
	const rows = $derived(filterLines(inTab, { levels, kinds: [], origin, words: queryWords(query), range, now }));
	const sum = $derived(summarize(rows, status, now));

	function exportCsv() {
		const url = URL.createObjectURL(new Blob([linesCsv(rows)], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = csvName(`registros ${TABS.find((t) => t.value === tab)?.label ?? ''}`, new Date().toLocaleDateString('sv-SE'));
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<Tool {win}>
	{#snippet bar()}
		<Seg label="Registros" options={TABS} bind:value={tab} />
		<span class="gap"></span>
		<button type="button" onclick={exportCsv} disabled={!rows.length} title="Descargar lo filtrado en CSV (Excel)">⤓ CSV</button>
		<button type="button" onclick={load} title="Volver a leer" aria-label="Volver a leer">↻</button>
	{/snippet}
	{#if !loaded}
		<p class="mut">Leyendo…</p>
	{:else}
		<Tiles cols={3}>
			<Tile label="Errores" value={String(sum.errors)} tone={sum.errors ? 'down' : 'mut'} sub="en lo filtrado" />
			<Tile label="Avisos" value={String(sum.warnings)} tone={sum.warnings ? 'flat' : 'mut'} sub="en lo filtrado" />
			<Tile label="Fuentes al día" value={`${sum.fresh} de ${sum.active}`} tone={sum.fresh === sum.active ? 'up' : 'flat'} sub="sin contar las que no tienen clave" />
		</Tiles>
		{#if failed}<p class="down">No se ha podido leer el estado de las fuentes; se enseña lo último que se leyó.</p>{/if}
		<div class="tools">
			<div class="q"><Search label="Buscar en los registros" placeholder="Buscar: FRED, terremoto…" bind:value={query} /></div>
			<Seg label="Nivel" options={LEVELS} bind:values={levels} />
			<Select label="Origen" bind:value={origin}>
				<option value="">Todos</option>
				{#each originList as o (o)}<option value={o}>{o}</option>{/each}
			</Select>
			<Seg label="Intervalo" options={RANGES} bind:value={range} />
		</div>
		{#if rows.length}
			<Table csv={false}>
				<thead><tr><th>Hora</th><th class="l">Nivel</th><th class="l">Origen</th><th class="l">Mensaje</th></tr></thead>
				<tbody>
					{#each rows.slice(0, SHOW) as l (l.id)}
						<tr>
							<td class="mut" title={l.t ?? ''}>{timeText(l.t, now)}</td>
							<td class="l"><span class="lv {l.level}">{LEVEL_TEXT[l.level]}</span></td>
							<td class="l name">{l.origin}</td>
							<td class="l msg">{l.msg}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{:else}
			<p class="mut">Nada con estos filtros.</p>
		{/if}
		<p class="mut">
			{rows.length > SHOW ? `Se ven ${SHOW} de ${rows.length}; el CSV las lleva todas.` : `${rows.length} ${rows.length === 1 ? 'línea' : 'líneas'}.`}
			{#if tab === 'all'}Lo de «Sesión» solo vive en esta pestaña del navegador.{/if}
		</p>
	{/if}
</Tool>

<style>
	.gap {
		flex: 1;
	}

	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	button:disabled {
		color: var(--faint);
		cursor: default;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		margin: var(--sp-12) 0 var(--sp-8);
	}

	.q {
		flex: 1 1 200px;
	}

	p {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
	}

	.mut {
		color: var(--muted);
	}

	.down {
		color: var(--down);
	}

	.lv {
		font-size: var(--fs-xs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.lv.error {
		color: var(--down);
	}

	.lv.aviso {
		color: var(--amber);
	}

	.lv.info {
		color: var(--muted);
	}

	.msg {
		white-space: normal;
		min-width: 220px;
		overflow-wrap: anywhere;
	}
</style>
