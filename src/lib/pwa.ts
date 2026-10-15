// La app instalada (PWA): avisos del service worker y si la web ya está en la pantalla de inicio.

/**
 * El service worker avisa con { type: 'access-login' } cuando la sesión de Cloudflare Access ha caducado:
 * se recarga la página, que lleva al login. Como mucho una vez por minuto, para no entrar en bucle.
 */
export function listenServiceWorker(): (() => void) | void {
	if (!('serviceWorker' in navigator)) return;
	const onMessage = (e: MessageEvent) => {
		if (e.data?.type !== 'access-login') return;
		try {
			if (Date.now() - Number(sessionStorage.getItem('arc-login-reload') ?? 0) < 60_000) return;
			sessionStorage.setItem('arc-login-reload', String(Date.now()));
		} catch {
			// Sin sessionStorage (modo privado estricto): se recarga igual.
		}
		location.reload();
	};
	navigator.serviceWorker.addEventListener('message', onMessage);
	return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
