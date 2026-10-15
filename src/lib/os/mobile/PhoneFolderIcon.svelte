<!--
	Una carpeta en la pantalla de inicio: el mismo cuadrado que un icono, con sus primeras nueve apps en miniatura, el
	nombre debajo y la suma de sus insignias.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import { badgeText, type Folder, type PhoneApp } from './home.ts';

	let { folder, apps, badge = 0, onopen }: { folder: Folder; apps: PhoneApp[]; badge?: number; onopen: () => void } = $props();
</script>

<button class="app" onclick={onopen} aria-label="Carpeta {folder.name}, {apps.length} apps{badge ? `, ${badge} nuevas` : ''}">
	<span class="sq" aria-hidden="true">
		{#each apps.slice(0, 9) as a (a.id)}<span class="mini"><OsIcon id={a.id} size={13} /></span>{/each}
		{#if badge}<b class="badge">{badgeText(badge)}</b>{/if}
	</span>
	<span class="name" aria-hidden="true">{folder.name}</span>
</button>

<style>
	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-6);
		width: 100%;
		min-width: 0;
		padding: 0;
		background: none;
		border: 0;
		color: var(--fg);
		font-family: var(--os-phone-font);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.sq {
		position: relative;
		display: grid;
		/* 3×3 desde arriba a la izquierda, como en un teléfono (con dos apps no quedan flotando en medio). */
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: var(--sp-2);
		place-items: center;
		width: var(--os-icon-size);
		height: var(--os-icon-size);
		padding: var(--sp-6);
		border-radius: var(--os-icon-radius);
		background: var(--os-glass);
		backdrop-filter: var(--os-glass-blur);
		-webkit-backdrop-filter: var(--os-glass-blur);
		box-shadow: inset 0 0 0 var(--hair) var(--os-icon-edge);
		color: var(--os-icon-fg);
		transition: transform var(--dur-fast) var(--ease);
	}
	.mini {
		width: 100%;
		height: 100%;
		line-height: 0;
	}
	/* Las miniaturas siguen al hueco (--os-icon-size encoge en pantallas bajas). */
	.mini > :global(.os-icon),
	.mini > :global(.os-icon) :global(.tile),
	.mini > :global(.os-icon) :global(svg) {
		width: 100% !important;
		height: 100% !important;
	}
	.app:active .sq {
		transform: scale(0.92);
	}
	.badge {
		position: absolute;
		top: calc(-1 * var(--sp-6));
		right: calc(-1 * var(--sp-6));
		min-width: 22px;
		height: 22px;
		padding: 0 var(--sp-6);
		border-radius: 11px;
		background: var(--os-badge-bg);
		color: var(--os-badge-fg);
		font: var(--fw-bold) var(--fs-xs) / 22px var(--os-phone-font);
		text-align: center;
		box-shadow: 0 0 0 var(--sp-2) var(--bg);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		text-transform: var(--os-icon-name-case);
		letter-spacing: var(--os-icon-name-track);
		text-shadow: 0 var(--hair) var(--sp-2) var(--bg);
	}
	@media (prefers-reduced-motion: reduce) {
		.sq {
			transition: none;
		}
	}
</style>
