<!--
	Pantalla de bloqueo de Arc OS, al estilo de un NAS en la web: el fondo del escritorio a pantalla completa, la
	hora y la fecha arriba y una tarjeta centrada con tu nombre, un saludo y los avisos sin leer (del centro de
	notificaciones de la shell). En el móvil (≤ 900 px), cara de teléfono: hora grande, avisos en tarjetas de
	cristal y «Desliza hacia arriba para abrir». Se entra con un clic, una tecla o deslizando. No protege nada: la
	cuenta ya la protege Cloudflare Access.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { cloud } from '#lib/cloud.svelte.ts';
	import Logo from '#lib/components/Logo.svelte';
	import { refreshNotices, shell } from '../shell/shell.svelte.ts';
	import { greeting, lockSummary, userName } from './boot.ts';

	let { onunlock }: { onunlock: () => void } = $props();

	let now = $state(new Date());
	let el = $state<HTMLDivElement>();
	let leaving = $state(false);
	let startY: number | null = null;

	$effect(() => {
		el?.focus();
		// Si la shell aún no ha pedido los avisos (el centro de notificaciones no está montado), se piden aquí.
		untrack(() => !shell.notices.length && refreshNotices());
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const time = $derived(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
	const date = $derived(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
	const sum = $derived(lockSummary(shell.notices, shell.seen));
	const name = $derived(userName(cloud.user));

	function go() {
		if (leaving) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return onunlock();
		leaving = true;
		setTimeout(onunlock, 220);
	}
	function key(e: KeyboardEvent) {
		// Las teclas modificadoras solas no desbloquean (Alt para cambiar de ventana, por ejemplo).
		if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
		e.preventDefault();
		e.stopPropagation();
		go();
	}
	// Tocar o deslizar hacia arriba: las dos cosas abren (como en un teléfono).
	const down = (e: PointerEvent) => (startY = e.clientY);
	function up(e: PointerEvent) {
		if (startY !== null && (startY - e.clientY > 40 || Math.abs(startY - e.clientY) < 8)) go();
		startY = null;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="lock"
	class:leaving
	role="dialog"
	aria-modal="true"
	aria-label="Pantalla de bloqueo. Pulsa una tecla para entrar"
	tabindex="-1"
	bind:this={el}
	onpointerdown={down}
	onpointerup={up}
	onkeydown={key}
>
	<div class="when">
		<p class="time">{time}</p>
		<p class="date">{date}</p>
	</div>
	<div class="card">
		<span class="avatar" aria-hidden="true">{#if name}{name[0]}{:else}<Logo size="var(--sp-24)" />{/if}</span>
		<p class="who">{name || 'Arc OS'}</p>
		<p class="hi">{greeting(now.getHours())}. <span class="mut">{sum.headline}</span></p>
		{#if sum.items.length}
			<ul>
				{#each sum.items as n (n.id)}
					<li><span class="k">{n.kind === 'aviso' ? 'Aviso' : 'Novedad'}</span><span class="t">{n.title}</span></li>
				{/each}
			</ul>
		{/if}
		<button type="button" class="enter" onclick={go}>Entrar →</button>
	</div>
	<p class="hint"><span class="desk">Toca o pulsa una tecla para entrar</span><span class="phone">Desliza hacia arriba para abrir</span></p>
</div>

<style>
	.lock {
		position: fixed;
		inset: 0;
		z-index: var(--z-system);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-24);
		padding: var(--sp-24) var(--sp-16);
		background: var(--os-desk);
		background-image: var(--bg-image);
		background-size: cover;
		color: var(--fg);
		outline: none;
		cursor: default;
		text-align: center;
		touch-action: none;
		transition:
			opacity 200ms ease-out,
			transform 200ms ease-out;
	}

	.lock.leaving {
		opacity: 0;
		transform: translateY(-3%);
	}

	p {
		margin: 0;
	}

	.time {
		font-family: var(--mono);
		font-size: var(--fs-clock);
		font-weight: var(--fw-regular);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.date {
		margin-top: var(--sp-8);
		font-family: var(--sans);
		font-size: var(--fs-l);
		color: var(--muted);
	}

	.date::first-letter {
		text-transform: uppercase;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-8);
		width: min(100%, var(--os-lock-card));
		padding: var(--sp-24) var(--sp-20);
		background: var(--os-glass, var(--panel));
		backdrop-filter: var(--os-glass-blur, none);
		border: var(--border);
		border-radius: var(--os-win-radius);
		box-shadow: var(--shadow-pop);
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: var(--os-avatar);
		height: var(--os-avatar);
		border-radius: 50%;
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber-dim);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xl);
	}

	.who {
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}

	ul {
		align-self: stretch;
		margin: var(--sp-4) 0 0;
		padding: 0;
		list-style: none;
		text-align: left;
		border-top: var(--border);
	}

	li {
		display: flex;
		gap: var(--sp-6);
		align-items: baseline;
		padding: var(--sp-6) 0;
		border-bottom: var(--border);
	}

	.t {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.k {
		flex: none;
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
	}

	.enter {
		margin-top: var(--sp-8);
		height: var(--control-h);
		padding: 0 var(--sp-16);
		background: var(--amber);
		color: var(--bg);
		border: 0;
		border-radius: var(--radius-s);
		font-family: var(--mono);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.hint {
		position: absolute;
		bottom: var(--sp-24);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	.phone {
		display: none;
	}

	/* Móvil: cara de teléfono (como el Modo OS del móvil de «OS 3»). */
	@media (max-width: 900px) {
		.lock {
			justify-content: flex-start;
			padding-top: calc(var(--sp-24) * 3);
			background: var(--os-phone-wall, var(--os-desk));
			font-family: var(--os-phone-font, var(--sans));
		}
		.card {
			background: none;
			backdrop-filter: none;
			border: 0;
			box-shadow: none;
			padding: 0;
		}
		.avatar,
		.who,
		.enter,
		.desk {
			display: none;
		}
		ul {
			border: 0;
			display: grid;
			gap: var(--sp-8);
		}
		li {
			flex-direction: column;
			gap: var(--sp-2);
			padding: var(--sp-10) var(--sp-12);
			border: 0;
			border-radius: var(--os-win-radius);
			background: var(--os-glass, var(--panel));
			backdrop-filter: var(--os-glass-blur, none);
		}
		.t {
			white-space: normal;
		}
		.phone {
			display: inline;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lock {
			transition: none;
		}
	}
</style>
