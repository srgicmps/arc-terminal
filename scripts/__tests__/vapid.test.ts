// scripts/vapid.ts: las claves que imprime valen para /api/push (cloud/webpush.ts) y no se guardan en ningún sitio;
// la herramienta «clave-push» (--cloudflare) la guarda en Cloudflare sin enseñarla nunca.
import { describe, expect, it } from 'vitest';
import { parseVapid } from '../../cloud/webpush.ts';
import { PROJECT, putVapidSecret, reason, report, SECRET, vapidInstructions } from '../vapid.ts';

describe('vapidInstructions', () => {
	it('da un JWK que el Secret VAPID_PRIVATE_KEY acepta, y su clave pública', async () => {
		const text = await vapidInstructions();
		const jwk = /^\s+(\{"kty":"EC".*\})$/m.exec(text)?.[1];
		const vapid = await parseVapid(jwk);
		expect(vapid).not.toBeNull();
		expect(text).toContain(vapid!.public);
		expect(text).toContain('VAPID_PRIVATE_KEY');
		// Cada vez, un par nuevo.
		expect(await vapidInstructions()).not.toBe(text);
	});
});

const API = `https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/${PROJECT}`;
const ENV = {
	GITHUB_ACTIONS: 'true',
	GITHUB_REF: 'refs/heads/main',
	CLOUDFLARE_API_TOKEN: 'tok',
	CLOUDFLARE_ACCOUNT_ID: 'acc'
};
type EnvVars = Record<string, { type: string; value?: string }>;
const project = (env_vars: EnvVars | null) =>
	Response.json({
		success: true,
		result: { name: PROJECT, deployment_configs: { production: { env_vars, wrangler_config_hash: 'hash-1' } } }
	});

/**
 * Un Cloudflare de mentira: guarda los Secrets como el de verdad (PATCH que mezcla; al leer, sin el valor) y apunta
 * cada llamada. `patch` decide la respuesta al PATCH (recibe `save`, que lo guarda); `get` puede cambiar la n-ésima
 * lectura (1, 2…). Las dos pueden lanzar, como un fetch sin respuesta.
 */
function cloudflare(
	initial: EnvVars | null = { NTFY_TOPIC: { type: 'secret_text', value: '' } },
	opts: { patch?: (save: () => void) => Response; get?: (n: number) => Response | undefined } = {}
) {
	let vars = initial;
	let gets = 0;
	const calls: { method: string; url: string; body?: string; auth?: string }[] = [];
	const fetcher = (async (url: string, init?: RequestInit) => {
		const method = init?.method ?? 'GET';
		calls.push({
			method,
			url,
			body: init?.body as string | undefined,
			auth: (init?.headers as Record<string, string>)?.authorization
		});
		if (url !== API) return new Response('', { status: 404 });
		if (method === 'PATCH') {
			const sent = JSON.parse(init!.body as string).deployment_configs.production.env_vars as EnvVars;
			const save = () => {
				vars = { ...vars, ...sent };
			};
			if (opts.patch) return opts.patch(save);
			save();
			return project(vars);
		}
		const special = opts.get?.(++gets);
		if (special) return special;
		// Cloudflare no devuelve el valor de un Secret.
		return project(vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, { type: v.type, value: '' }])));
	}) as typeof fetch;
	return { fetcher, calls, vars: () => vars };
}

const timeout = () => {
	throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
};

describe('putVapidSecret (herramienta «clave-push»)', () => {
	it('crea la clave y la guarda como Secret, como wrangler, sin que salga en el registro ni en el resumen', async () => {
		const cf = cloudflare();
		const logs: string[] = [];
		// Cuántas líneas de registro había al salir el PATCH: la máscara tiene que estar puesta ya.
		const atPatch: number[] = [];
		const fetcher = ((url: string, init?: RequestInit) => {
			if (init?.method === 'PATCH') atPatch.push(logs.length);
			return cf.fetcher(url, init);
		}) as typeof fetch;
		const result = await putVapidSecret(ENV, fetcher, (l) => logs.push(l));
		expect(result.status).toBe('creada');

		// Lo que se manda: el JWK como secret_text en producción, con el hash de wrangler.toml del proyecto.
		const patch = cf.calls.find((c) => c.method === 'PATCH')!;
		expect(patch.url).toBe(API);
		expect(patch.auth).toBe('Bearer tok');
		const sent = JSON.parse(patch.body!).deployment_configs.production;
		expect(sent.wrangler_config_hash).toBe('hash-1');
		expect(Object.keys(sent.env_vars)).toEqual([SECRET]);
		expect(sent.env_vars[SECRET].type).toBe('secret_text');
		const value: string = sent.env_vars[SECRET].value;
		const vapid = await parseVapid(value);
		expect(vapid).not.toBeNull();
		// Los otros Secrets siguen ahí (el PATCH solo añade).
		expect(Object.keys(cf.vars()!)).toEqual(['NTFY_TOPIC', SECRET]);

		// La parte secreta solo sale en ::add-mask::, y antes de mandarla a ninguna parte.
		const d = JSON.parse(value).d as string;
		expect(d.length).toBeGreaterThan(20);
		expect(atPatch).toEqual([1]);
		expect(logs[0]).toBe(`::add-mask::${d}`);
		expect(logs.filter((l) => l.includes(d))).toEqual([`::add-mask::${d}`]);
		const visible = [result.summary, report(result)].join('\n');
		expect(visible).not.toContain(d);
		expect(visible).not.toContain(value);
		// La pública sí, para poder compararla con /api/push.
		expect(result.summary).toContain(vapid!.public);
		expect(result.summary).toContain('Clave de los avisos guardada');
		// Leer, mandar y comprobar: tres llamadas.
		expect(cf.calls.map((c) => c.method)).toEqual(['GET', 'PATCH', 'GET']);
	});

	it('si ya hay una, no la toca (cambiarla obligaría a activar otra vez cada dispositivo)', async () => {
		const cf = cloudflare({ [SECRET]: { type: 'secret_text', value: 'la-de-antes' } });
		const logs: string[] = [];
		const result = await putVapidSecret(ENV, cf.fetcher, (l) => logs.push(l));
		expect(result.status).toBe('ya-estaba');
		expect(cf.calls.map((c) => c.method)).toEqual(['GET']);
		expect(cf.vars()![SECRET].value).toBe('la-de-antes');
		expect(logs).toEqual([]);
		// Una anotación de GitHub no entiende Markdown: sin viñetas ni comillas invertidas.
		const line = report(result);
		expect(line).toMatch(/^::notice title=Clave de los avisos::VAPID_PRIVATE_KEY ya existe/);
		expect(line).not.toMatch(/`| - /);
	});

	it('proyecto sin variables (env_vars null): la crea', async () => {
		const cf = cloudflare(null);
		expect((await putVapidSecret(ENV, cf.fetcher, () => {})).status).toBe('creada');
		expect(Object.keys(cf.vars()!)).toEqual([SECRET]);
	});

	it('si Cloudflare la rechaza, falla sin enseñar la clave y dice el código de error', async () => {
		const cf = cloudflare(undefined, {
			patch: () =>
				Response.json({ success: false, errors: [{ code: 8000000, message: 'eco del cuerpo' }] }, { status: 400 })
		});
		const logs: string[] = [];
		const result = await putVapidSecret(ENV, cf.fetcher, (l) => logs.push(l));
		expect(result.status).toBe('error');
		const d = logs[0].replace('::add-mask::', '');
		const line = report(result);
		expect(line).toMatch(/^::error title=Clave de los avisos::Cloudflare no ha aceptado la clave/);
		expect(line).toContain('400 (8000000)');
		expect(line).not.toContain('eco del cuerpo');
		expect(line).not.toContain(d);
		expect(result.summary).not.toContain(d);
		// La cuenta no sale en el mensaje.
		expect(line).not.toContain('/accounts/acc');
	});

	it('si el PATCH se queda sin respuesta pero Cloudflare la guardó, la da por creada (lo comprueba)', async () => {
		const cf = cloudflare(undefined, {
			patch: (save) => {
				save();
				return timeout();
			}
		});
		const result = await putVapidSecret(ENV, cf.fetcher, () => {});
		expect(result.status).toBe('creada');
		expect(cf.calls.map((c) => c.method)).toEqual(['GET', 'PATCH', 'GET']);
	});

	it('si el PATCH falla y no se guardó, lo dice sin afirmar más de lo que sabe', async () => {
		for (const patch of [timeout, () => Response.json({ success: false }, { status: 502 })]) {
			const result = await putVapidSecret(ENV, cloudflare(undefined, { patch }).fetcher, () => {});
			expect(result.status).toBe('error');
			expect(result.summary).toContain('no está en el proyecto');
			expect(result.summary).not.toContain('no se ha guardado nada');
		}
		const sinRespuesta = await putVapidSecret(ENV, cloudflare(undefined, { patch: timeout }).fetcher, () => {});
		expect(sinRespuesta.summary).toContain('sin respuesta en 20 s');
	});

	it('si fallan el PATCH y la comprobación, no dice ni «guardada» ni «no guardada»: pide relanzar', async () => {
		const cf = cloudflare(undefined, { patch: timeout, get: (n) => (n === 2 ? timeout() : undefined) });
		const result = await putVapidSecret(ENV, cf.fetcher, () => {});
		expect(result.status).toBe('error');
		expect(result.summary).toContain('no se ha podido comprobar si está');
		expect(result.summary).toContain('si ya está, lo dirá y no la tocará');
	});

	it('si el PATCH va bien pero la comprobación falla: guardada sin comprobar (aviso, no error)', async () => {
		const cf = cloudflare(undefined, { get: (n) => (n === 2 ? timeout() : undefined) });
		const result = await putVapidSecret(ENV, cf.fetcher, () => {});
		expect(result.status).toBe('sin-comprobar');
		expect(result.summary).toContain('sin comprobar');
		expect(result.summary).toContain('si dice «ya estaba», está bien');
		expect(report(result)).toMatch(/^::warning title=Clave de los avisos::/);
		// Sí está guardada.
		expect(cf.vars()![SECRET].type).toBe('secret_text');
	});

	it('si tras guardarla no aparece en el proyecto, lo dice (no la da por guardada)', async () => {
		const cf = cloudflare(undefined, { patch: () => project({}) });
		// El PATCH «va bien», pero el proyecto no cambia.
		const result = await putVapidSecret(ENV, cf.fetcher, () => {});
		expect(result.status).toBe('error');
		expect(result.summary).toContain('no sale en el proyecto');
	});

	it('sin token o sin cuenta, o desde otra rama: no llama a Cloudflare', async () => {
		for (const env of [
			{ ...ENV, CLOUDFLARE_API_TOKEN: '' },
			{ ...ENV, CLOUDFLARE_ACCOUNT_ID: undefined },
			{ ...ENV, GITHUB_REF: 'refs/heads/otra' }
		]) {
			const cf = cloudflare();
			const result = await putVapidSecret(env, cf.fetcher, () => {});
			expect(result.status).toBe('error');
			expect(cf.calls).toEqual([]);
		}
	});

	it('token sin permiso para leer el proyecto: error claro, sin crear clave', async () => {
		const logs: string[] = [];
		const fetcher = (async () =>
			Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 })) as unknown as typeof fetch;
		const result = await putVapidSecret(ENV, fetcher, (l) => logs.push(l));
		expect(result.status).toBe('error');
		expect(result.summary).toContain('403 (10000)');
		expect(result.summary).toContain('pásale este mensaje a Claude');
		expect(logs).toEqual([]);
	});

	it('fuera de Actions no escribe ::add-mask:: (en una terminal enseñaría la clave)', async () => {
		const cf = cloudflare();
		const logs: string[] = [];
		const result = await putVapidSecret({ ...ENV, GITHUB_ACTIONS: undefined }, cf.fetcher, (l) => logs.push(l));
		expect(result.status).toBe('creada');
		expect(logs).toEqual([]);
	});

	it('report: una sola línea, sin «%» suelto ni saltos', () => {
		const line = report({ status: 'error', summary: '### T\n\nUn 50% de\nlo que sea.\n' });
		expect(line).toBe('::error title=Clave de los avisos::Un 50%25 de lo que sea.');
		expect(line).not.toContain('\n');
	});

	it('reason: el error de la API tal cual; tiempo y red, en español y sin detalles', () => {
		expect(reason(new Error('/accounts/…/pages/projects/arc-terminal: 403 (10000)'))).toBe(
			'/accounts/…/pages/projects/arc-terminal: 403 (10000)'
		);
		expect(reason(new DOMException('x', 'TimeoutError'))).toBe('sin respuesta en 20 s');
		expect(reason(new TypeError('fetch failed'))).toBe('error de red');
		expect(reason(undefined)).toBe('error de red');
	});
});
