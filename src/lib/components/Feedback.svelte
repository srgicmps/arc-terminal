<!--
	«Sugerencias / algo va mal», en el pie de todas las vistas. Abre un diálogo con un texto libre y lo manda a
	/api/feedback (cloud/feedback.ts) con la vista en la que estás: se guarda en tu cuenta y avisa a Sergi.
	Solo sale con cuenta (arcterminal.dev); en GitHub Pages no hay servidor donde guardarlo.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import { cloud } from '#lib/cloud.svelte.ts';

	const MAX = 2000;
	let dialog = $state<HTMLDialogElement>();
	let text = $state('');
	let sending = $state(false);
	let notice = $state('');

	function open() {
		notice = '';
		dialog?.showModal();
	}

	async function send(e: SubmitEvent) {
		e.preventDefault();
		if (!text.trim() || sending) return;
		sending = true;
		try {
			const res = await fetch(asset('api/feedback' as Parameters<typeof asset>[0]), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ view: page.url.pathname, text }),
				credentials: 'same-origin',
				redirect: 'manual'
			});
			if (res.ok) {
				text = '';
				notice = 'Enviado. ¡Gracias!';
				setTimeout(() => dialog?.close(), 1200);
			} else notice = res.status === 429 ? 'Ya has mandado muchas hoy. Prueba mañana.' : 'No se ha podido enviar.';
		} catch {
			notice = 'No se ha podido enviar.';
		} finally {
			sending = false;
		}
	}
</script>

{#if cloud.user}
	<button class="open" type="button" onclick={open}>Sugerencias / algo va mal</button>
	<dialog bind:this={dialog} aria-labelledby="fb-title" onclick={(e) => e.target === dialog && dialog?.close()}>
		<form onsubmit={send}>
			<h2 id="fb-title">Sugerencias / algo va mal</h2>
			<p>Cuéntalo con tus palabras. Se manda con la vista en la que estás ({page.url.pathname}).</p>
			<textarea bind:value={text} maxlength={MAX} rows="5" aria-label="Tu mensaje" required></textarea>
			<div class="row">
				<span class="note" role="status">{notice}</span>
				<button type="button" onclick={() => dialog?.close()}>Cancelar</button>
				<button class="go" type="submit" disabled={sending || !text.trim()}>Enviar</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	/* Como los enlaces del pie. */
	.open {
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.open:hover {
		color: var(--amber);
	}

	dialog {
		width: min(32rem, calc(100vw - 2 * var(--pad-x)));
		padding: var(--sp-14) var(--pad-x);
		background: var(--panel);
		color: var(--fg);
		border: var(--border);
	}

	dialog::backdrop {
		background: var(--scrim);
	}

	h2 {
		margin: 0 0 var(--sp-6);
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
	}

	p {
		margin: 0 0 var(--sp-10);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	textarea {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: var(--sp-6) var(--sp-8);
		background: var(--bg);
		color: var(--fg);
		border: var(--border);
		font: inherit;
		font-size: var(--fs-m);
		resize: vertical;
	}

	textarea:focus {
		outline: var(--hair) solid var(--amber-edge);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		margin-top: var(--sp-10);
	}

	.note {
		flex: 1;
		color: var(--amber-dim);
		font-size: var(--fs-s);
	}

	.row button {
		height: var(--control-h);
		padding-inline: var(--sp-12);
		background: none;
		color: var(--muted);
		border: var(--border);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.row .go {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	.row button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
