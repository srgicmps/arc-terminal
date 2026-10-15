<!--
	Un icono de la pantalla de inicio: el icono SVG de la app (OsIcon, de OS 2b), el nombre debajo y,
	si hay cosas nuevas, la insignia roja con el número. `bare`: sin nombre (dock).
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import { badgeText, type PhoneApp } from './home.ts';

	let { app, badge = 0, bare = false, onopen }: { app: PhoneApp; badge?: number; bare?: boolean; onopen: (a: PhoneApp) => void } = $props();
	/** Lado del icono en px (OsIcon lo pide en número); el hueco lo marca --os-icon-size. */
	const SIZE = 58;
</script>

<button class="app" onclick={() => onopen(app)} aria-label={badge ? `${app.name}, ${badge} nuevas` : app.name}>
	<span class="sq" aria-hidden="true">
		<OsIcon id={app.id} size={SIZE} />
		{#if badge}<b class="badge">{badgeText(badge)}</b>{/if}
	</span>
	{#if !bare}<span class="name" aria-hidden="true">{app.name}</span>{/if}
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
		place-items: center;
		width: var(--os-icon-size);
		height: var(--os-icon-size);
		transition: transform var(--dur-fast) var(--ease);
	}
	/* El dibujo sigue al hueco (--os-icon-size encoge en pantallas bajas). */
	.sq > :global(.os-icon),
	.sq > :global(.os-icon) :global(.tile),
	.sq > :global(.os-icon) :global(svg) {
		width: 100% !important;
		height: 100% !important;
	}
	.app:active .sq {
		transform: scale(0.92);
		filter: brightness(0.85);
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
