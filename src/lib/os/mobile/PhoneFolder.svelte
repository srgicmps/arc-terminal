<!--
	Una carpeta abierta: su nombre (se cambia en el modo edición) y sus apps en una rejilla de 4. Se cierra tocando
	fuera o con Esc. Mantener una app entra en el modo edición; arrastrarla fuera del recuadro la saca de la carpeta.
	El arrastre lo lleva MobileHome: aquí solo se marca dónde caería (data-drop) y se avisa al pulsar.
-->
<script lang="ts">
	import type { Folder, PhoneApp } from './home.ts';
	import PhoneIcon from './PhoneIcon.svelte';

	let {
		folder,
		apps,
		badge,
		editing,
		dragging = null,
		mark = null,
		onopen,
		onpress,
		onrename,
		onclose
	}: {
		folder: Folder;
		apps: PhoneApp[];
		badge: Record<string, number>;
		editing: boolean;
		/** La app que se está arrastrando (se atenúa). */
		dragging?: string | null;
		/** Dónde caería: antes o después de la app de esa posición. */
		mark?: { index: number; side: 'before' | 'after' } | null;
		onopen: (a: PhoneApp) => void;
		onpress: (e: PointerEvent, app: string) => void;
		onrename: (name: string) => void;
		onclose: () => void;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onclose}></div>
<div class="folder" role="dialog" aria-modal="true" aria-label="Carpeta {folder.name}" data-folder-panel>
	{#if editing}
		<input class="title" value={folder.name} maxlength="30" aria-label="Nombre de la carpeta" onchange={(e) => onrename(e.currentTarget.value)} />
	{:else}
		<h2 class="title">{folder.name}</h2>
	{/if}
	<div class="grid">
		{#each apps as a, i (a.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="cell"
				class:ghosted={dragging === a.id}
				class:mark-before={mark?.index === i && mark.side === 'before'}
				class:mark-after={mark?.index === i && mark.side === 'after'}
				data-drop="fitem:{i}"
				onpointerdown={(e) => onpress(e, a.id)}
			>
				<PhoneIcon app={a} badge={badge[a.id] ?? 0} onopen={(x) => !editing && onopen(x)} />
			</div>
		{/each}
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-modal) + 2);
		background: var(--os-glass-strong);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
	}
	.folder {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: calc(var(--z-modal) + 3);
		width: min(340px, calc(100vw - 2 * var(--sp-24)));
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		gap: var(--sp-16);
		animation: open var(--dur-ui) var(--ease);
	}
	.title {
		margin: 0;
		padding: 0 var(--sp-8);
		border: 0;
		background: none;
		color: var(--fg);
		font: var(--fw-bold) var(--fs-xl) / 1.2 var(--os-phone-font);
		text-align: center;
	}
	input.title {
		height: var(--touch);
		border-radius: var(--os-radius-l);
		background: var(--os-glass);
		outline: none;
		user-select: text;
		-webkit-user-select: text;
	}
	input.title:focus-visible {
		box-shadow: inset 0 0 0 var(--hair) var(--amber);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--sp-16) var(--sp-8);
		max-height: 60dvh;
		overflow-y: auto;
		padding: var(--sp-20) var(--sp-12);
		border-radius: calc(var(--os-radius-l) + var(--sp-8));
		background: var(--os-glass);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		box-shadow: inset 0 0 0 var(--hair) var(--line);
	}
	.cell {
		position: relative;
		display: flex;
		justify-content: center;
		min-width: 0;
		touch-action: none;
	}
	.ghosted {
		opacity: 0.3;
	}
	.mark-before::before,
	.mark-after::after {
		content: '';
		position: absolute;
		top: 0;
		width: var(--sp-2);
		height: var(--os-icon-size);
		border-radius: var(--sp-2);
		background: var(--amber);
	}
	.mark-before::before {
		left: calc(-1 * var(--sp-4));
	}
	.mark-after::after {
		right: calc(-1 * var(--sp-4));
	}
	@keyframes open {
		from {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.85);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.folder {
			animation: none;
		}
	}
</style>
