<!--
	Monitor del sistema de Arc OS, como el Administrador de tareas: «Apps» (las ventanas abiertas, con «Finalizar»),
	«Fuentes» (cada fuente de datos como un proceso: estado, última descarga, cada cuánto, error) y «Rendimiento»
	(salud de las fuentes, almacenamiento y memoria del navegador) y «Recursos» (gráficas en directo, Resources.svelte). Lee /data/status.json al abrir y cada minuto.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import Search from '../../../components/ui/Search.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import Table from '../../../components/ui/Table.svelte';
	import type { SourceStatus } from '../../../data.ts';
	import { hasWords, queryWords } from '../../../search.ts';
	import { appOf, close, focus, openApp, os } from '../../os.svelte.ts';
	import type { AppProps } from '../../apps.ts';
	import Tool from '../kit/Tool.svelte';
	import Resources from './Resources.svelte';
	import { ageMin, ageText, late, sortProcs, STATE_TEXT, summary, type SortKey } from './procs.ts';

	let { win }: AppProps = $props();

	let tab = $state<'apps' | 'src' | 'perf' | 'res'>('src');
	const TABS = [
		{ value: 'apps', label: 'Apps' },
		{ value: 'src', label: 'Fuentes' },
		{ value: 'perf', label: 'Rendimiento' },
		{ value: 'res', label: 'Recursos' }
	] as const;

	let list = $state<SourceStatus[] | null>(null);
	let at = $state('');
	let failed = $state(false);
	let now = $state(Date.now());
	let sort = $state<SortKey>('state');
	let query = $state('');
	let storage = $state<{ usage: number; quota: number } | null>(null);
	let local = $state(0);
	let heap = $state<number | null>(null);

	async function load() {
		try {
			const r = await fetch(asset('data/status.json' as Parameters<typeof asset>[0]), { cache: 'no-store' });
			if (!r.ok) throw new Error(String(r.status));
			const d = (await r.json()) as { fetchedAt: string; data: SourceStatus[] };
			list = d.data;
			at = d.fetchedAt;
			failed = false;
		} catch {
			failed = true;
		}
		now = Date.now();
		measure();
	}

	async function measure() {
		try {
			const e = await navigator.storage?.estimate();
			if (e?.quota) storage = { usage: e.usage ?? 0, quota: e.quota };
		} catch {}
		let n = 0;
		try {
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i) ?? '';
				n += k.length + (localStorage.getItem(k)?.length ?? 0);
			}
		} catch {}
		local = n * 2;
		const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
		heap = m ? m.usedJSHeapSize : null;
	}

	onMount(() => {
		void load();
		const id = setInterval(load, 60_000);
		return () => clearInterval(id);
	});

	const words = $derived(queryWords(query));
	const rows = $derived(list ? sortProcs(list, sort, now).filter((s) => !words.length || hasWords(`${s.label} ${s.name}`, words)) : []);
	const sum = $derived(list ? summary(list) : null);
	const wins = $derived(os.state.desks.flatMap((d) => d.wins.map((w) => ({ w, desk: d.name }))));
	const mb = (b: number) => `${(b / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
	const SORTS = [
		{ value: 'state', label: 'Estado' },
		{ value: 'name', label: 'Nombre' },
		{ value: 'age', label: 'Antigüedad' }
	] as const;
</script>

<Tool {win}>
	{#snippet bar()}
		<Seg label="Monitor" options={TABS} bind:value={tab} />
		<span class="gap"></span>
		<button type="button" onclick={load} title="Volver a leer">↻</button>
	{/snippet}
	{#if tab === 'apps'}
		<Table csv={false}>
			<thead><tr><th>App</th><th class="l">Escritorio</th><th class="l">Estado</th><th></th></tr></thead>
			<tbody>
				{#each wins as { w, desk } (w.uid)}
					{@const app = appOf(w)}
					<tr>
						<td><button type="button" class="link" onclick={() => focus(w.uid)}>{app?.icon} {app?.name ?? w.app}</button></td>
						<td class="l mut">{desk}</td>
						<td class="l mut">{w.min ? 'Minimizada' : w.uid === win ? 'Este monitor' : 'Abierta'}</td>
						<td><button type="button" onclick={() => close(w.uid)}>Finalizar</button></td>
					</tr>
				{/each}
			</tbody>
		</Table>
		<p class="mut">{wins.length} ventanas en {os.state.desks.length} escritorios.</p>
	{:else if tab === 'res'}
		<Resources wins={wins.length} sources={sum ? { fresh: sum.count.ok + sum.count.cached, stale: sum.count.stale + sum.count.error } : null} />
	{:else if failed && !list}
		<p class="mut">No se ha podido leer el estado de las fuentes.</p>
	{:else if !list || !sum}
		<p class="mut">Leyendo…</p>
	{:else if tab === 'src'}
		<div class="tools">
			<div class="q"><Search label="Buscar una fuente" placeholder="Buscar fuente…" bind:value={query} /></div>
			<Seg label="Ordenar por" options={SORTS} bind:value={sort} />
		</div>
		<Table csv={false}>
			<thead><tr><th>Proceso</th><th class="l">Estado</th><th>Hace</th><th class="per">Cada</th></tr></thead>
			<tbody>
				{#each rows as s (s.name)}
					<tr>
						<td class="name" title={s.error ?? s.name}>{s.label} <span class="sub">{s.name}</span></td>
						<td class="l"><span class="dot {s.state}" aria-hidden="true"></span>{STATE_TEXT[s.state]}{#if s.requires} <span class="mut">({s.requires})</span>{/if}</td>
						<td class:down={late(s, now)}>{ageText(ageMin(s, now))}</td>
						<td class="per mut">{s.maxAgeMinutes ? ageText(s.maxAgeMinutes) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
		<p class="mut">Pasada de {new Date(at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}. El historial de 7 días está en <button type="button" class="link" onclick={() => openApp('status')}>STATUS</button>.</p>
	{:else}
		<div class="perf">
			<div class="big"><b class:up={sum.health >= 90} class:down={sum.health < 70}>{sum.health} %</b><span class="mut">fuentes sanas</span></div>
			<div class="meter" role="img" aria-label="{sum.count.ok + sum.count.cached} sanas, {sum.count.stale} con fallos, {sum.count.error} caídas, {sum.count.off} sin clave">
				{#each ['ok', 'cached', 'stale', 'error', 'off'] as const as k (k)}
					<span class="dot-bar {k}" style:flex-grow={sum.count[k]}></span>
				{/each}
			</div>
			<dl>
				{#each ['ok', 'cached', 'stale', 'error', 'off'] as const as k (k)}
					<div><dt><span class="dot {k}" aria-hidden="true"></span>{STATE_TEXT[k]}</dt><dd>{sum.count[k]}</dd></div>
				{/each}
				<div><dt>Ventanas abiertas</dt><dd>{wins.length}</dd></div>
				<div><dt>Tus ajustes y datos (este navegador)</dt><dd>{mb(local)}</dd></div>
				{#if storage}<div><dt>Almacenamiento de la web</dt><dd>{mb(storage.usage)} de {mb(storage.quota)}</dd></div>{/if}
				{#if heap !== null}<div><dt>Memoria de esta pestaña</dt><dd>{mb(heap)}</dd></div>{/if}
			</dl>
		</div>
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

	.link {
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		margin-bottom: var(--sp-8);
	}

	.q {
		flex: 1 1 200px;
	}

	.mut {
		color: var(--muted);
	}

	p {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
	}

	.dot {
		display: inline-block;
		width: var(--sp-6);
		height: var(--sp-6);
		margin-right: var(--sp-6);
		border-radius: 50%;
		vertical-align: middle;
	}

	.ok,
	.cached {
		background: var(--up);
	}

	.cached {
		opacity: 0.55;
	}

	.stale {
		background: var(--amber);
	}

	.error {
		background: var(--down);
	}

	.off {
		background: var(--faint);
	}

	.perf {
		display: grid;
		gap: var(--sp-12);
		max-width: 480px;
	}

	.big {
		display: flex;
		align-items: baseline;
		gap: var(--sp-8);
	}

	.big b {
		font-size: var(--fs-xxl);
		font-weight: var(--fw-medium);
	}

	.meter {
		display: flex;
		height: var(--sp-8);
		gap: var(--sp-1);
	}

	.dot-bar {
		flex-basis: 0;
	}

	dl {
		margin: 0;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-8);
		padding: var(--row-y) 0;
		border-bottom: var(--border);
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
	}
</style>
