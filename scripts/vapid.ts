// Genera el par de claves VAPID de los avisos en el navegador (Web Push, cloud/push.ts) e imprime qué poner y
// dónde. Se ejecuta UNA vez, en tu ordenador: `node scripts/vapid.ts`. No escribe nada en el repo ni en disco.
// - La privada (un JWK) va como Secret de Pages VAPID_PRIVATE_KEY. Es la única que hay que guardar: lleva dentro la
//   parte pública, y /api/push se la da a la página para que el navegador se suscriba.
// - Si algún día cambias la clave, los navegadores suscritos dejan de recibir hasta que vuelvan a pulsar «Activar»
//   en AVISOS (la página lo detecta y lo pide).
import { fileURLToPath } from 'node:url';
import { generateVapid } from '../cloud/webpush.ts';

export async function vapidInstructions(): Promise<string> {
	const { jwk, public: pub } = await generateVapid();
	return [
		'Claves VAPID nuevas para los avisos en el navegador (Web Push).',
		'',
		'1. En Cloudflare: Workers & Pages → arc-terminal → Settings → Variables and Secrets (Production) → Add.',
		'   Type: Secret · Variable name: VAPID_PRIVATE_KEY · Value (todo, en una línea, con las llaves):',
		'',
		`   ${JSON.stringify(jwk)}`,
		'',
		'   (O desde la terminal: npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name arc-terminal, y pegas el valor.)',
		'',
		'2. Las Functions lo leen desde la siguiente publicación: la Action la hace sola cada 15 min (o ya mismo con',
		'   Actions → «Publicar en Pages» → Run workflow, sin «fuentes»).',
		'',
		'3. Prueba: abre AVISOS en el móvil o el ordenador → «En este dispositivo» → Activar → Probar.',
		'',
		`Clave pública (no es secreta; no hace falta ponerla en ningún sitio, /api/push la saca de la privada): ${pub}`,
		'',
		'La privada es secreta: no la pegues en el repo, en un issue ni en un chat. Este script no la guarda en ningún sitio.'
	].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await vapidInstructions());
