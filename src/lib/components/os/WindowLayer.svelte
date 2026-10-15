<!--
	El escritorio de Arc OS: mide su tamaño (para encajar y recolocar las ventanas), pinta las ventanas y escucha
	los atajos. Los escritorios que no se ven siguen montados pero ocultos (sus vistas no se recargan al volver);
	uno que aún no se ha visto en esta visita no se monta hasta que se abre (carga diferida).
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { appOf, close, cycle, focusedWin, goDesk, loadOs, maximize, minimize, os, setArea, snap } from '#lib/os/os.svelte.ts';
	import { snapRect, type Snap } from '#lib/os/wm.ts';
	import Window from './Window.svelte';

	let w = $state(0);
	let h = $state(0);
	let preview = $state<Snap | null>(null);
	const seen = new SvelteSet<string>();

	$effect(loadOs);
	$effect(() => setArea(w, h));
	$effect(() => {
		seen.add(os.state.active);
	});

	type Key = Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>;

	/**
	 * Atajos de Arc OS (todos con Alt, para no pisar los de la web): Alt+º o Alt+` siguiente ventana (con ⇧, la
	 * anterior), Alt+↑ maximizar, Alt+↓ minimizar, Alt+⇧+← / → encajar a una mitad, Alt+W cerrar y Alt+1…6 escritorio.
	 * Devuelve si era un atajo.
	 */
	export function handleKey(e: Key): boolean {
		if (!e.altKey || e.ctrlKey || e.metaKey) return false;
		const f = focusedWin();
		if (e.code === 'Backquote' || e.code === 'IntlBackslash') return (cycle(e.shiftKey ? -1 : 1), true);
		const n = /^Digit([1-6])$/.exec(e.code);
		if (n) {
			const d = os.state.desks[Number(n[1]) - 1];
			if (d) goDesk(d.id);
			return true;
		}
		if (!f) return false;
		if (e.key === 'ArrowUp') return (maximize(f.uid), true);
		if (e.key === 'ArrowDown') return (f.snap ? snap(f.uid, null) : minimize(f.uid), true);
		if (e.shiftKey && e.key === 'ArrowLeft') return (snap(f.uid, 'left'), true);
		if (e.shiftKey && e.key === 'ArrowRight') return (snap(f.uid, 'right'), true);
		if (e.code === 'KeyW') return (close(f.uid), true);
		return false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (handleKey(e)) e.preventDefault();
	}

	const box = $derived(preview ? snapRect(preview, os.area) : null);
</script>

<svelte:window {onkeydown} />

<div class="layer" data-os-layer data-ui="os-layer" bind:clientWidth={w} bind:clientHeight={h}>
	{#if os.loaded}
		{#each os.state.desks as d (d.id)}
			{#if seen.has(d.id)}
				<div class="desk" class:off={d.id !== os.state.active} aria-hidden={d.id !== os.state.active || undefined} data-desk={d.id}>
					{#each d.wins as win (win.uid)}
						{@const app = appOf(win)}
						{#if app}
							<Window {win} {app} active={d.id === os.state.active && focusedWin()?.uid === win.uid} onpreview={(s) => (preview = s)} onkey={handleKey} />
						{/if}
					{/each}
				</div>
			{/if}
		{/each}
	{/if}
	{#if box}
		<div class="preview" style:left="{box.x}px" style:top="{box.y}px" style:width="{box.w}px" style:height="{box.h}px" aria-hidden="true"></div>
	{/if}
</div>

<style>
	.layer {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.desk {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.desk > :global(*) {
		pointer-events: auto;
	}

	/* Otro escritorio: oculto sin desmontar. */
	.desk.off,
	.desk.off > :global(*) {
		visibility: hidden;
		pointer-events: none;
	}

	.preview {
		position: absolute;
		z-index: 9999;
		background: var(--os-snap);
		border: var(--os-win-edge-active);
		border-radius: var(--os-win-radius);
		pointer-events: none;
	}
</style>
