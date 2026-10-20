// Los errores que ven los usuarios en su navegador, camino de /admin (F29). Solo funciones puras, sin DOM: las usa
// src/hooks.client.ts para preparar el informe antes de mandarlo y cloud/errors.ts para volver a limpiarlo y
// calcular su firma (el servidor nunca se fía de lo que llega). Nada de datos personales: ni email ni ajustes, las
// URL y rutas sin la consulta (?…) ni el #, y el mensaje y la pila recortados.

export const REPORT_LIMITS = {
	/** Caracteres del mensaje. */
	message: 300,
	/** Líneas y caracteres de la pila. */
	stackLines: 8,
	stack: 1500,
	/** Caracteres de la ruta. */
	path: 120,
	/** Informes por carga de la web, uno por firma: un error en bucle no manda más. */
	perLoad: 5
};

/** Lo que manda el navegador, ya limpio. */
export interface ErrorReport {
	/** «TypeError: x is not a function». */
	msg: string;
	/** Los primeros marcos de la pila. */
	stack: string;
	/** La ruta, sin consulta ni #. */
	path: string;
	/** La versión de la web publicada ($app/env). */
	ver: string;
	/** Estética (data-style) y modo (data-modo). */
	style: string;
	modo: string;
	/** Dentro de otra página: una ventana de Arc OS. */
	embed: boolean;
}

/** Una URL con esquema («https://…», «chrome-extension://…»), con su «:línea:columna» si la lleva. */
const URL_RE = /\b[a-z][\w+.-]*:\/\/[^\s()'"<>]+/gi;
/** El origen de una URL («https://arcterminal.dev»). */
const ORIGIN_RE = /\b[a-z][\w+.-]*:\/\/[^/\s()'"<>]+/gi;
/** Una ruta suelta con consulta o # («/s?q=…»), también entre comillas o tras «=», «:» o «,». */
const PATH_QUERY_RE = /(^|[\s('"`=:,])(\/[^\s?#()'"<>]*)[?#][^\s()'"<>]*/g;
/** Un email suelto (algo que el usuario haya escrito). Los marcos «función@https://…» no casan. */
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Quita la consulta y el # de cada URL o ruta (pueden llevar lo que se escribe en la barra) y tapa los emails. */
export function scrub(text: string): string {
	return text
		.replace(URL_RE, (url) => {
			const [, head, tail = ''] = /^(.*?)((?::\d+){1,2})?$/.exec(url)!;
			return head.replace(/[?#].*$/, '') + tail;
		})
		.replace(PATH_QUERY_RE, '$1$2')
		.replace(EMAIL_RE, '[email]');
}

/** Un marco de pila: «at f (url:1:2)» (Chrome), «f@url:1:2» (Firefox y Safari) o una URL suelta. */
const isFrame = (line: string) => /^at\s|@|:\/\//.test(line);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** Una palabra corta (versión, estética, modo); si no lo es, nada. */
const word = (v: unknown, max = 30) => {
	const s = str(v);
	return s.length <= max && /^[\w.-]*$/.test(s) ? s : '';
};

/**
 * Limpia un informe: recorta, quita consultas y emails, y descarta lo que no tenga la forma esperada. La usan el
 * navegador y el servidor (lo que llega se vuelve a limpiar): aplicarla dos veces da lo mismo.
 */
export function clean(input: Record<string, unknown>): ErrorReport {
	const head = str(input.msg);
	const msg = scrub(head).replace(/\s+/g, ' ').trim().slice(0, REPORT_LIMITS.message) || 'Error';
	// Chrome empieza la pila repitiendo «Tipo: mensaje»: fuera, para que el primer marco sea el de verdad.
	const raw = str(input.stack);
	const stack = scrub(head && raw.startsWith(head) ? raw.slice(head.length) : raw)
		.split('\n')
		.map((l) => l.trim())
		.filter(isFrame)
		.slice(0, REPORT_LIMITS.stackLines)
		.join('\n')
		.slice(0, REPORT_LIMITS.stack);
	const path = str(input.path).replace(/[?#].*$/, '');
	return {
		msg,
		stack,
		path: /^\/[\w\-/.~%]*$/.test(path) ? path.slice(0, REPORT_LIMITS.path) : '/',
		ver: word(input.ver, 40),
		style: word(input.style),
		modo: word(input.modo),
		embed: input.embed === true
	};
}

/** El mensaje, la pila y el nombre de cualquier cosa que se lance (un Error, un texto, un objeto…). */
export function describe(err: unknown, fallback = ''): { msg: string; stack: string; name: string } {
	if (typeof err === 'string') return { msg: err, stack: '', name: '' };
	if (err && typeof err === 'object') {
		const { name, message, stack } = err as Record<string, unknown>;
		// Un Error, o algo con su forma (los de otra ventana no son instanceof Error de esta).
		if (typeof message === 'string' || typeof stack === 'string') {
			const n = str(name) || 'Error';
			return { msg: str(message) ? `${n}: ${str(message)}` : n, stack: str(stack), name: str(name) };
		}
	}
	// Cualquier otra cosa no se pasa a texto ni a JSON: podría llevar datos de la persona.
	return { msg: fallback || (err == null ? 'Error' : Object.prototype.toString.call(err)), stack: '', name: '' };
}

/**
 * Ruido que no se manda: «Script error.» sin pila (scripts de otro dominio, como TradingView: el navegador no
 * deja ver más), el aviso «ResizeObserver loop» (inofensivo), las peticiones cortadas a propósito (AbortError)
 * y lo que viene de extensiones del navegador.
 */
export function skip(msg: string, stack: string, name = ''): boolean {
	if (!stack && /^(?:Uncaught\s+)?(?:Script error\.?)?$/i.test(msg.trim())) return true;
	if (/ResizeObserver loop/i.test(msg)) return true;
	if (name === 'AbortError' || /^AbortError\b/.test(msg)) return true;
	return /\b(?:chrome|moz|safari(?:-web)?|ms-browser)-extension:\/\//i.test(`${msg}\n${stack}`);
}

/**
 * Lo que identifica un error entre publicaciones: sin el origen y sin el hash de los archivos de la build
 * («nodes/10.DwOWLKJQ.js» → «nodes/10.js»; «chunks/0k0SEiuy.js» → «chunks/*.js»).
 */
export function shape(text: string): string {
	return text
		.replace(ORIGIN_RE, '')
		.replace(
			/(_app\/immutable\/[a-z]+\/)(?:([A-Za-z0-9_]+)\.)?[\w-]+\.(js|css)/g,
			(_, dir: string, name: string | undefined, ext: string) => `${dir}${name ?? '*'}.${ext}`
		)
		.trim();
}

/** El archivo del primer marco, con shape() y sin línea ni columna (ni la función: en la build su nombre cambia). */
function firstFile(stack: string): string {
	const line = stack.split('\n')[0] ?? '';
	const url = new RegExp(URL_RE.source, 'i').exec(line);
	return shape(url ? url[0] : line).replace(/(?::\d+){1,2}(?=\)?$)/, '');
}

/**
 * La firma de un error: el mensaje y el archivo del primer marco, sin lo que cambia en cada publicación. Ocho
 * cifras hexadecimales (FNV-1a de 32 bits): el mismo error da la misma firma en cualquier navegador y build.
 */
export function signature(msg: string, stack: string): string {
	const key = `${shape(msg)}|${firstFile(stack)}`;
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
	return (h >>> 0).toString(16).padStart(8, '0');
}

/** ¿Se informa desde aquí? Solo en la web publicada: ni en `pnpm dev` ni en localhost (preview, smoke y e2e). */
export const canReport = (dev: boolean, hostname: string) =>
	!dev && !/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(hostname) && !hostname.endsWith('.localhost');

/**
 * Un informador con tope: como mucho `max` informes por carga y uno por firma. Devuelve si lo ha mandado.
 * `send` es quien lo manda de verdad (en el navegador, un fetch).
 */
export function reporter(send: (r: ErrorReport) => void, max = REPORT_LIMITS.perLoad) {
	const seen = new Set<string>();
	return (r: ErrorReport): boolean => {
		const sig = signature(r.msg, r.stack);
		if (seen.size >= max || seen.has(sig)) return false;
		seen.add(sig);
		send(r);
		return true;
	};
}
