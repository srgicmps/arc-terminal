<!--
	Botón ⧉ de la cabecera clásica: pasa al Modo OS. Siempre a mano (en el Modo OS, la vuelta está en el menú Inicio,
	el Panel de control y, en el móvil, el cajón de apps). Mismo tamaño que los demás botones de la cabecera.
-->
<script lang="ts">
	import { enterOS } from '../mode.svelte.ts';
</script>

<button class="os" type="button" onclick={enterOS} title="Modo OS: escritorio con ventanas · estás en el Terminal clásico" aria-label="Cambiar al Modo OS">
	<span aria-hidden="true">⧉</span>
</button>

<style>
	.os {
		display: grid;
		place-items: center;
		width: var(--btn-sm);
		height: var(--btn-sm);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-m);
		cursor: pointer;
	}
	.os:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
	@media (pointer: coarse) {
		.os {
			position: relative;
		}
		.os::after {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--sp-8));
		}
	}
</style>
