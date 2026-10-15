<!--
	Paneles fijados en TOP con el 📌 de su vista. Solo existen en este navegador: al prerenderizar no hay
	ninguno. Cada uno descarga su contenido (import dinámico) y sus datos (fetch) solo si está fijado.
-->
<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import type { Dataset } from '#lib/data.ts';
	import { maxCols, packGrid } from '#lib/layout.ts';
	import { findPin, type PinDef } from '#lib/pins.ts';
	import { pins, setPinArea } from '#lib/pins.svelte.ts';
	import Panel from './Panel.svelte';

	setPinArea();

	const list = $derived(pins.list.flatMap((p) => (findPin(p.id) ? [{ def: findPin(p.id)!, span: p.span }] : [])));
	// Columnas según los fijados y el ancho (layout.ts): dos fijados son dos mitades, sin columna vacía.
	let width = $state(0);
	const grid = $derived(packGrid(list.map((p) => p.span), maxCols(width)));

	async function json(name: string): Promise<Dataset<unknown> | null> {
		try {
			const res = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]));
			return res.ok ? await res.json() : null;
		} catch {
			return null;
		}
	}

	// Como una caché de promesas: si se suelta y se vuelve a fijar, no se descarga otra vez.
	const cache = new Map<string, ReturnType<typeof open>>();
	async function open(def: PinDef) {
		const [mod, ...sets] = await Promise.all([def.load(), ...def.datasets.map(json)]);
		return { Content: mod.default, data: Object.fromEntries(def.datasets.map((n, i) => [n, sets[i]])) };
	}
	function get(def: PinDef) {
		if (!cache.has(def.id)) cache.set(def.id, open(def));
		return cache.get(def.id)!;
	}
</script>

<svelte:window bind:innerWidth={width} />

{#if list.length}
	<div class="pins" style:grid-template-columns="repeat({grid.cols}, minmax(0, 1fr))">
		{#each list as { def }, i (def.id)}
			<div class="cell" style:grid-column="span {grid.spans[i]}">
				<Panel title={def.title} meta={def.meta} pin={def.id} jump={{ code: def.code, href: resolve(def.path) }}>
					{#await get(def)}
						<p class="empty">Cargando…</p>
					{:then { Content, data }}
						<Content {data} />
					{:catch}
						<p class="empty">No se ha podido cargar.</p>
					{/await}
				</Panel>
			</div>
		{/each}
	</div>
{/if}

<style>
	.pins {
		display: grid;
		gap: var(--grid-gap);
		margin-bottom: var(--sp-8);
		background: var(--grid-fill);
		border: var(--grid-edge);
	}

	/* Como las columnas de app.css: fondo y separación según la estética (tokens --grid-* y --col-fill). */
	.cell {
		display: flex;
		flex-direction: column;
		background: var(--col-fill);
		min-width: 0;
	}

	.cell > :global(.panel) {
		flex: 1;
	}

	/* Un mapa a todo el ancho sería más alto que la pantalla: se queda centrado, a poco más de media altura. */
	.cell :global(.map svg) {
		max-height: 55vh;
	}
</style>
