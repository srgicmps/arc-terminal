<!--
	El escritorio de Arc OS: mide su tamaño (para encajar y recolocar las ventanas), pinta las ventanas y escucha
	los atajos. Los escritorios que no se ven siguen montados pero ocultos (sus vistas no se recargan al volver);
	uno que aún no se ha visto en esta visita no se monta hasta que se abre (carga diferida).
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { switchStep } from '#lib/os/system/switcher.svelte.ts';
	import { appOf, close, focusedWin, goDesk, loadOs, maximize, minimize, openApp, os, sendToDesk, setArea, snap, tile, toggleTop } from '#lib/os/os.svelte.ts';
	import { findWin } from '#lib/os/wm.ts';
	import { altTyped } from '#lib/os/focus.ts';
	import { isTyping } from '#lib/rownav.ts';
	import ContextMenu, { type MenuEntry } from './ContextMenu.svelte';
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
	 * anterior; Alt+Tab también, cuando el sistema lo deja llegar al navegador, p. ej. a pantalla completa),
	 * Alt+↑ maximizar, Alt+↓ minimizar, Alt+⇧+← / → encajar a una mitad, Alt+W cerrar, Alt+T mosaico y Alt+1…6
	 * escritorio. ⌘/Super+flechas encaja como en Mac y Windows (si el sistema no se lo queda). Ctrl+W y Ctrl+Tab son
	 * del navegador: no se pueden usar. Devuelve si era un atajo.
	 */
	export function handleKey(e: Key): boolean {
		// Ctrl+Alt+T: una Terminal nueva, como en Linux (OS 3, src/lib/os/apps/terminal.ts).
		if (e.ctrlKey && e.altKey && e.code === 'KeyT') return (openApp('terminal'), true);
		const f = focusedWin();
		if (e.metaKey && !e.altKey && !e.ctrlKey && f) {
			const to: Record<string, Snap | null> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'max', ArrowDown: null };
			if (!(e.key in to)) return false;
			snap(f.uid, to[e.key]);
			return true;
		}
		if (!e.altKey || e.ctrlKey || e.metaKey) return false;
		// ⌥ + tecla en un campo, en el Mac, escribe «@», «|», «\»…: no es un atajo (en un iframe lo filtra embed.ts).
		if (altTyped(e.key) && isTyping(document.activeElement)) return false;
		// Siguiente ventana con el Alt+Tab visual de «OS 5» (src/lib/os/system/switcher.svelte.ts).
		if (e.key === 'Tab' || e.code === 'Backquote' || e.code === 'IntlBackslash') return (switchStep(e.shiftKey ? -1 : 1), true);
		const n = /^Digit([1-6])$/.exec(e.code);
		if (n) {
			const d = os.state.desks[Number(n[1]) - 1];
			if (d) goDesk(d.id);
			return true;
		}
		if (e.code === 'KeyT') return (tile(), true);
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

	// Menú de la ventana (clic derecho en la barra de título).
	let menu = $state<{ uid: string; x: number; y: number } | null>(null);
	const menuItems = (uid: string): MenuEntry[] => {
		const w = findWin(os.state, uid);
		if (!w) return [];
		const others = os.state.desks.filter((d) => !d.wins.some((x) => x.uid === uid));
		return [
			{ label: 'Minimizar', kbd: 'Alt+↓', run: () => minimize(uid) },
			{ label: w.snap === 'max' ? 'Restaurar' : 'Maximizar', kbd: 'Alt+↑', run: () => maximize(uid) },
			{ label: 'Media pantalla a la izquierda', kbd: 'Alt+⇧+←', run: () => snap(uid, 'left') },
			{ label: 'Media pantalla a la derecha', kbd: 'Alt+⇧+→', run: () => snap(uid, 'right') },
			{ label: 'Siempre encima', checked: !!w.top, run: () => toggleTop(uid) },
			'sep',
			{ label: 'Nueva ventana', run: () => openApp(w.app, undefined, true) },
			...others.map((d): MenuEntry => ({ label: `Mover a «${d.name}»`, run: () => sendToDesk(uid, d.id) })),
			'sep',
			{ label: 'Cerrar', kbd: 'Alt+W', run: () => close(uid) }
		];
	};
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
							<Window {win} {app} active={d.id === os.state.active && focusedWin()?.uid === win.uid} onpreview={(s) => (preview = s)} onmenu={(x, y) => (menu = { uid: win.uid, x, y })} />
						{/if}
					{/each}
				</div>
			{/if}
		{/each}
	{/if}
	{#if menu}
		<ContextMenu x={menu.x} y={menu.y} label="Ventana" items={menuItems(menu.uid)} onclose={() => (menu = null)} />
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

	/* Y sin pintar: sus iframes, globos y gráficos no gastan mientras no se ve (como al minimizar). */
	.desk.off {
		content-visibility: hidden;
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
