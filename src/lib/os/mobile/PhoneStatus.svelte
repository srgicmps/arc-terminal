<!--
	Barra de estado del teléfono: hora a la izquierda (toca para las notificaciones) y, a la derecha, el centro de
	control. Sin cobertura, wifi ni batería: eran de adorno y en un iPhone de verdad duplicaban (con datos falsos) los
	de la barra del sistema, justo encima. El dibujo es propio y aria-hidden.
-->
<script lang="ts">
	let { time, onnotif, oncontrol }: { time: string; onnotif: () => void; oncontrol: () => void } = $props();
</script>

<div class="sb">
	<button class="t" onclick={onnotif} aria-label="Notificaciones · {time}">{time}</button>
	<button class="ic" onclick={oncontrol} aria-label="Centro de control">
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" /><circle cx="10.5" cy="4.5" r="1.6" /><circle cx="5.5" cy="11.5" r="1.6" /></svg>
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
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
</style>
