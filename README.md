# Norte Moda

Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio con catálogo,
checkout, seguimiento de pedidos, panel administrativo y backend Supabase preparado. Todos los
productos, precios y clientes de la demo son ficticios.

> **Estado real:** la demo local funciona completa en el navegador. El flujo remoto —cotización,
> creación de pedido, enlace privado de seguimiento, revisión manual de pagos, inventario y panel con
> Supabase Auth— está implementado y validado contra PostgreSQL embebido, pero **no está conectado a
> una instancia Supabase ni a WhatsApp real**. No procesa pagos ni envíos reales.

**Demo publicada:** <https://reinaldogocode.github.io/ProyectOne/>
La publicación se actualiza desde `main` mediante GitHub Actions. GitHub Pages solo se usa para la
demostración de portafolio, no como alojamiento de una tienda comercial.

**Repositorio:** <https://github.com/ReinaldoGoCode/ProyectOne>

**Documentación:** [DOCUMENTACION.md](DOCUMENTACION.md) · **Backend y activación:**
[docs/IMPLEMENTACION_BACKEND.md](docs/IMPLEMENTACION_BACKEND.md) · **Puesta en producción:**
[docs/DESPLIEGUE_PRODUCCION.md](docs/DESPLIEGUE_PRODUCCION.md)

---

## Qué incluye

- Catálogo con categorías, búsqueda, orden y variantes de talla y color.
- Carrito con cantidades, revalidación de stock y totales en centavos.
- Checkout de invitado en modo demo local o contra un backend Supabase cuando se configura.
- Cotización autoritativa en servidor: el navegador no fija precios, stock ni totales.
- Creación idempotente de pedidos y enlace privado de seguimiento con token de 256 bits.
- Registro de referencia de pago por parte del comprador, siempre pendiente de revisión manual.
- Panel remoto protegido con Supabase Auth: pedidos, pagos, entregas, inventario CSV, imágenes,
  métodos manuales, datos de despacho, métricas y cola de atención de WhatsApp.
- Webhook de WhatsApp Cloud API con firma HMAC, deduplicación, reintentos, estados, conversaciones y
  fallback a enlaces `wa.me`/mensaje copiable. Los envíos salientes están desactivados.
- 197 pruebas de aplicación en 22 archivos y 37 comprobaciones de base de datos con PGlite.

## Qué no incluye, ni simula

- Pagos reales, conciliación bancaria automática ni aprobación de pagos por afirmación del cliente.
- Integraciones con MRW, ZOOM ni otras agencias. El despacho se registra a mano.
- WhatsApp conectado a un número real ni envío de mensajes mientras no existan credenciales y
  autorización expresa.
- Tasa BCV automática. La tasa de 40 Bs./USD es ficticia y está marcada como tal.
- Cuentas de cliente, cupones, facturación ni datos de personas reales.

## Stack

| Pieza             | Versión | Nota                                             |
| ----------------- | ------- | ------------------------------------------------ |
| React             | 19.3    | Sin framework meta; Vite como bundler            |
| TypeScript        | 5.9     | `strict` más comprobaciones extra                |
| Vite              | 7.3     | Alias `@/` hacia `src/`                          |
| React Router      | 7.18    | Router de datos con `basename` desde Vite        |
| Tailwind CSS      | 4.3     | Plugin oficial de Vite, sin `tailwind.config.js` |
| Supabase JS       | 2.118   | Cliente público del gateway remoto               |
| Supabase CLI      | 2.121   | Dependencia de desarrollo para migraciones       |
| PGlite            | 0.5     | PostgreSQL embebido para validar SQL y RLS       |
| Vitest            | 5.0     | Pruebas de dominio, datos y UI                   |
| ESLint / Prettier | 10 / 3  | Lint tipado y formato                            |
| pnpm              | 11.28   | Gestor de paquetes                               |

TypeScript se mantiene en 5.9 porque `typescript-eslint` declara soporte hasta `<6.1.0`.

## Requisitos y puesta en marcha

- Node.js 22.12 o superior (probado con Node 24).
- pnpm 11: `corepack enable && corepack prepare pnpm@11.28.5 --activate`.

```bash
pnpm install
pnpm dev
```

La aplicación queda en <http://localhost:5173>. El puerto es fijo: si está ocupado, Vite falla en
lugar de servir una URL distinta a la documentada.

### Variables de entorno

Copia `.env.example` a un archivo local **no versionado**. El repositorio no incluye `.env.local` ni
secretos.

| Variable                        | Ámbito   | Uso                                         |
| ------------------------------- | -------- | ------------------------------------------- |
| `VITE_SUPABASE_URL`             | Público  | Activa el gateway remoto                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Público  | Clave publicable de Supabase                |
| `VITE_STORE_WHATSAPP_NUMBER`    | Público  | Número para enlaces `wa.me`; vacío = copiar |
| `SUPABASE_SERVICE_ROLE_KEY`     | Servidor | Solo Edge Functions; nunca `VITE_*`         |
| `ALLOWED_ORIGIN`                | Servidor | Origen permitido por CORS                   |
| `WHATSAPP_*`                    | Servidor | Meta, firma, cola y límites; envío apagado  |
| `WHATSAPP_AI_*`                 | Servidor | Clasificador opcional, apagado por defecto  |

Sin las dos variables `VITE_SUPABASE_*`, el checkout usa el modo demo local. Si se configuran pero
las funciones no están desplegadas, la aplicación muestra el error del servidor y no sustituye el
pedido por uno local.

## Scripts

| Comando                   | Qué hace                                      |
| ------------------------- | --------------------------------------------- |
| `pnpm dev`                | Servidor de desarrollo                        |
| `pnpm build`              | Tipos y build de producción en `dist/`        |
| `pnpm preview`            | Sirve el build de producción                  |
| `pnpm typecheck`          | Solo TypeScript                               |
| `pnpm lint`               | ESLint sin advertencias                       |
| `pnpm format:check`       | Verifica Prettier                             |
| `pnpm test`               | Vitest                                        |
| `pnpm check`              | Tipos, lint y pruebas                         |
| `pnpm test:db`            | Migraciones, seed y 37 comprobaciones SQL/RLS |
| `pnpm supabase:seed`      | Regenera `supabase/seed.sql`                  |
| `pnpm supabase:start`     | Stack local (requiere Docker)                 |
| `pnpm supabase:reset`     | Reaplica migraciones y seed en local          |
| `pnpm supabase:functions` | Sirve Edge Functions en local                 |

Antes de cada commit: `pnpm check && pnpm test:db && pnpm format:check && pnpm build`.

## Flujo de pedidos

### Modo demo local

Sin configuración Supabase, el catálogo y los pedidos se guardan en `localStorage`. La consulta solo
funciona en ese navegador. La compra directa desde una ficha usa una intención temporal en
`sessionStorage` y **no borra el carrito original**; el carrito solo se vacía al completar la compra
normal.

### Modo conectado

Con Supabase configurado:

1. `checkout-quote` recalcula precios, existencias, entrega, tasa y total en el servidor.
2. El comprador confirma el importe vigente; si cambió, debe aceptar el nuevo total.
3. `create-order` vuelve a cotizar, aplica idempotencia y crea el pedido con líneas congeladas.
4. El comprador recibe un código `NM-####` y un enlace privado con token en el fragmento `#`.
5. `lookup-order` solo devuelve el pedido con el token correcto; la base guarda su hash.
6. El comprador puede registrar una referencia de pago desde el enlace privado. Esto deja el pago en
   `review`, nunca en `paid`.
7. Un administrador autenticado revisa la referencia y decide. Al aprobar, PostgreSQL comprueba y
   descuenta stock una sola vez; si falta, registra una incidencia.
8. Preparación, despacho y entrega se registran a mano, con historial.

No hay captura de comprobantes en imagen: el flujo registra referencia y nota. Subir archivos
requeriría una función y un bucket adicionales, además de política de retención.

## Panel administrativo

`/admin` es la única interfaz administrativa. Requiere Supabase Auth y una membresía activa en
`public.admin_users`; no hay claves predeterminadas. Sin Supabase, muestra los pasos de
configuración y un enlace a `/admin?vista=demo`, una vista previa de solo lectura con datos
ficticios que no inicia sesión ni guarda cambios. El antiguo panel local sin autenticación fue
retirado.

El panel cubre pedidos, revisión manual de pagos, logística, inventario por CSV, alertas de stock
bajo, movimientos, imágenes y derivaciones de WhatsApp. Para envíos nacionales se registran a mano
la empresa, la guía y observaciones; el comprador las ve con su enlace privado. Los pagos externos
(tarjetas, PayPal, Binance Pay) aparecen como no configurados y no se pueden activar sin integración
real.

## WhatsApp

- El webhook valida el reto de Meta y la firma `X-Hub-Signature-256`.
- Los eventos se deduplican y se registran estados de entrega; los fallos se reintentan desde una
  cola.
- El asistente determinista consulta catálogo, stock, métodos de pago, pedido y entrega.
- Las consultas de pago o envío se derivan a una persona cuando falta información.
- `WHATSAPP_SEND_ENABLED=false` bloquea los envíos salientes. La web siempre ofrece copiar el
  mensaje o abrir `wa.me` si el negocio configuró su número.
- La IA opcional está apagada y limitada a clasificar intenciones; nunca redacta precios ni aprueba
  pagos.

## Backend Supabase

El repositorio contiene 12 migraciones y 16 Edge Functions. Las migraciones crean pedidos, catálogo,
cotizaciones, auditoría, inventario, Storage, métodos de pago, métricas, contexto de WhatsApp,
límites de IA y referencias públicas de pago. RLS está activo en las tablas sensibles.

La validación local con PGlite aplica todas las migraciones y el seed, y comprueba:

- catálogo, cotización y totales;
- idempotencia y rechazo de totales manipulados;
- consulta privada, token incorrecto y referencia de pago;
- aprobación manual, descuento único de stock y transiciones;
- RLS y permisos de `anon`, `authenticated` y `service_role`.

PGlite valida el SQL real, pero **no sustituye** una prueba contra Supabase Cloud, PostgREST ni el
runtime de Edge Functions. Para activar el backend:

1. Crear un proyecto Supabase Free sin tarjeta ni add-ons.
2. Enlazar el proyecto y aplicar las migraciones en orden.
3. Desplegar las funciones de `supabase/config.toml` y configurar sus secretos.
4. Crear el usuario administrador y registrar su UUID en `public.admin_users`.
5. Definir las variables públicas del frontend y probar el flujo completo en un entorno de staging.
6. Configurar Meta y mantener los envíos apagados hasta que el número y las plantillas estén
   aprobados y exista autorización expresa.

Los pasos detallados y los límites de cada servicio están en
[docs/IMPLEMENTACION_BACKEND.md](docs/IMPLEMENTACION_BACKEND.md).

## Pruebas y verificaciones

Verificado el 2026-10-22:

| Comando             | Resultado                                |
| ------------------- | ---------------------------------------- |
| `pnpm check`        | Tipos, lint y 197 pruebas en 22 archivos |
| `pnpm test:db`      | 37 comprobaciones SQL/RLS correctas      |
| `pnpm format:check` | Correcto                                 |
| `pnpm build`        | Correcto; genera `dist/`                 |

La suite cubre dinero, catálogo, carrito, producto, pedidos, inventario, métodos de pago, repositorios,
checkout, seguimiento, panel remoto, CSV, WhatsApp, webhook, cola, IA y resiliencia. No hay Playwright
ni una prueba E2E en navegador real.

## Despliegue

- `deploy.yml`: en cada push a `main` instala dependencias, verifica tipos, lint, pruebas, SQL y
  formato, construye y publica en GitHub Pages conectado al proyecto Supabase público. Solo incluye
  la URL y la clave publishable; las claves de servidor nunca se incorporan al frontend.
- `deploy-cloudflare.yml`: flujo opcional manual para publicar en Cloudflare Pages cuando existan
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y el proyecto `norte-moda`. No se ejecuta en cada
  push; la publicación principal y conectada al backend usa `deploy.yml` en GitHub Pages.
- `public/_redirects` permite el fallback SPA y `public/_headers` añade cabeceras de seguridad en
  Cloudflare Pages.

GitHub Pages se publica bajo `/ProyectOne/`; el workflow define `VITE_BASE_PATH` y copia las rutas
conocidas a archivos estáticos. Las rutas desconocidas usan `404.html`, una limitación de Pages.

**GitHub Pages no es un alojamiento válido para operar una tienda comercial.** Para producción hace
falta un hosting permitido y un backend Supabase conectado. Consultar los
[límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Seguridad y privacidad

- No se versionan `.env`, `.env.local` ni claves. `.env.example` solo contiene nombres.
- La clave `service_role` nunca se expone en variables `VITE_*`.
- Los pedidos remotos no se pueden crear saltando la Edge Function; RLS bloquea el acceso directo.
- El token de seguimiento se guarda como hash; la referencia de pago no aprueba el pedido.
- Los métodos de pago empiezan desactivados y requieren instrucciones públicas confirmadas.
- Los errores del servidor no revelan datos internos.
- No se envían mensajes, correos ni transacciones reales desde este repositorio.

## Limitaciones y bloqueos actuales

1. **Supabase Cloud:** no hay proyecto enlazado ni credenciales; las migraciones no se aplicaron en
   la nube y las Edge Functions no se desplegaron.
2. **WhatsApp real:** faltan app, WABA, número verificado, tokens y autorización. No se ha probado
   contra Meta.
3. **Docker local:** Docker Desktop falla con errores de E/S y poco espacio; el stack Supabase
   completo no se ejecutó. La validación SQL se hizo con PGlite.
4. **Pagos y envíos:** son manuales. No hay pasarela, conciliación bancaria ni integración con
   agencias.
5. **Cloudflare:** el workflow está preparado, pero no hay cuenta, token ni ejecución.
6. **E2E:** no hay Playwright ni auditoría completa con lector de pantalla.
7. **Imágenes de producto:** la carga remota requiere Supabase Storage activo y probado.

## Estructura

```text
norte-moda/
├─ .github/workflows/        # Pages y Cloudflare Pages
├─ docs/                     # alcance, decisiones y backend
├─ public/                   # favicon, imágenes y _redirects
├─ scripts/                  # seed y verificación SQL
├─ src/
│  ├─ app/                   # router, layout y providers
│  ├─ components/            # UI reutilizable
│  ├─ data/                  # seed, esquemas y repositorios
│  ├─ domain/                # reglas puras de negocio
│  ├─ features/              # catálogo, carrito, checkout, pedidos, admin
│  ├─ hooks/
│  └─ lib/                   # Supabase, WhatsApp, rutas y colores
├─ supabase/
│  ├─ functions/             # 16 Edge Functions
│  ├─ migrations/            # 12 migraciones SQL
│  ├─ config.toml
│  └─ seed.sql
└─ package.json
```

Las reglas de negocio viven en `src/domain/` y no importan React ni Supabase. El acceso a datos se
aísla en `src/data/repositories/`; las pantallas no llaman directamente a `localStorage` ni a las
funciones Edge.

## Convenciones

- Commits convencionales en español: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`.
- Dinero en centavos enteros; nunca decimales flotantes.
- `strict` activo, sin `any` explícito ni `@ts-ignore` sin justificar.
- Cada regla de dominio nueva llega con su prueba.
- Interfaz en español; API técnica en inglés.

## Licencia

Proyecto de portafolio, sin fines comerciales. Todos los datos son ficticios.
