<!--
	«En este dispositivo» (AVISOS, panel «En tu móvil»): los avisos llegan a este navegador sin instalar nada (Web
	Push). Se suma a ntfy, que sigue debajo igual. Solo sale si /api/push está configurado (Secret VAPID_PRIVATE_KEY,
	cloud/push.ts); si no, no se ve nada. El permiso del navegador se pide al pulsar «Activar», nunca antes.
	Lógica en src/lib/webpush.ts.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { asset } from '$app/paths';
	import ButtonRow from './ui/ButtonRow.svelte';
	import { installPlatform, iosSafari } from '#lib/install.ts';
	import { currentSub, disablePush, enablePush, pushApi, pushSupport, sameKey, testPush } from '#lib/webpush.ts';

	const url = asset('api/push' as Parameters<typeof asset>[0]);

	type Phase = 'loading' | 'hidden' | 'install' | 'no' | 'denied' | 'off' | 'on';
	let phase = $state<Phase>('loading');
	let key = '';
	let busy = $state(false);
	let msg = $state('');
	let safari = $state(true);
	// La web instalada en el iPhone o el iPad: sin barra del navegador para cambiar el permiso ni recargar.
	let iosApp = $state(false);
	let enableBtn = $state<HTMLButtonElement>();
	let testBtn = $state<HTMLButtonElement>();
	const id = $props.id();

	$effect(() => {
		void start();
	});

	async function start() {
		// Sin cuenta (en local, en GitHub Pages): ni se intenta.
		if (new URL(url, location.href).pathname !== '/api/push') return void (phase = 'hidden');
		// La clave pública: si /api/push no responde (sin la clave VAPID, 503), la fila no sale.
		const r = await pushApi(url).catch(() => null);
		if (r?.status !== 200 || typeof r.body.key !== 'string') return void (phase = 'hidden');
		key = r.body.key;
		const standalone =
			matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
		const support = pushSupport({
			push: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
			ua: navigator.userAgent,
			standalone,
			touchPoints: navigator.maxTouchPoints
		});
		safari = iosSafari(navigator.userAgent);
		iosApp = standalone && installPlatform(navigator.userAgent, false, navigator.maxTouchPoints) === 'ios';
		if (support !== 'ok') return void (phase = support);
		if (Notification.permission === 'denied') return void (phase = 'denied');
		const sub = await currentSub().catch(() => null);
		if (sub && Notification.permission === 'granted' && sameKey(sub.options.applicationServerKey, key)) {
			phase = 'on';
			// Se vuelve a guardar en la cuenta (por si se borró, o la quitaste en otro sitio): no cuesta nada. Con
			// refresh, nunca se la quita a otra cuenta (un navegador compartido): si es de otra, aquí sale sin activar.
			void pushApi(url, 'PUT', { ...sub.toJSON(), refresh: true })
				.then((r) => {
					if (r.status === 400) phase = 'no';
					else if (r.status === 200 && r.body.mine === false) phase = 'off';
				})
				.catch(() => null);
		} else phase = 'off';
	}

	async function run(task: () => Promise<void>) {
		busy = true;
		msg = '';
		try {
			await task();
		} catch {
			msg = 'No ha salido bien. Prueba otra vez.';
		}
		busy = false;
		// El botón pulsado se desactiva y el foco se iría a <body> (un lector de pantalla pierde su sitio): pasa al
		// que toca ahora, «Probar» con los avisos activados y, si no, «Activar».
		await tick();
		(phase === 'on' ? testBtn : phase === 'off' ? enableBtn : undefined)?.focus();
	}

	// Sin await antes de enablePush: el permiso tiene que pedirse justo al tocar.
	const enable = () =>
		run(async () => {
			const r = await enablePush(url, key);
			if (r === 'ok') {
				phase = 'on';
				msg = 'Activados. Pulsa «Probar» para ver uno.';
			} else if (r === 'unsupported') phase = 'no';
			else if (r === 'denied') {
				phase = Notification.permission === 'denied' ? 'denied' : 'off';
				msg = phase === 'off' ? 'Sin permiso no te pueden llegar.' : '';
			} else msg = 'No se han podido activar. Prueba otra vez.';
		});

	const test = () =>
		run(async () => {
			msg = (await testPush(url)) ? 'Enviado: te llega en unos segundos.' : 'No se ha podido enviar. Quítalos y actívalos otra vez.';
		});

	const remove = () =>
		run(async () => {
			await disablePush(url);
			phase = 'off';
			msg = 'Quitados de este dispositivo.';
		});

	const STATE: Record<Phase, string> = {
		loading: '',
		hidden: '',
		install: 'Hay que instalarla',
		no: 'No compatible',
		denied: 'Bloqueados',
		off: 'Sin activar',
		on: 'Activados'
	};
</script>

{#if phase !== 'loading' && phase !== 'hidden'}
	<div class="device">
		<span class="label" id="{id}-label">En este dispositivo</span>
		<span class="state" class:on={phase === 'on'}>{STATE[phase]}</span>
	</div>
	{#if phase === 'install'}
		<p class="hint">
			En el iPhone o el iPad, los avisos solo llegan con la web instalada{safari ? '' : ' desde Safari'}: Compartir →
			«Añadir a pantalla de inicio», ábrela desde ahí y vuelve a AVISOS (iOS 16.4 o posterior).
		</p>
	{:else if phase === 'no'}
		<p class="hint">Este navegador no recibe avisos. Usa ntfy, aquí debajo.</p>
	{:else if phase === 'denied'}
		<p class="hint">
			Tienes los avisos de esta web bloqueados: {iosApp
				? 'permítelos en Ajustes → Notificaciones → Arc Terminal y vuelve a abrirla.'
				: 'permítelos en los ajustes del navegador y recarga.'}
		</p>
	{:else}
		<!-- Con nombre, para que un lector de pantalla sepa de qué son «Activar», «Probar» y «Quitar». -->
		<div role="group" aria-labelledby="{id}-label">
			<ButtonRow>
				<button type="button" bind:this={enableBtn} disabled={busy || phase === 'on'} onclick={enable}>Activar</button>
				<button type="button" bind:this={testBtn} disabled={busy || phase !== 'on'} onclick={test}>Probar</button>
				<button type="button" disabled={busy || phase !== 'on'} onclick={remove}>Quitar</button>
			</ButtonRow>
		</div>
	{/if}
	<!-- Siempre en la página: un aviso que entra ya con el texto puesto a menudo no se lee (VoiceOver). -->
	<p class="hint" class:empty={!msg} role="status">{msg}</p>
	<p class="hint or">
		{#if phase === 'on' || phase === 'off'}
			Llegan a este navegador sin instalar nada, aunque tengas la web cerrada. O con la app ntfy, en cualquier móvil:
		{:else if phase === 'no'}
			Con la app ntfy, en cualquier móvil:
		{:else}
			O con la app ntfy, en cualquier móvil:
		{/if}
	</p>
{/if}

<style>
	.device {
		display: flex;
		gap: var(--sp-8);
		align-items: baseline;
		justify-content: space-between;
		padding: var(--row-y) var(--pad-x);
	}
	.label {
		min-width: 0;
		font-size: var(--fs-s);
		color: var(--fg);
	}
	.state {
		flex: none;
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.state.on {
		color: var(--amber);
	}
	.hint {
		margin: 0;
		padding: var(--sp-6) var(--pad-x);
		font-family: var(--sans);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
		color: var(--muted);
	}
	.hint.empty {
		padding: 0;
	}
	.or {
		padding-top: var(--row-y);
		color: var(--faint);
	}
</style>
