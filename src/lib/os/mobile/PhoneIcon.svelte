<!--
	Un icono de la pantalla de inicio: cuadrado redondeado («squircle») con el símbolo de la app, el nombre debajo y,
	si hay cosas nuevas, la insignia roja con el número. `bare`: sin nombre (dock).
-->
<script lang="ts">
	import { badgeText, type PhoneApp } from './home.ts';

	let { app, badge = 0, bare = false, onopen }: { app: PhoneApp; badge?: number; bare?: boolean; onopen: (a: PhoneApp) => void } = $props();
	const long = $derived([...app.icon].length > 2);
</script>

<button class="app" onclick={() => onopen(app)} aria-label={badge ? `${app.name}, ${badge} nuevas` : app.name}>
	<span class="sq" class:long aria-hidden="true">
		{app.icon}
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
		border-radius: var(--os-icon-radius);
		background: var(--os-icon-bg);
		box-shadow: var(--shadow), inset 0 0 0 var(--hair) var(--line);
		color: var(--os-icon-fg);
		font-size: var(--fs-xxl);
		line-height: 1;
		transition: transform var(--dur-fast) var(--ease);
	}
	.sq.long {
		font-size: var(--fs-l);
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
		text-shadow: 0 var(--hair) var(--sp-2) var(--bg);
	}
	@media (prefers-reduced-motion: reduce) {
		.sq {
			transition: none;
		}
	}
</style>
