# Admin, sugerencias y «Tu mañana»: pasos para Sergi

Todo esto se pone en **Cloudflare → Workers & Pages → arc-terminal → Settings → Variables and Secrets**
(entorno *Production*), como **Secret** (tipo «Secret», no «Text»). Ninguno va en el repo. Tras añadirlos, la
siguiente publicación de la Action (o «Retry deployment») ya los usa.

## 1. Administrador y sugerencias (imprescindible)
| Secret | Valor |
|---|---|
| `ADMIN_EMAIL` | Tu email, el mismo con el que entras en arcterminal.dev. |
| `NTFY_TOPIC` | El mismo tema de ntfy que tienes en GitHub (Secret `NTFY_TOPIC`). Sin él, las sugerencias se guardan pero no te avisan. |

Comprobación: abre `ADMIN` en la barra. Con tu cuenta ves la lista; con otra, «Solo para el administrador».

## 2. Invitar y quitar desde /admin (opcional)
1. Cloudflare → *My Profile* → *API Tokens* → *Create Token* → *Custom token*.
2. Nombre: «Arc admin Access». Permisos: **Account · Access: Apps and Policies · Edit**. (Para cerrar la sesión de
   quien quites, añade también **Account · Access: Organizations, Identity Providers, and Groups · Edit**; si no,
   su sesión caduca sola.) *Account Resources*: solo tu cuenta. Crear y copiar el token.
3. Secrets de Pages: `CF_ACCESS_ADMIN_TOKEN` = ese token; `CF_ACCOUNT_ID` = el id de tu cuenta (lo ves en la
   portada de Cloudflare, a la derecha, «Account ID»; es el mismo que el Secret `CLOUDFLARE_ACCOUNT_ID` de GitHub).
4. La política de Access donde están los emails tiene que llamarse **«Sergi»**. Si se llama distinto, añade el
   Secret `ACCESS_POLICY` con su nombre (como Secret: con `wrangler.toml`, las variables «Text» del panel no cuentan).

Comprobación: en ADMIN, el panel «Invitar» dice «Access listo».

## 3. «Tu mañana» por email (opcional; sin esto llega solo al móvil)
1. Cuenta gratuita en https://www.brevo.com (300 emails al día).
2. *Senders, Domains & Dedicated IPs* → verifica el remitente (p. ej. `avisos@arcterminal.dev`, o tu propio email).
   Con un dominio propio, autentica el dominio (DKIM) para que no acabe en spam.
3. *SMTP & API* → *API Keys* → *Generate a new API key*.
4. Secrets de Pages: `BREVO_API_KEY` = la clave; `BREVO_SENDER` = el remitente verificado.

Cada usuario lo activa en `AVISOS` → «Tu mañana» (hora y «También por email»). El email sale de Cloudflare a la
dirección de su cuenta: la Action nunca la ve.
