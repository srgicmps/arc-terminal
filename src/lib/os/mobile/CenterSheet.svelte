<!--
	Lo que baja desde arriba en el teléfono. «notif»: notificaciones (lo nuevo de NOVEDADES y los avisos del núcleo).
	«control»: centro de control con baldosas (tema, modo Sencillo, pantalla completa, estética y volver al Terminal
	clásico). Se cierra deslizando hacia arriba, con Esc o tocando fuera.
-->
<script lang="ts">
	import { cycleTheme, theme } from '#lib/theme.svelte.ts';
	import { modo, setModo } from '#lib/modo.svelte.ts';
	import { toggleFullscreen } from '#lib/fit.svelte.ts';
	import { leaveOS } from '../mode.svelte.ts';
	import type { Change } from '#lib/types.ts';

	let {
		kind,
		changes = [],
		notice = null,
		now,
		onclose,
		onpath
	}: {
		kind: 'notif' | 'control';
		changes?: Change[];
		notice?: string | null;
		now: number;
		onclose: () => void;
		onpath: (path: string) => void;
	} = $props();

	const THEME = { auto: 'Automático', light: 'Día', dark: 'Noche' } as const;
	const ago = (iso: string) => {
		const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
		return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
	};

	let startY = 0;
	const down = (e: PointerEvent) => (startY = e.clientY);
	const up = (e: PointerEvent) => startY - e.clientY > 60 && onclose();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onclose}></div>
<div class="sheet {kind}" role="dialog" tabindex="-1" aria-modal="true" aria-label={kind === 'notif' ? 'Notificaciones' : 'Centro de control'} onpointerdown={down} onpointerup={up}>
	{#if kind === 'notif'}
		<h2>Notificaciones</h2>
		{#if notice}<div class="note"><b>Arc OS</b><span>{notice}</span></div>{/if}
		{#each changes.slice(0, 8) as c (c.number)}
			<button class="note" onclick={() => onpath('/novedades')}>
				<b>Novedades <small>{ago(c.mergedAt)}</small></b>
				<span>{c.title}</span>
			</button>
		{:else}
			{#if !notice}<p class="empty">No hay notificaciones.</p>{/if}
		{/each}
	{:else}
		<div class="tiles">
			<button class="tile" onclick={cycleTheme}><span class="g" aria-hidden="true">◐</span><span>Tema<small>{THEME[theme.mode]}</small></span></button>
			<button class="tile" aria-pressed={modo.value === 'sencillo'} onclick={() => setModo(modo.value === 'sencillo' ? 'terminal' : 'sencillo')}>
				<span class="g" aria-hidden="true">Aa</span><span>Sencillo<small>{modo.value === 'sencillo' ? 'Sí' : 'No'}</small></span>
			</button>
			<button class="tile" onclick={toggleFullscreen}><span class="g" aria-hidden="true">⤢</span><span>Pantalla completa</span></button>
			<button class="tile" onclick={() => onpath('/estilo')}><span class="g" aria-hidden="true">◈</span><span>Estética</span></button>
			<button class="tile wide" onclick={leaveOS}><span class="g" aria-hidden="true">▤</span><span>Volver al Terminal clásico</span></button>
		</div>
	{/if}
	<span class="grab" aria-hidden="true"></span>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) + 1);
		background: var(--scrim);
	}
	.sheet {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: calc(var(--z-modal) + 2);
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		max-height: 85dvh;
		overflow-y: auto;
		padding: calc(env(safe-area-inset-top, 0px) + var(--sp-16)) var(--sp-16) var(--sp-12);
		border-radius: 0 0 var(--os-radius-l) var(--os-radius-l);
		background: var(--os-glass-strong);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		font-family: var(--os-phone-font);
		color: var(--fg);
		touch-action: pan-x;
		animation: down var(--dur-ui) var(--ease);
	}
	h2 {
		margin: 0 0 var(--sp-4);
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
	}
	.note {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-12) var(--sp-14);
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		text-align: left;
		cursor: pointer;
	}
	.note b {
		display: flex;
		justify-content: space-between;
		font-size: var(--fs-xs);
		color: var(--amber);
	}
	.note small {
		color: var(--muted);
		font-weight: var(--fw-regular);
	}
	.empty {
		color: var(--muted);
	}
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-10);
	}
	.tile {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		min-height: 64px;
		padding: var(--sp-12);
		border: 0;
		border-radius: var(--os-radius-l);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
		text-align: left;
		cursor: pointer;
	}
	.tile[aria-pressed='true'] {
		background: var(--amber);
		color: var(--on-amber);
	}
	.tile span:last-child {
		display: flex;
		flex-direction: column;
	}
	.tile small {
		opacity: 0.7;
		font-weight: var(--fw-regular);
	}
	.tile.wide {
		grid-column: 1 / -1;
	}
	.g {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--panel);
		color: var(--amber);
		font-size: var(--fs-m);
	}
	.grab {
		align-self: center;
		width: 40px;
		height: 5px;
		margin-top: var(--sp-6);
		border-radius: 3px;
		background: var(--faint);
	}
	@keyframes down {
		from {
			transform: translateY(-100%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet {
			animation: none;
		}
	}
</style>
