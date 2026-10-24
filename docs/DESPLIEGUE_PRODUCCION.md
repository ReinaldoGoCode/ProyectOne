# Norte Moda · puesta en producción

Este documento es el runbook para completar lo que no puede hacerse sin cuentas y credenciales.
**No contiene secretos y no afirma que estos pasos ya se hayan ejecutado.** El estado comprobado está
en `README.md` y `docs/IMPLEMENTACION_BACKEND.md`.

## 0. Estado de partida

- Frontend público: <https://reinaldogocode.github.io/ProyectOne/>
- Panel administrativo: <https://reinaldogocode.github.io/ProyectOne/admin>
- Repositorio: <https://github.com/ReinaldoGoCode/ProyectOne>
- Supabase Cloud: proyecto `ctnpisuizfhxcuxrjhah`; 12 migraciones aplicadas y 16 Edge Functions activas.
- GitHub Pages: publicación automática desde `main`; Vite usa `/ProyectOne/` como ruta base.
- Cloudflare Pages: no forma parte del flujo automático actual.
- Base de datos: 6 categorías y 50 productos ficticios `DEMO`, con 50 variantes en stock cero; 0 pedidos.
- Métodos de pago: ninguno habilitado; WhatsApp y la IA permanecen apagados.
- WhatsApp: enlace público `wa.me` y número para el contexto seguro configurados; faltan app/WABA/tokens para la API automática de Meta.
- IA: **apagada**; no hay clave ni autorización para consumir créditos.

GitHub Pages sirve el frontend estático y Supabase el backend. La tienda no puede aceptar pedidos
hasta cargar el catálogo real y activar métodos manuales con instrucciones confirmadas. Mantén esta
publicación como demostración; antes de una operación comercial, confirma un alojamiento compatible
con comercio electrónico y los costes aplicables.

## 1. Supabase Cloud

### 1.1 Iniciar sesión y crear el proyecto

En una terminal, desde la raíz del repositorio:

```powershell
corepack pnpm exec supabase login
corepack pnpm exec supabase orgs list
```

Crea un proyecto **Free**, sin tarjeta ni add-ons, en la región más cercana. Desde el panel o con:

```powershell
corepack pnpm exec supabase projects create norte-moda `
  --org-id <ORG_ID> `
  --db-password "<CONTRASEÑA_LARGA_Y_ÚNICA>" `
  --region us-east-1
```

Guarda la contraseña de la base en un gestor de contraseñas. No la escribas en el repositorio.

### 1.2 Enlazar y aplicar migraciones

```powershell
corepack pnpm exec supabase projects list
corepack pnpm exec supabase link --project-ref <PROJECT_REF>
corepack pnpm exec supabase db push --project-ref <PROJECT_REF> --dry-run
corepack pnpm exec supabase db push --project-ref <PROJECT_REF> --include-all
```

La ejecución debe aplicar las **12 migraciones**. No uses `--include-seed` en producción: el seed es
catálogo ficticio. Para una base de staging/demostración puedes usar el SQL Editor con
`supabase/seed.sql`, nunca sobre datos reales.

### 1.3 Desplegar las Edge Functions

Docker local no funciona en este equipo, así que usa el empaquetado del lado de Supabase:

```powershell
corepack pnpm exec supabase functions deploy --project-ref <PROJECT_REF> --use-api
```

Deben desplegarse **16 funciones**. Comprueba que `whatsapp-webhook`, `create-order` y
`lookup-order` queden sin JWT (según `supabase/config.toml`) y que las administrativas mantengan
JWT activo.

### 1.4 Configurar secretos del servidor

Copia `.env.example` a `.env.production` (ignorado por Git) y completa solo los secretos del
servidor. No pongas secretos en variables `VITE_*`.

```powershell
corepack pnpm exec supabase secrets set `
  --project-ref <PROJECT_REF> `
  --env-file .env.production
```

Mínimos para arrancar:

- `SUPABASE_URL`: URL del proyecto, por ejemplo `https://<ref>.supabase.co`.
- `SUPABASE_ANON_KEY`: clave publicable/anon.
- `SUPABASE_SERVICE_ROLE_KEY`: clave secreta de servicio. **Solo backend.**
- `ALLOWED_ORIGIN`: origen exacto `https://reinaldogocode.github.io` (sin `/ProyectOne/`).
- `PUBLIC_SITE_URL`: URL pública completa `https://reinaldogocode.github.io/ProyectOne/`.
- `WHATSAPP_SEND_ENABLED=false` hasta la prueba controlada.

Puedes consultar las claves con:

```powershell
corepack pnpm exec supabase projects api-keys --project-ref <PROJECT_REF>
```

No ejecutes `--reveal` delante de otras personas ni copies las claves en el repositorio.

### 1.5 Crear el administrador

1. En Supabase Dashboard → Authentication → Users, crea el usuario del dueño con correo y contraseña.
2. Copia su UUID.
3. En SQL Editor ejecuta:

```sql
insert into public.admin_users (user_id, active)
values ('<UUID_DEL_USUARIO>', true)
on conflict (user_id) do update set active = true;
```

La tabla permite **un solo administrador activo**. El panel `/admin` no tiene credenciales
predeterminadas.

### 1.6 Probar sin WhatsApp

Antes de activar mensajes:

1. Configura las variables públicas en el build (sección 2.3).
2. Abre `/admin`, inicia sesión y comprueba que carga pedidos.
3. Crea un pedido desde el checkout con una cuenta de prueba.
4. Consulta el pedido con su enlace privado.
5. Registra una referencia de pago y verifica que queda en `review`, no en `paid`.
6. Desde el panel, aprueba o rechaza el pago y registra empresa, guía y observaciones de envío.
7. Confirma que el comprador ve el nuevo estado y los datos de despacho.
8. No uses datos personales reales para estas pruebas.

## 2. Cloudflare Pages

### 2.1 Autenticar Wrangler

```powershell
corepack pnpm dlx wrangler login
corepack pnpm dlx wrangler whoami
```

Si el navegador no puede abrir el callback local, usa:

```powershell
corepack pnpm dlx wrangler login --device
```

### 2.2 Crear el proyecto

En Cloudflare Dashboard → Workers & Pages → Create → Pages, crea un proyecto llamado `norte-moda`
con rama de producción `main`. También puedes usar:

```powershell
corepack pnpm dlx wrangler pages project create norte-moda --production-branch main
```

El workflow `.github/workflows/deploy-cloudflare.yml` publica `dist/` con
`wrangler pages deploy dist --project-name=norte-moda`.

### 2.3 Configurar GitHub

En GitHub → Settings → Secrets and variables → Actions:

**Secrets** (nunca se muestran en logs):

- `CLOUDFLARE_API_TOKEN`: token con permiso de cuenta **Cloudflare Pages: Edit**.
- `CLOUDFLARE_ACCOUNT_ID`: ID de la cuenta de Cloudflare.

**Variables** (públicas, se incorporan al bundle):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (clave publicable/anon, nunca service role)
- `VITE_STORE_WHATSAPP_NUMBER` (opcional; dígitos internacionales sin `+`)

El workflow de Cloudflare es opcional y manual. Si faltan los dos secretos, la comprobación previa
termina correctamente y el job de publicación se omite; no afecta la publicación principal de GitHub
Pages. Deben ser secretos del repositorio: el trabajo de comprobación no tiene asociado el entorno
`cloudflare-pages`, así que no ve secretos definidos solo para ese entorno.

El build de GitHub Pages publica la tienda conectada a Supabase: `.github/workflows/deploy.yml` fija la
base `/ProyectOne/` e incorpora solamente la URL y la clave publishable públicas. Las claves de servidor
no se añaden al frontend. El número de WhatsApp queda vacío hasta configurar el canal comercial.

### 2.4 Verificar y añadir dominio

1. Abre la URL `https://<proyecto>.pages.dev` que muestre Cloudflare.
2. Comprueba inicio, catálogo, producto, carrito, checkout, seguimiento y `/admin`.
3. Recarga rutas profundas: `public/_redirects` debe devolver la SPA.
4. Revisa que `public/_headers` se aplique (cabeceras de seguridad).
5. Añade el dominio propio en Cloudflare Pages → Custom domains y actualiza `ALLOWED_ORIGIN` y
   `PUBLIC_SITE_URL` en Supabase.
6. Vuelve a desplegar el frontend para que el bundle use el dominio definitivo.

No se puede marcar Cloudflare como desplegado hasta que la URL `pages.dev` o el dominio respondan.

## 3. WhatsApp Cloud API

No envíes mensajes reales hasta completar esta sección y hacer una prueba controlada.

1. Crea una app en Meta for Developers y añade el producto WhatsApp.
2. Crea/verifica una WABA y un número. Para pruebas puede usarse el número de prueba de Meta.
3. Configura el webhook:
   - Callback URL: `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: el mismo valor aleatorio de `WHATSAPP_VERIFY_TOKEN`.
   - Suscríbete al campo `messages`.
4. Añade los secretos del servidor:
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_PHONE` (dígitos, sin `+`)
   - `WHATSAPP_GRAPH_API_VERSION` (la versión vigente que indique Meta)
   - `WHATSAPP_PHONE_HASH_SECRET` y `WHATSAPP_DISPATCH_SECRET` (32+ caracteres aleatorios)
5. Mantén `WHATSAPP_SEND_ENABLED=false` y `WHATSAPP_ORDER_TEMPLATE_APPROVED=false` hasta validar
   recepción, firma, idempotencia, cola, estados y fallback.
6. Para la prueba controlada, autoriza un número propio, activa el envío solo durante la prueba y
   vuelve a apagarlo. No uses números de clientes ni campañas.
7. Las plantillas de seguimiento solo se activan después de que Meta apruebe el nombre, idioma y
   categoría exactos. No se debe enviar marketing ni mensajes fuera de la ventana permitida sin
   revisar costes.

Si el webhook no está configurado, la web sigue ofreciendo el enlace `wa.me` y el mensaje copiable.

## 4. Asistente con IA (opcional)

La IA está apagada por defecto. Para evaluarla sin coste:

1. Crea una cuenta Groq y mantente en el plan **Free**, sin método de pago ni upgrade.
2. En Data Controls, activa retención cero si está disponible.
3. Confirma los límites vigentes en el panel de Groq.
4. Configura como secretos:
   - `WHATSAPP_AI_ENABLED=true`
   - `WHATSAPP_AI_FREE_TIER_CONFIRMED=true`
   - `WHATSAPP_AI_PRIVACY_CONTROLS_CONFIRMED=true`
   - `WHATSAPP_AI_PROVIDER=groq`
   - `WHATSAPP_AI_MODEL=openai/gpt-oss-20b`
   - `WHATSAPP_AI_API_KEY`
   - límites `WHATSAPP_AI_MAX_*` (8/min, 100/día, 128 tokens, 400 caracteres por defecto)
5. Prueba solo consultas generales de catálogo/tallas. Las consultas de pedidos, pagos, envíos y datos
   personales usan la lógica determinista del backend y no se envían al proveedor.

Si la cuota, la clave o el proveedor fallan, el asistente debe seguir funcionando sin IA o derivar a
una persona. No se debe habilitar un plan de pago ni un proveedor de respaldo sin autorización.

## 5. Checklist de aceptación

- [ ] `pnpm check`, `pnpm test:db`, `pnpm format:check` y `pnpm build` pasan en el commit desplegado.
- [ ] Las 12 migraciones están aplicadas en Supabase Cloud.
- [ ] Las 16 Edge Functions están desplegadas.
- [ ] RLS impide que `anon` lea pedidos y que un cliente apruebe pagos.
- [ ] Existe un solo administrador activo y `/admin` exige Supabase Auth.
- [ ] Un pedido de prueba se crea en PostgreSQL, se consulta con su token y aparece en el panel.
- [ ] Una referencia de pago queda en revisión y solo un administrador la aprueba.
- [ ] Empresa, guía y observaciones de envío se guardan y el comprador las ve.
- [ ] La URL de Cloudflare Pages responde y las rutas profundas recargan correctamente.
- [ ] El workflow de Cloudflare publica, no se omite por falta de secretos.
- [ ] WhatsApp recibe un evento firmado, lo deduplica y registra la cola sin enviar mensajes no
      autorizados.
- [ ] No hay secretos en el repositorio ni en el bundle; `VITE_*` solo contiene valores públicos.
- [ ] Se revisaron privacidad, retención de datos y costes antes de operar comercialmente.

## 6. Qué no debe hacerse todavía

- No usar GitHub Pages para la tienda comercial.
- No poner `SUPABASE_SERVICE_ROLE_KEY`, tokens de Meta o claves de IA en variables `VITE_*`.
- No aprobar un pago solo porque el cliente envió una referencia o una imagen.
- No presentar MRW/Zoom como integración oficial: la empresa y la guía se registran a mano.
- No activar `WHATSAPP_SEND_ENABLED=true` ni plantillas facturables sin autorización.
- No contratar planes, add-ons ni créditos de IA automáticamente.
- No cargar datos personales reales en pruebas.
