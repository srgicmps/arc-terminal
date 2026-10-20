// Avisos en el navegador (Web Push, cloud/push.ts): qué se enseña cuando llega uno y qué se abre al tocarlo.
// Lógica pura, para poder probarla (scripts/__tests__/sw-push.test.ts); los listeners están al final de index.ts.

export interface Notice {
	title: string;
	options: NotificationOptions & { data: { url: string } };
}

/** Solo enlaces http(s) absolutos (o relativos a la web); si no, la portada. */
export function safeUrl(raw: unknown, scope: string): string {
	try {
		const u = new URL(typeof raw === 'string' && raw ? raw : scope, scope);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : scope;
	} catch {
		return scope;
	}
}

/**
 * La notificación de un aviso (el JSON de cloud/push.ts: title, body, url, tag). Siempre sale una, aunque el
 * aviso llegue vacío o roto: si un push no enseña nada, Safari y Chrome acaban quitando el permiso.
 */
export function notice(text: string | null | undefined, scope: string): Notice {
	let m: Record<string, unknown> = {};
	try {
		const v: unknown = JSON.parse(text ?? '');
		if (v && typeof v === 'object' && !Array.isArray(v)) m = v as Record<string, unknown>;
	} catch {
		// Abajo, el aviso genérico.
	}
	const title = typeof m.title === 'string' && m.title.trim() ? m.title.trim().slice(0, 120) : 'Arc Terminal';
	const body = typeof m.body === 'string' ? m.body.slice(0, 1500) : 'Tienes un aviso nuevo.';
	const tag = typeof m.tag === 'string' && m.tag ? m.tag.slice(0, 64) : undefined;
	return {
		title,
		options: {
			body,
			lang: 'es',
			icon: new URL('icon-192.png', scope).href,
			data: { url: safeUrl(m.url, scope) },
			...(tag ? { tag } : {})
		}
	};
}

/** La vista que abre un aviso al tocarlo (lo guardado en data.url), o la portada. */
export const clickUrl = (data: unknown, scope: string) => safeUrl((data as { url?: unknown } | null)?.url, scope);

/** Lo que se usa de una ventana de la web (el WindowClient del navegador); así se prueba sin él. */
export interface Tab {
	readonly url: string;
	readonly frameType?: string;
	focus(): Promise<unknown>;
	navigate(url: string): Promise<Tab | null>;
}

const sameOrigin = (url: string, origin: string) => {
	try {
		return new URL(url).origin === origin;
	} catch {
		return false;
	}
};

/**
 * La ventana de la web donde abrir un aviso: la última que se usó (matchAll las da en ese orden), pero nunca un
 * iframe: las ventanas de Arc OS y su inicio en el móvil son vistas con ?embed=1 dentro de la página.
 */
export function mainTab<T extends Pick<Tab, 'url' | 'frameType'>>(tabs: readonly T[], origin: string): T | undefined {
	return tabs.find((t) => t.frameType !== 'nested' && sameOrigin(t.url, origin));
}

/**
 * Al tocar un aviso: si la web ya está abierta, esa ventana va a la vista del aviso y pasa delante; si no (o es un
 * enlace de fuera, como los de Familia), se abre otra. Primero navigate y luego focus: en Chrome, focus() gasta el
 * permiso de abrir ventana que da el toque, y el openWindow() de reserva fallaría. Si la ventana no se puede mover
 * (una que este service worker no controla, tras Mayús+Recargar) o acaba fuera de la web (el login de Access),
 * también se abre otra.
 */
export async function openNotice(
	target: string,
	scope: string,
	tabs: readonly Tab[],
	openWindow: (url: string) => Promise<unknown>
): Promise<void> {
	const origin = new URL(scope).origin;
	const tab = sameOrigin(target, origin) ? mainTab(tabs, origin) : undefined;
	const moved = tab ? await tab.navigate(target).catch(() => null) : null;
	if (moved) {
		await moved.focus().catch(() => null);
		return;
	}
	await openWindow(target);
}
