<!--
	Barra de estado del teléfono: hora a la izquierda (toca para las notificaciones) y, a la derecha, cobertura, wifi
	y batería decorativos (toca para el centro de control). Los dibujos son propios y aria-hidden.
-->
<script lang="ts">
	let { time, onnotif, oncontrol }: { time: string; onnotif: () => void; oncontrol: () => void } = $props();
</script>

<div class="sb">
	<button class="t" onclick={onnotif} aria-label="Notificaciones · {time}">{time}</button>
	<button class="ic" onclick={oncontrol} aria-label="Centro de control">
		<svg viewBox="0 0 17 11" aria-hidden="true"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
		<svg viewBox="0 0 15 11" aria-hidden="true"><path d="M7.5 10.5 5.2 8.1a3.3 3.3 0 0 1 4.6 0zM2.9 5.8a6.5 6.5 0 0 1 9.2 0l-1.2 1.2a4.8 4.8 0 0 0-6.8 0zM.6 3.5a9.8 9.8 0 0 1 13.8 0l-1.2 1.2a8 8 0 0 0-11.4 0z" /></svg>
		<svg viewBox="0 0 26 12" aria-hidden="true" class="bat"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="16" height="8" rx="1.6" /><rect x="23.5" y="4" width="1.6" height="4" rx=".8" opacity=".45" /></svg>
	</button>
</div>

<style>
	.sb {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 var(--sp-24);
		font-family: var(--os-phone-font);
		color: var(--fg);
	}
	button {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--touch);
		padding: 0;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		font-weight: var(--fw-bold);
		font-size: var(--fs-m);
		cursor: pointer;
	}
	svg {
		height: 11px;
		width: auto;
		fill: currentColor;
	}
	.bat {
		height: 12px;
	}
</style>
