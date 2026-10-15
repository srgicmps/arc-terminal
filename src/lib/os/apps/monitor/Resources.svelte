<!--
	Pestaña «Recursos» del Monitor del sistema: gráficas en directo (una muestra por segundo, 90 s) de lo que el navegador
	deja medir. Lo que no se puede medir aquí se dice, no se inventa.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { bytes, count, pct, perSec, WINDOW } from './resources.ts';
	import { Sampler } from './sampler.svelte.ts';
	import Spark from './Spark.svelte';

	let { wins, sources, shown = true }: { wins: number; sources: { fresh: number; stale: number } | null; shown?: boolean } = $props();

	const s = new Sampler({ wins: () => wins, sources: () => sources });

	onMount(() => s.mount());
	// Minimizada o en otro escritorio: deja de medir (y de pintar) hasta que vuelva a verse.
	$effect(() => s.setAway(!shown));

	const last = (v: number[]) => (v.length ? v[v.length - 1] : null);
	const show = (v: number[], f: (n: number) => string) => {
		const x = last(v);
		return x === null ? '…' : f(x);
	};
	const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
	const ser = $derived(s.series);
</script>

<div class="head">
	<span class="mut">{s.paused ? 'En pausa' : s.running ? `En directo · cada segundo · últimos ${WINDOW} s` : 'En pausa mientras no se ve'}</span>
	<button type="button" onclick={() => s.toggle()} aria-pressed={s.paused}>{s.paused ? 'Seguir' : 'Pausar'}</button>
</div>

<div class="grid">
	<Spark title="Fotogramas por segundo" values={ser.fps} value={show(ser.fps, (v) => `${v} FPS`)} sub="Media {Math.round(avg(ser.fps))} FPS" floor={60} />
	{#if s.can.longtask}
		<Spark title="Carga del hilo principal" values={ser.busy} value={show(ser.busy, pct)} max={100} fmt={(v) => `${v} %`} tone="down" sub="Tiempo bloqueado por tareas largas (>50 ms)" />
	{/if}
	{#if s.can.memory}
		<Spark title="Memoria JS" values={ser.heap} value={show(ser.heap, bytes)} fmt={bytes} floor={1048576} tone="s2" sub={s.heapLimit ? `Límite ${bytes(s.heapLimit)}` : ''} />
	{/if}
	{#if s.can.resource}
		<Spark title="Red" values={ser.net} value={show(ser.net, perSec)} fmt={perSec} floor={1024} tone="s3" sub="{count(s.requests)} peticiones desde que abriste esto" />
	{/if}
	{#if s.can.storage}
		<Spark title="Almacenamiento" values={ser.storage} value={show(ser.storage, bytes)} fmt={bytes} floor={1048576} tone="s2" sub={s.quota ? `De ${bytes(s.quota)} disponibles (${pct((100 * (last(ser.storage) ?? 0)) / s.quota)})` : ''} />
	{/if}
	<Spark title="Nodos del documento" values={ser.dom} value={show(ser.dom, count)} fmt={count} floor={100} sub="Elementos HTML de la página" />
	<Spark title="Ventanas abiertas" values={ser.wins} value={show(ser.wins, count)} fmt={count} floor={5} tone="s3" sub="En todos los escritorios" />
	{#if sources}
		<Spark title="Fuentes frescas" values={ser.fresh} value={show(ser.fresh, count)} fmt={count} floor={10} tone="up" sub="En marcha o en reposo" />
		<Spark title="Fuentes caducadas" values={ser.stale} value={show(ser.stale, count)} fmt={count} floor={5} tone="down" sub="Con fallos o caídas" />
	{/if}
</div>

{#if !s.can.memory || !s.can.longtask || !s.can.resource || !s.can.storage}
	<p class="mut">
		Este navegador no deja medir:
		{[!s.can.memory && 'la memoria JS (solo Chrome y Edge)', !s.can.longtask && 'la carga del hilo principal', !s.can.resource && 'la red', !s.can.storage && 'el almacenamiento'].filter(Boolean).join(', ')}.
	</p>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		margin-bottom: var(--sp-8);
		font-size: var(--fs-s);
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
		gap: var(--sp-8);
	}

	.mut {
		color: var(--muted);
	}

	p {
		margin: var(--sp-8) 0 0;
		font-size: var(--fs-s);
	}
</style>
