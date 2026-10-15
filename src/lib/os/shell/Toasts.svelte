<!--
	Avisos flotantes («toasts») de Arc OS: los de shell.toasts (notify() y los avisos nuevos del centro). En el
	escritorio salen abajo a la derecha; en el teléfono (`phone`), arriba como un banner, bajo la barra de estado.
	Cada uno se va solo a los 8 s (el tiempo se para mientras el ratón o el dedo está encima) o con ✕.
	Lo montan NoticeCenter (escritorio) y MobileHome (teléfono).
-->
<script lang="ts">
	import UiIcon from '../icons/UiIcon.svelte';
	import { dismissToast, shell } from './shell.svelte.ts';
	import type { Notice } from './notices.ts';

	interface Props {
		/** Tocar el aviso: abrir su enlace. */
		ongo: (n: Notice) => void;
		phone?: boolean;
	}
	let { ongo, phone = false }: Props = $props();

	/** Lo que se queda cada aviso en pantalla. */
	const SHOW_MS = 8000;
	/** Temporizador de cada toast (por id); se crea una vez por toast, no en cada cambio de la lista. */
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	let held = $state<string | null>(null);

	const arm = (id: string) => timers.set(id, setTimeout(() => dismissToast(id), SHOW_MS));

	$effect(() => {
		const ids = new Set(shell.toasts.map((t) => t.id));
		for (const id of ids) if (!timers.has(id) && held !== id) arm(id);
		for (const [id, t] of timers) if (!ids.has(id)) (clearTimeout(t), timers.delete(id));
	});
	$effect(() => () => {
		for (const t of timers.values()) clearTimeout(t);
		timers.clear();
	});

	function hold(id: string) {
		held = id;
		clearTimeout(timers.get(id));
		timers.delete(id);
	}
	function release(id: string) {
		if (held !== id) return;
		held = null;
		if (shell.toasts.some((t) => t.id === id)) arm(id);
	}
</script>

<div class="toasts" class:phone aria-live="polite">
	{#each shell.toasts as t (t.id)}
		<!-- Con el ratón encima o el foco dentro no se va (WCAG 2.2.1). Lo anuncia la región viva de fuera. -->
		<div class="toast" role="group" aria-label="Aviso" onpointerenter={() => hold(t.id)} onpointerleave={() => release(t.id)} onfocusin={() => hold(t.id)} onfocusout={() => release(t.id)}>
			<button type="button" class="body" onclick={() => (dismissToast(t.id), ongo(t))}>
				<b>{t.title}</b>
				{#if t.detail}<span class="mut">{t.detail}</span>{/if}
			</button>
			<button type="button" class="x" aria-label="Cerrar aviso" onclick={() => dismissToast(t.id)}><UiIcon id="close" size={12} /></button>
		</div>
	{/each}
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.toasts {
		position: fixed;
		right: var(--sp-12);
		bottom: calc(var(--os-bar-h) + var(--sp-12));
		z-index: var(--z-popover);
		display: grid;
		gap: var(--sp-8);
		width: min(320px, calc(100vw - 2 * var(--sp-12)));
	}
	:global([data-os-bar='top']) .toasts {
		bottom: var(--sp-12);
	}
	:global([data-os-skin='mac']) .toasts {
		bottom: calc(var(--os-dock-h) + var(--sp-12));
	}
	.toast {
		display: flex;
		align-items: flex-start;
		background: var(--panel);
		border: var(--border) solid var(--amber-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
	}
	.toast .body {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: var(--sp-2);
		padding: var(--sp-8) var(--sp-10);
		text-align: left;
		font-size: var(--fs-s);
	}
	.toast .x {
		display: grid;
		place-items: center;
		padding: var(--sp-8);
		color: var(--muted);
	}

	/* Teléfono: banner de cristal arriba, sobre la app abierta y bajo el bloqueo. */
	.toasts.phone {
		top: calc(env(safe-area-inset-top, 0px) + var(--sp-8));
		right: var(--sp-8);
		bottom: auto;
		left: var(--sp-8);
		z-index: calc(var(--z-modal) + 3);
		width: auto;
		font-family: var(--os-phone-font);
	}
	.phone .toast {
		background: var(--os-glass-strong);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		border: var(--hair) solid var(--line);
		border-radius: var(--os-radius-l);
	}
	.phone .body,
	.phone .x {
		min-height: var(--touch);
	}
	.phone .x {
		min-width: var(--touch);
	}
</style>
