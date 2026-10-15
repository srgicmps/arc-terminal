<!--
	Vista previa de Arc OS para la invitación (Bienvenida y aviso de novedades): un escritorio en miniatura donde se
	abren dos ventanas y la consola escribe un comando. Solo CSS, con los colores del estilo que tengas. Sin
	movimiento si el sistema pide reducirlo (se ve el último fotograma). Decorativa: aria-hidden; el texto la explica.
-->
<div class="pv" aria-hidden="true">
	<div class="desk">
		<div class="win w1">
			<div class="bar"><i></i><i></i><i></i><b>ECO</b></div>
			<div class="body"><span class="l"></span><span class="l s"></span><span class="spark"></span></div>
		</div>
		<div class="win w2">
			<div class="bar"><i></i><i></i><i></i><b>Terminal</b></div>
			<div class="body mono"><span class="type">arc&gt; NVDA</span></div>
		</div>
		<div class="win w3">
			<div class="bar"><i></i><i></i><i></i><b>WS</b></div>
			<div class="body heat"><u></u><u></u><u></u><u></u><u></u><u></u></div>
		</div>
	</div>
	<div class="dock"><em></em><em></em><em></em><em></em><em></em></div>
</div>

<style>
	.pv {
		position: relative;
		aspect-ratio: 16 / 10;
		width: 100%;
		max-width: 420px;
		border: var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		overflow: hidden;
	}
	.desk {
		position: absolute;
		inset: 0 0 18% 0;
	}
	.win {
		position: absolute;
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow);
		opacity: 0;
		transform: scale(0.92);
		animation: pop 9s var(--ease) infinite;
	}
	.w1 {
		left: 6%;
		top: 8%;
		width: 46%;
		height: 58%;
	}
	.w2 {
		left: 38%;
		top: 38%;
		width: 44%;
		height: 40%;
		animation-delay: 1.2s;
	}
	.w3 {
		left: 56%;
		top: 6%;
		width: 38%;
		height: 40%;
		animation-delay: 2.4s;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 5px;
		border-bottom: var(--border);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--muted);
	}
	.bar i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--faint);
	}
	.bar b {
		margin-left: auto;
		font-weight: var(--fw-medium);
		color: var(--amber);
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
	}
	.l {
		height: 4px;
		width: 80%;
		background: var(--faint);
	}
	.l.s {
		width: 55%;
	}
	.spark {
		flex: 1;
		min-height: 20px;
		border-bottom: var(--hair) solid var(--amber);
		background: linear-gradient(170deg, transparent 55%, var(--amber-soft) 56%, transparent 80%);
	}
	.mono {
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--amber);
	}
	.type {
		display: inline-block;
		overflow: hidden;
		white-space: nowrap;
		width: 0;
		border-right: var(--hair) solid var(--amber);
		animation: type 9s steps(10) infinite;
		animation-delay: 1.2s;
	}
	.heat {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
	}
	.heat u {
		height: 12px;
		background: var(--up);
		opacity: 0.55;
	}
	.heat u:nth-child(2n) {
		background: var(--down);
	}
	.dock {
		position: absolute;
		left: 50%;
		bottom: 4%;
		transform: translateX(-50%);
		display: flex;
		gap: 6px;
		padding: 4px 8px;
		border: var(--border);
		border-radius: var(--radius);
		background: var(--panel);
	}
	.dock em {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-s);
		background: var(--faint);
	}
	.dock em:nth-child(2) {
		background: var(--amber);
	}
	@keyframes pop {
		0%,
		4% {
			opacity: 0;
			transform: scale(0.92);
		}
		10%,
		88% {
			opacity: 1;
			transform: scale(1);
		}
		96%,
		100% {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	@keyframes type {
		0%,
		12% {
			width: 0;
		}
		30%,
		100% {
			width: 10ch;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.win,
		.type {
			animation: none;
			opacity: 1;
			transform: none;
		}
		.type {
			width: 10ch;
		}
	}
</style>
