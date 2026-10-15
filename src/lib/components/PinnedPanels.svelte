<!--
	Paneles fijados en TOP con el 📌 de su vista. Solo existen en este navegador: al prerenderizar no hay
	ninguno. Cada uno descarga su contenido (import dinámico) y sus datos (fetch) solo si está fijado.
-->
<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import type { Dataset } from '#lib/data.ts';
	import { findPin, type PinDef } from '#lib/pins.ts';
	import { pins, setPinArea } from '#lib/pins.svelte.ts';
	import Panel from './Panel.svelte';

	setPinArea();

	const list = $derived(pins.list.flatMap((p) => (findPin(p.id) ? [{ def: findPin(p.id)!, span: p.span }] : [])));

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

{#if list.length}
	<div class="pins">
		{#each list as { def, span } (def.id)}
			<div class="cell s{span}">
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-auto-flow: dense;
		gap: var(--grid-gap);
		margin-bottom: var(--sp-8);
		background: var(--grid-fill);
		border: var(--grid-edge);
	}

	/* Como las columnas de app.css: fondo y separación según la estética (tokens --grid-* y --col-fill). */
	.cell {
		background: var(--col-fill);
		min-width: 0;
	}

	.s2 {
		grid-column: span 2;
	}

	.s3 {
		grid-column: span 3;
	}

	@media (max-width: 1100px) {
		.pins {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.s3 {
			grid-column: span 2;
		}
	}

	@media (max-width: 720px) {
		.pins {
			grid-template-columns: minmax(0, 1fr);
		}

		.s2,
		.s3 {
			grid-column: auto;
		}
	}
</style>
