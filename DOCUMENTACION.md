# Norte Moda — Documentación completa

> Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio con datos
> ficticios. El repositorio contiene configuración de despliegue para GitHub Pages.
>
> **Última actualización:** 2026-10-22 · **Versión de la aplicación:** 0.5.0 · **Repositorio Git:** reconstruido desde `origin/main`.
>
> **Versión publicada solo como demo:** <https://reinaldogocode.github.io/ProyectOne/>. GitHub Pages no está permitido como alojamiento gratuito para una tienda comercial; no usarla con transacciones ni datos reales. Consultar [límites de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). El workflow publica el frontend estático en ese entorno.
>
> **Repositorio:** <https://github.com/ReinaldoGoCode/ProyectOne>
>
> **Estado de backend:** el código de Supabase está preparado y validado contra PostgreSQL embebido, pero no desplegado ni conectado a una instancia real. Consulta [IMPLEMENTACION_BACKEND.md](docs/IMPLEMENTACION_BACKEND.md) para el alcance real y los requisitos pendientes.

---

## 1. Resumen ejecutivo

Norte Moda es una tienda conceptual para mostrar un flujo comercial completo: catálogo, selección de
variantes, carrito, checkout, creación y consulta de pedidos, revisión manual de pagos y panel
administrativo. Los datos son ficticios; pago y entrega se actualizan a mano.

La implementación actual incluye:

- Base técnica con React 19, TypeScript estricto, Vite 7 y Tailwind 4.
- Modelo de dominio con dinero en centavos y estados separados de pedido, pago y entrega.
- Catálogo ficticio de 6 categorías, 21 prendas y 171 variantes.
- Portada editorial, catálogo con filtros/búsqueda/orden y página 404.
- Ficha de producto con selector de talla y color, stock y combinaciones agotadas deshabilitadas.
- Persistencia local tipada para catálogo, carrito y pedidos, con recuperación ante datos dañados.
- Checkout de invitado, compra directa sin borrar el carrito y consulta de pedidos.
- Gateway Supabase con cotización autoritativa, idempotencia, seguimiento privado y referencia de pago.
- Panel remoto protegido con Supabase Auth para pedidos, inventario CSV, pagos, entregas y WhatsApp.
- 12 migraciones, 16 Edge Functions, RLS y semilla de catálogo preparados sin proyecto enlazado.
- Suite de 197 pruebas de aplicación y 37 comprobaciones SQL/RLS con PGlite.

Todavía no hay backend compartido activo, pagos ni envíos reales. El flujo remoto no se ha probado
contra Supabase Cloud ni Meta. Los pedidos locales no se comparten entre dispositivos. El checkout
muestra una conversión ficticia de prueba; no consulta la tasa BCV.

---

## 2. Problema y usuarios

Un comercio pequeño de ropa en Venezuela vende por Instagram y WhatsApp. El catálogo vive en
publicaciones, el stock en la cabeza del dueño y el pedido en un chat. Eso produce ventas de tallas
agotadas, totales calculados a mano, pedidos perdidos entre conversaciones y compradores
preguntando varias veces por su compra.

| Usuario       | Contexto                                                 | Necesita                                                                             |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Comprador     | Móvil, datos limitados, llega desde un enlace            | Saber si su talla y color existen, ver el total exacto, dejar el pedido una sola vez |
| Administrador | Dueño o encargado, móvil o laptop, sin formación técnica | Cargar productos y stock rápido, ver pedidos, marcar pagado y despachado             |
| Visitante     | Solo curiosea                                            | Entender la tienda en segundos                                                       |
| Desarrollador | Portafolio                                               | Código que demuestre criterio, no solo pantallas                                     |

La propuesta no reemplaza el trato humano: lo ordena. El pago se verifica a mano y el envío se
coordina por conversación; el sistema registra estados y evita vender stock inexistente.

---

## 3. Alcance

### Implementado

- Catálogo con categorías, búsqueda y orden.
- Ficha de producto con variantes de talla y color y stock por combinación.
- Enlaces compartibles al catálogo y a cada producto.
- Consulta de una prenda por WhatsApp y copia del mensaje.
- Carrito persistido por variante, cantidades, revalidación de stock y resumen monetario.
- Checkout invitado con validación, métodos de entrega y pago previstos, sin cédula ni correo.
- Compra directa aislada que conserva el carrito existente hasta completar la compra normal.
- Creación de pedidos con código, precios y descripciones congelados y confirmación local o remota.
- Consulta de pedido por código; en modo remoto, enlace privado con token y referencia de pago.
- Panel remoto con autenticación, autorización en servidor, pedidos, inventario CSV, imágenes,
  métodos manuales, métricas y derivaciones de WhatsApp.
- Persistencia local con validación de datos y opción para restaurar la demo.
- Página 404 y navegación completa entre portada, catálogo y ficha.
- Datos ficticios centralizados y pruebas de integridad del seed.
- Migraciones, funciones Edge, gateway y semilla preparados; SQL validado con PostgreSQL embebido.
- Workflows para verificar, construir y desplegar en Pages o Cloudflare Pages.

### Pendiente para producción

- Crear un proyecto Supabase, aplicar las migraciones y desplegar/validar las Edge Functions.
- Crear la cuenta administradora y probar autenticación, autorización y recuperación.
- Configurar alojamiento apropiado para el comercio y definir respaldo y retención de datos.
- Elegir proveedor de tasa BCV, pasarela de pagos y logística; hoy son manuales.
- Probar WhatsApp contra Meta con un número de prueba y autorización expresa.
- Storage de imágenes y proceso de privacidad para datos de clientes.
- E2E con Playwright y auditoría completa de accesibilidad con tecnologías de asistencia.

### Fuera de alcance

Pagos reales, confirmación bancaria automática, integraciones con MRW o ZOOM, envío automático de
WhatsApp sin credenciales, cuentas de cliente, cupones y tasas de cambio automáticas.

---

## 4. Stack y versiones

| Pieza        | Versión | Rol                                        |
| ------------ | ------- | ------------------------------------------ |
| React        | 19.3.1  | Interfaz                                   |
| React DOM    | 19.3.1  | Render                                     |
| React Router | 7.18.4  | Rutas, `basename` y restauración de scroll |
| TypeScript   | 5.9.3   | Tipado estricto                            |
| Vite         | 7.3.7   | Desarrollo, build y rutas estáticas        |
| Tailwind CSS | 4.3.3   | Utilidades y tokens en CSS                 |
| Vitest       | 5.0.5   | Pruebas de dominio y render                |
| ESLint       | 10.13.0 | Lint con información de tipos              |
| Prettier     | 3.9.10  | Formato                                    |
| pnpm         | 11.28.5 | Gestor de paquetes                         |
| Node.js      | ≥ 22.12 | Entorno (probado con Node 24)              |

Decisiones de compatibilidad relevantes:

- **TypeScript fijado en 5.9** porque `typescript-eslint` 8.71 declara soporte `< 6.1.0`. TypeScript
  7 desactivaría el lint con tipos.
- **Tailwind 4 sin `tailwind.config.js`**: el tema vive en `src/styles/index.css` con `@theme`.
- **React Router 7** con router de datos (`createBrowserRouter`) y `basename` derivado de
  `import.meta.env.BASE_URL`.

---

## 5. Arquitectura

### 5.1 Estructura

```text
norte-moda/
├─ .github/workflows/               # Pages y Cloudflare Pages
├─ docs/
│  ├─ 01-alcance.md                 # problema, requisitos, flujos y criterios
│  ├─ 03-decisiones.md              # registro de decisiones técnicas
│  └─ IMPLEMENTACION_BACKEND.md     # alcance real y activación pendiente
├─ DOCUMENTACION.md                 # este documento
├─ public/
│  ├─ favicon.svg
│  ├─ _headers                       # cabeceras de seguridad para Cloudflare
│  ├─ _redirects                    # fallback SPA en Cloudflare
│  └─ images/products/placeholder.svg
├─ scripts/
│  ├─ export-supabase-seed.mjs
│  └─ verify-database.mjs           # migraciones y 37 comprobaciones SQL/RLS
├─ src/
│  ├─ app/                          # router, layout y providers
│  ├─ components/                   # layout y UI reutilizable
│  ├─ data/
│  │  ├─ seed/                      # categorías, productos, variantes
│  │  └─ repositories/              # localStorage, gateway y admin remoto
│  ├─ domain/                       # tipos, dinero, stock, pedidos e inventario
│  ├─ features/
│  │  ├─ home/
│  │  ├─ catalog/
│  │  ├─ product/
│  │  ├─ not-found/
│  │  ├─ cart/
│  │  ├─ checkout/                  # modo local, remoto y compra directa
│  │  ├─ order-tracking/            # consulta local o con enlace privado
│  │  └─ admin/remote/              # panel autenticado
│  ├─ hooks/
│  ├─ lib/                          # Supabase, WhatsApp, rutas y colores
│  ├─ styles/index.css
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ supabase/
│  ├─ functions/                    # 16 Edge Functions
│  ├─ migrations/                   # 12 migraciones
│  ├─ config.toml
│  └─ seed.sql
├─ eslint.config.js
├─ index.html
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ vite.config.ts
```

### 5.2 Capas y reglas

| Capa                 | Responsabilidad                                      | Regla                                             |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `domain/`            | Tipos, dinero, stock, filtros y transiciones         | No importa React ni Supabase                      |
| `data/seed/`         | Catálogo ficticio y expansión de variantes           | Datos puros, sin lógica de UI                     |
| `data/repositories/` | Repositorios locales y gateway remoto preparado      | Validar datos; no activar remoto sin configurarlo |
| `features/`          | Capacidades de negocio (catálogo, ficha, carrito...) | Componentes y páginas por dominio                 |
| `components/ui/`     | Presentación reutilizable                            | Sin reglas de negocio                             |
| `lib/`               | Utilidades sin estado                                | WhatsApp, colores, rutas base                     |
| `app/`               | Router, layout y composición                         | Punto de entrada de las páginas                   |

Reglas transversales:

- Dinero siempre en centavos enteros; formatear solo al mostrar.
- El carrito guarda `variantId` y cantidad, no precios; el pedido congela los datos del catálogo.
- Pedido, pago y entrega tienen estados independientes; preparar exige pago aprobado y stock.
- La lógica nueva de dominio se prueba antes de conectarla a la UI.
- Sin `any` explícito y sin `@ts-ignore` sin justificar.

### 5.3 Rutas

| Ruta                     | Contenido                                         | Estado                       |
| ------------------------ | ------------------------------------------------- | ---------------------------- |
| `/`                      | Portada editorial con selección, relato y proceso | Implementada                 |
| `/catalogo`              | Catálogo con filtros, búsqueda y orden            | Implementada                 |
| `/producto/:slug`        | Ficha de producto y variantes                     | Implementada                 |
| `/carrito`               | Cantidades, subtotal y disponibilidad             | Implementada                 |
| `/checkout`              | Compra invitada: modo local o remoto              | Implementada                 |
| `/pedido?codigo=NM-0001` | Consulta local o remota con enlace privado        | Implementada                 |
| `/admin`                 | Acceso autenticado a la administración remota     | Requiere configurar Supabase |
| `/admin?vista=demo`      | Vista previa de solo lectura con datos ficticios  | Implementada                 |
| `*`                      | Página 404 dentro del layout                      | Implementada                 |

Parámetros del catálogo: `categoria` (slug), `q` (texto) y `orden` (`novedades`, `precio-asc`,
`precio-desc`).

Las páginas se cargan bajo demanda al entrar en cada ruta para reducir el JavaScript inicial.

### 5.4 Modelo de datos

| Entidad            | Campos principales                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `Category`         | `id`, `slug`, `name`, `description`                                                             |
| `Product`          | `id`, `slug`, `name`, `categoryId`, `priceCents`, `active`, `createdAt`, composición y cuidados |
| `Variant`          | `id`, `productId`, `size`, `color`, `sku`, `stock`                                              |
| `Catalog`          | `categories`, `products`, `variants`                                                            |
| `CartLine`         | `variantId`, `quantity`                                                                         |
| `Customer`         | nombre, teléfono, email nulo (no se solicita en checkout)                                       |
| `Order`            | código, cliente, entrega, pago, líneas, totales, tres estados, cotización e historial           |
| `OrderItem`        | datos congelados: nombre, talla, color, precio unitario y cantidad                              |
| `OrderStatusEvent` | unión discriminada por `axis` (`payment` o `fulfillment`)                                       |

Estados:

- **Pago:** `pendiente → por_verificar → pagado | rechazado`; `cancelado` como salida.
- **Entrega:** `nuevo → preparando → despachado → entregado`; `cancelado` como salida.

### 5.5 Flujo de datos actual

```text
Modo demo: seed + localStorage validado ←→ repositorios locales
Modo remoto: Supabase Edge Functions ←→ PostgreSQL + RLS + Storage
        │                                   │
        ▼                                   ▼
domain/ (stock, importes, estados) ←→ providers de aplicación
        │                                   │
        └────── features (tienda, checkout, tracking, admin)
                            │
                            ▼
React Router + Tailwind → build estático → Pages / Cloudflare
```

Sin variables Supabase, el seed abastece el catálogo y `localStorage` conserva los cambios de este
navegador. Con variables públicas configuradas, el checkout consulta y crea el pedido en el servidor;
los precios, el stock y los totales se validan allí y el pedido guarda una copia histórica. La base de
datos no está conectada en esta entrega y el flujo remoto aún requiere una prueba en la nube.

---

## 6. Funcionalidad implementada

### 6.1 Portada (`/`)

- Hero editorial con titular, propuesta y dos acciones: ir al catálogo o conocer la tienda.
- Visual con silueta SVG y ficha flotante de la camisa de lino Margarita.
- Selección de cuatro prendas enlazadas a su ficha.
- Relato de la tienda con recuento real por categoría.
- Proceso de compra en tres pasos y nota de que la verificación es manual.
- Encabezado fijo con navegación a catálogo y secciones; menú móvil accesible.

### 6.2 Catálogo (`/catalogo`)

- 20 piezas activas; la vigésimo primera está desactivada.
- Filtro por categoría con recuento por categoría y opción “Todas”.
- Búsqueda inmediata sin distinguir acentos, sobre nombre, descripción, categoría y colores.
- Orden por novedades, precio ascendente y descendente.
- Estado vacío con acción para limpiar filtros.
- Contador de resultados anunciado con `aria-live`.
- Estado en la URL, `replace` para no llenar el historial y `preventScrollReset`.
- Grilla de 2 columnas en móvil y 4 en escritorio.

### 6.3 Ficha de producto (`/producto/:slug`)

- Pan de navegación, categoría, nombre, precio, descripción, composición y cuidados.
- Selector de color con muestras, nombre visible, `aria-pressed` y check en la selección.
- Selector de talla con botones de 44 px; las agotadas se tachan y se deshabilitan.
- Combinaciones inexistentes o agotadas no se pueden elegir.
- Al cambiar de color se conserva la talla si existe; si no, se elige la primera disponible.
- Stock dinámico con `aria-live`: disponible, últimas unidades o agotado.
- La silueta toma el color de la variante con transición suave.
- Estado agotado: badge, acciones de compra deshabilitadas y explicación.
- Añadir al carrito la combinación seleccionada; consulta opcional por WhatsApp.
- Selección reflejada en la URL (`?talla=M&color=Negro`).

### 6.4 WhatsApp

La tienda conserva el enlace profundo `wa.me` y el fallback de copiar mensaje. Además, el backend
incluye un webhook de WhatsApp Cloud API preparado:

- Verificación del reto de Meta y de la firma `X-Hub-Signature-256`.
- Deduplicación de eventos, reintentos y registro de estados de entrega.
- Contexto conversacional efímero; no se guarda el contenido completo del chat.
- Consultas de catálogo, stock, pago, pedido y entrega con datos vigentes del servidor.
- Derivación a una persona cuando falta información o el cliente lo pide.
- Cola de salida bloqueada por `WHATSAPP_SEND_ENABLED=false` hasta autorización expresa.
- Referencias de pago registradas por el comprador quedan pendientes de revisión; nunca se aprueban
  automáticamente.

`VITE_STORE_WHATSAPP_NUMBER` es opcional y queda vacío por defecto. Sin número configurado, la
interfaz solo permite copiar el mensaje; no hay un destinatario ficticio. El pedido incluye código,
cliente, líneas con nombre/talla/color/cantidad/total, pago, entrega, agencia si aplica, total y nota
opcional. `encodeURIComponent` escapa acentos, saltos de línea, `#` y símbolos.

No se ha probado con Meta ni se han enviado mensajes reales. La mensajería saliente y las plantillas
facturables siguen desactivadas.

### 6.5 Navegación y 404

- Layout con cabecera fija translúcida, contenido y pie.
- Enlace “Saltar al contenido” para teclado.
- Menú móvil con `aria-expanded`, `aria-controls` y cierre al navegar.
- Enlaces de sección que funcionan desde cualquier ruta (`BASE_URL#seccion`).
- 404 con copy propio y acción para volver al inicio.
- Título del documento por vista (`Catálogo · Norte Moda`, nombre del producto, etc.).

### 6.6 Carrito (`/carrito`)

- Guarda solo id de variante y cantidad; el precio y la disponibilidad se resuelven en el catálogo.
- Incrementa, reduce, quita o vacía artículos; muestra subtotal y acceso de vuelta al producto.
- Informa si una variante desapareció, se agotó, se desactivó o si su cantidad superó el stock.
- Bloquea el checkout mientras haya líneas inválidas o el carrito esté vacío.

### 6.7 Checkout y creación de pedido (`/checkout`)

- Checkout de invitado con React Hook Form y Zod: nombre, teléfono, entrega, pago previsto y nota.
- Solicita dirección según la forma de entrega; no pide cédula, correo ni referencia bancaria.
- Recalcula las líneas contra el catálogo vigente y calcula subtotal, tarifa ficticia y total en
  centavos.
- Con Supabase configurado, solicita una cotización autoritativa y crea el pedido con idempotencia.
  Si el total cambió, exige confirmación del comprador. Nunca recurre a `localStorage` como sustituto.
- La compra directa desde una ficha usa una intención temporal y no borra el carrito existente.
- Genera el código `NM-####`, congela producto, variante y precio, e inicia pago y entrega por separado.
- Solo limpia el carrito y navega a confirmación si el pedido se guardó correctamente.
- Explica que no procesa pagos ni crea envíos.

### 6.8 Consulta del pedido (`/pedido?codigo=NM-0001`)

- En modo local, busca por código normalizado en los pedidos de este navegador.
- En modo remoto, exige el enlace privado con token; el token viaja en el fragmento `#` y la base
  guarda solo su hash.
- Presenta artículos y totales congelados, pago previsto, pago actual y preparación/entrega.
- Permite registrar la referencia de pago, que deja el pago en revisión manual.
- Ofrece “Actualizar estado” en modo remoto para reflejar cambios del panel.
- Muestra el historial por eje y deja copiar un resumen sin enviar datos a WhatsApp.
- Explica los códigos inexistentes y que los pedidos locales no se comparten entre navegadores.

### 6.9 Panel de administración (`/admin`)

- Requiere Supabase Auth y una membresía activa; la autorización se valida en el servidor.
- Crea y edita productos; activa o pausa su aparición en la tienda.
- Crea, edita y elimina variantes con talla, color, SKU único y stock entero no negativo.
- Busca y filtra pedidos; consulta sus líneas, totales, comprador, referencia de pago y coordinación.
- Cambia pago y entrega en controles separados, solo mediante transiciones válidas.
- La referencia del comprador solo deja el pago «por verificar»; «Pagado» exige una acción posterior
  de una persona autorizada. No hay conciliación bancaria ni aprobación automática.
- Cada transición se agrega al historial. La entrega avanza en preparación, despacho y entrega.
- Para envíos manuales se registran empresa, número de guía y observaciones; no hay integración con
  MRW ni Zoom. El comprador ve esos datos con su enlace privado.
- Importa existencias por CSV con transacción, control de cambios obsoletos y movimientos auditables.
- Administra imágenes, métricas, métodos manuales y derivaciones de WhatsApp.
- El panel local sin autenticación fue retirado. Sin Supabase, `/admin` muestra la configuración
  pendiente y un enlace a `/admin?vista=demo`, una vista previa de solo lectura con datos ficticios.
  Esa vista no crea sesión, no escribe datos y mantiene desactivadas las acciones sensibles.

### 6.10 Persistencia local

- Repositorios separados para catálogo, carrito y pedidos; los componentes no llaman directamente a
  `localStorage` ni a las funciones Edge.
- Zod valida datos persistidos y respuestas remotas: totales congelados, referencias, ids y códigos.
- Datos dañados se descartan o restauran desde el seed; el carrito se recorta al stock disponible.
- El estado local sobrevive a recargas en el mismo navegador, pero no se comparte entre dispositivos.
- Con Supabase, la fuente de verdad es PostgreSQL; el token privado y la referencia de pago se tratan
  como datos sensibles.

---

## 7. Diseño de interfaz

La interfaz sigue un criterio editorial y minimalista, guiado por las Human Interface Guidelines de
Apple a través del skill `apple-design` (instalado globalmente en `~/.claude/skills/apple-design`).

### Sistema visual

| Token                  | Valor                                | Uso                                |
| ---------------------- | ------------------------------------ | ---------------------------------- |
| `--color-paper`        | `#faf9f7`                            | Fondo principal                    |
| `--color-ink`          | `#1c1917`                            | Texto y acciones primarias         |
| `--color-sand`         | `#f2ece3`                            | Tarjetas y superficies de producto |
| `--color-brand-50…900` | Escala terracota                     | Acentos, rótulos y estados         |
| `--animate-rise`       | 800 ms, `cubic-bezier(0.16,1,0.3,1)` | Entrada de bloques                 |
| `--animate-fade`       | 1200 ms                              | Entrada del visual del hero        |

- **Tipografía:** una sola familia del sistema, sin fuentes externas. Jerarquía por tamaño, peso y
  tracking negativo en titulares; versalitas espaciadas para rótulos.
- **Espacio:** contenedor de 6xl, secciones con 80–112 px de aire, separadores de 1 px al 6–10 %.
- **Movimiento:** breve, con easing suave y retardos escalonados; desactivado con
  `prefers-reduced-motion`.
- **Imágenes:** siluetas SVG por categoría y color, sin red ni fotos de stock. Sustituto temporal de
  la fotografía.
- **Controles:** objetivos táctiles de 44 px, foco visible, `aria-pressed`, `aria-live` y estados
  deshabilitados que no dependen solo del color.
- **Responsive:** verificado a 390 px y 1440 px sin desbordamiento horizontal.

### Referencias aplicadas del skill

- `search-fields.md › Best practices`: búsqueda al escribir, icono, placeholder y botón de limpiar.
- `collections.md › Best practices`: grilla estándar con padding suficiente.
- `motion.md › Best practices`: movimiento breve, opcional y solo en acciones explícitas.
- `buttons.md › Best practices`: área de 44×44 pt y estado de pulsación.
- `accessibility.md`: tamaños mínimos, contraste, información no solo por color y alternativas.
- `layout.md`: jerarquía, alineación, agrupación y adaptación.

El skill advierte que “crema + terracota” puede ser un look genérico. La paleta se mantiene porque
está anclada al producto (lino, arcilla, costa) y la firma visual son las siluetas por color, no el
degradado.

---

## 8. Catálogo de datos

- **6 categorías:** Camisas, Camisetas, Vestidos, Pantalones, Faldas y Chaquetas.
- **21 prendas:** 20 activas y una desactivada (`pantalon-wide-leg-valencia`).
- **171 variantes** con talla, color, SKU y stock.
- **1 producto totalmente agotado** (`vestido-lino-isla`) para probar el estado.
- Precios entre **$14,00 y $48,00** en centavos.
- Nombres originales con topónimos venezolanos: Margarita, Catuaro, Caroní, Canaima, Paraguaná,
  Isla, Cumarebo, Mérida, Caracas, Maracaibo, Barquisimeto, Tucacas, Porlamar, Macuto, La Guaira,
  Choroní.
- Imágenes: `public/images/products/placeholder.svg` para todas las prendas.

La taxonomía y los rangos de precio se inspiran en tiendas de ropa de tamaño medio. Los nombres,
descripciones, precios y combinaciones son propios de Norte Moda: **no se copió el catálogo de
ninguna marca** y el proyecto no está afiliado a ninguna tienda.

---

## 9. Pruebas y calidad

### Verificaciones de esta entrega

| Comando             | Resultado                                          |
| ------------------- | -------------------------------------------------- |
| `pnpm check`        | Correcto: tipos, lint y 197 pruebas en 22 archivos |
| `pnpm test:db`      | Correcto: 37 comprobaciones SQL/RLS con PGlite     |
| `pnpm format:check` | Correcto                                           |
| `pnpm build`        | Correcto; genera `dist/`                           |

`scripts/verify-database.mjs` crea los esquemas que Supabase proporciona, aplica las 12 migraciones
en orden, carga el seed y comprueba catálogo, cotización, idempotencia, manipulación de totales,
consulta privada, token incorrecto, referencia de pago, aprobación manual, descuento único de stock,
transiciones, RLS y permisos de `anon`, `authenticated` y `service_role`. PGlite valida SQL real,
pero no reemplaza una prueba contra Supabase Cloud, PostgREST ni el runtime de Edge Functions.

### Distribución

| Área de pruebas                      | Cobertura                                                        |
| ------------------------------------ | ---------------------------------------------------------------- |
| `domain/__tests__/`                  | Dinero, catálogo, carrito, producto, pedidos, inventario y pagos |
| `data/`                              | Repositorios, CSV, gateway remoto y respuestas inválidas         |
| `features/` (home, catalog, product) | Render, filtros, URL, variantes, agotado y WhatsApp              |
| `features/checkout/`                 | Flujo local, compra directa y creación de pedido                 |
| `lib/__tests__/`                     | WhatsApp, webhook, cola, asistente, IA y firma                   |

Las pruebas de humo usan `renderToStaticMarkup`; los recorridos usan Testing Library y jsdom. No se
configuró Playwright ni una suite E2E en navegador real.

### Verificaciones manuales registradas en una etapa anterior

- Catálogo: búsqueda `lino` → 5 resultados, foco conservado, URL actualizada.
- Catálogo: filtro `Vestidos` → 4 piezas; orden descendente $42 → $34.
- Ficha: selección inicial S/Blanco con 4 unidades.
- Ficha: clic en Negro → S/Negro con 2 unidades y XL deshabilitada.
- Ficha: clic en talla M → URL `?talla=M&color=Negro`, 3 unidades.
- Agotado: acción “Agotado por ahora”, sin enlace a WhatsApp.
- Portapapeles bloqueado en headless: aparece el campo manual con el mensaje completo.
- Móvil: `scrollWidth = 390` en portada, catálogo y ficha.

Estas observaciones son históricas y no equivalen a una revisión visual de todos los flujos añadidos
en esta entrega. Para repetirla, iniciar `pnpm dev`, revisar catálogo, ficha, carrito, checkout,
consulta de pedido y panel a 390 px y 1440 px, y guardar capturas sin datos personales reales.

### Historial de pruebas por etapa

| Etapa                 | Pruebas                                |
| --------------------- | -------------------------------------- |
| Sesión 1              | 0 (validación con tipos, lint y build) |
| Sesión 2              | 42                                     |
| Sesión 3              | 44                                     |
| Sesión 4              | 62                                     |
| Sesión 5              | 81                                     |
| Cierre de flujo local | ver resultados de esta entrega arriba  |

---

## 10. Despliegue

- **Repositorio público:** `ReinaldoGoCode/ProyectOne`.
- **GitHub Pages** configurado con `build_type: workflow`.
- **URL:** <https://reinaldogocode.github.io/ProyectOne/>.
- El workflow `.github/workflows/deploy.yml` está configurado para correr en cada push a `main`:
  1. Instala pnpm y Node.
  2. `pnpm install --frozen-lockfile`.
  3. `pnpm check` (tipos, lint y pruebas).
  4. `pnpm test:db` (migraciones y comprobaciones SQL/RLS).
  5. `pnpm format:check`.
  6. `pnpm build` con `VITE_BASE_PATH=/ProyectOne/` y variables públicas opcionales.
  7. Genera `dist/404.html` y publica el artefacto en Pages.
- El build copia `index.html` a `/catalogo`, `/carrito`, `/checkout`, `/pedido`, las rutas estáticas
  del panel y cada `/producto/:slug`, de modo que esas rutas respondan **200**.
- Las rutas desconocidas reciben `404.html`, que renderiza la app con la página 404. Es una
  limitación de GitHub Pages: no hay reescritura de rutas.
- `VITE_BASE_PATH` mantiene la base `/` en local y `/ProyectOne/` en Pages.

El repositorio local se reconstruyó desde `origin/main` conservando los cambios de trabajo. El
2026-10-22 se publicó el commit `df24557` en `main`; el workflow `39880826745` completó con éxito la
verificación, las 33 comprobaciones SQL/RLS que existían entonces, el formato, el build y el despliegue en Pages. La URL
<https://reinaldogocode.github.io/ProyectOne/> respondió HTTP 200 en inicio, catálogo, producto,
pedido y admin con el nuevo bundle.

GitHub Pages sirve solo la demo; para una tienda operativa hay que usar un hosting permitido y
conectar Supabase. El workflow `.github/workflows/deploy-cloudflare.yml` se ejecuta en cada push a
`main`, comprueba los secretos y omite el despliegue hasta que existan `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` y un proyecto de Pages. Todavía no hay cuenta, token ni `accountId`, así que
no se ha ejecutado un despliegue en Cloudflare.

No hay credenciales ni secretos de producción en el código. `.env.local` y cualquier `.env` están
excluidos por `.gitignore`; `.env.example` solo contiene nombres y valores vacíos.

---

## 11. Historial por sesión y cambios

### Sesión 1 — Base del proyecto

**Commit:** `c99befe` · `feat: base del proyecto (sesion 1)` · 35 archivos, +3.477 líneas.

- Vite 7 + React 19 + TypeScript 5.9 en modo `strict`.
- Tailwind 4 con plugin de Vite y tokens de marca.
- ESLint con reglas tipadas y Prettier.
- Estructura de carpetas por capas.
- README, `docs/01-alcance.md` y `docs/03-decisiones.md`.
- Validación con `tsc --noEmit`, ESLint, Prettier y build.
- Autoría corregida a Reinaldo y commit reescrito (`--amend`) antes de publicar.

### Sesión 2 — Dominio, seed y pruebas

**Commit:** `c9d283e` · `feat: modelo de dominio, seed y pruebas (sesion 2)` · 18 archivos,
+1.439 / −18.

- `types.ts` con `Category`, `Product`, `Variant`, `CartLine`, `Order` y estados.
- `money.ts` con centavos, formato `es-VE` y validaciones.
- `product.ts` con stock, tallas, colores y combinaciones.
- Seed inicial de 3 categorías, 10 productos y 86 variantes (luego ampliado).
- Vitest 5 en entorno Node y 42 pruebas.
- Script `pnpm check`.
- Remoto de GitHub conectado y `main` publicado.

### CI — Despliegue en Pages

**Commit:** `0c87410` · `ci: despliegue automatico en GitHub Pages` · 3 archivos, +79.

- Workflow de verificación, build y publicación.
- `VITE_BASE_PATH` para servir bajo `/ProyectOne/`.
- `404.html` derivado de `index.html`.
- Pages habilitado con `build_type: workflow`.

### Sesión 3 — Layout, router, portada y 404

**Commit:** `8c5b79c` · `feat: layout, router, portada y 404 (sesion 3)` · 24 archivos,
+931 / −205.

- React Router 7 con `basename` desde Vite y `ScrollRestoration`.
- `StoreLayout`, cabecera fija, pie y enlace de salto al contenido.
- Portada con hero, selección del seed, relato y proceso.
- 404 con navegación de regreso.
- Siluetas SVG por categoría y color.
- Sistema visual, animaciones y `prefers-reduced-motion`.
- Menú móvil accesible.
- 44 pruebas.

### Sesión 4 — Catálogo

**Commit:** `0f98a53` · `feat: catalogo con filtros, busqueda y orden (sesion 4)` · 23 archivos,
+1.244 / −62.

- Catálogo ampliado a 6 categorías, 21 prendas y 171 variantes.
- `catalog.ts` con filtro, búsqueda sin acentos, orden y conteos.
- Estado del catálogo en la URL con `replace`.
- Scope bar de categorías, buscador, orden y estado vacío.
- Navegación de catálogo en cabecera, pie y portada.
- 62 pruebas.
- Skill `apple-design` instalado y aplicado.

**Commit:** `d657469` · `fix: publicar /catalogo como ruta estatica en Pages` · 2 archivos, +9 / −3.

- `/catalogo` pasó de 404 con app a 200 real.

### Sesión 5 — Ficha de producto y WhatsApp

**Commit:** `3f71b6b` · `feat: ficha de producto y modulo de WhatsApp (sesion 5)` · 18 archivos,
+1.156 / −64.

- `/producto/:slug` con pan de navegación y ficha completa.
- Selector de talla y color con estado en la URL.
- Combinaciones agotadas deshabilitadas y stock con `aria-live`.
- Tarjetas del catálogo enlazadas a la ficha.
- `whatsapp.ts` con mensajes de pedido y consulta.
- `WhatsAppActions` con copiar y respaldo manual.
- Rutas estáticas de todos los productos en el build.
- 81 pruebas en esa etapa histórica.

### Cierre del flujo de demostración — 2026-10-20

- Carrito persistido, con cantidades, revalidación contra catálogo y totales.
- Checkout validado para invitados, pedido con código y líneas congeladas.
- Consulta local de pedido con estados, historial y resumen copiable.
- Panel local para productos, variantes, stock y pedidos con transiciones separadas.
- Validación de repositorios y recuperación ante datos dañados; reinicio explícito de datos ficticios.
- Pruebas de interacción compradora y administrativa añadidas.
- Publicado en `main` tras las verificaciones de esta entrega. La carpeta local no incluye `.git`,
  así que los cambios se compararon contra el árbol remoto y se publicaron en una actualización
  atómica.

### Integración remota y endurecimiento — 2026-10-22

- Gateway Supabase para cotización, creación, consulta y referencia de pago.
- Migración `20261021180000_public_payment_references.sql` y Edge Function
  `submit-payment-reference`: el comprador registra una referencia y el pago queda en revisión.
- UI de seguimiento con enlace privado, referencia, mensajes demo/remoto y actualización de estado.
- Compra directa aislada que conserva el carrito original.
- Webhook de WhatsApp con firma, deduplicación, cola, estados, conversaciones y fallback.
- 12 migraciones y 16 Edge Functions; validación con PGlite mediante `pnpm test:db` (37 comprobaciones).
- 197 pruebas de aplicación en 22 archivos; `pnpm build` y `pnpm format:check` correctos.
- Workflow de Cloudflare Pages preparado; no ejecutado por falta de credenciales.
- El backend no se aplicó a Supabase Cloud y WhatsApp no se probó con Meta.

---

## 12. Registro de decisiones (ADR)

El detalle completo está en `docs/03-decisiones.md`. Resumen:

| ID      | Decisión                                                                    |
| ------- | --------------------------------------------------------------------------- |
| ADR-001 | TypeScript 5.9 en lugar de 7 por compatibilidad con `typescript-eslint`     |
| ADR-002 | Una sola configuración de TypeScript que cubre `src` y `vite.config.ts`     |
| ADR-003 | Tailwind 4 con plugin de Vite y tokens en CSS, sin archivo de configuración |
| ADR-004 | Alias `@/` y puerto de desarrollo fijo                                      |
| ADR-005 | pnpm con `nodeLinker: hoisted` para evitar junctions rotos en Windows       |
| ADR-006 | Scripts de instalación desactivados explícitamente (`allowBuilds: false`)   |
| ADR-007 | ESLint con reglas que usan información de tipos                             |
| ADR-008 | Sin router ni test runner en la sesión 1                                    |
| ADR-009 | `App.tsx` provisional, reemplazado en la sesión 3                           |
| ADR-010 | Dinero en centavos enteros                                                  |
| ADR-011 | Pago y entrega como dos ejes de estado                                      |
| ADR-012 | Vitest en Node con configuración compartida con Vite                        |
| ADR-013 | Seed declarativo con ids y SKU derivados                                    |
| ADR-014 | Router con base dinámica y enlaces de sección                               |
| ADR-015 | Sistema visual propio con siluetas SVG                                      |
| ADR-016 | Filtros del catálogo como estado de la URL                                  |
| ADR-017 | Catálogo verosímil sin copiar una marca                                     |
| ADR-018 | Reglas de Apple HIG aplicadas al catálogo                                   |
| ADR-019 | WhatsApp por enlace profundo, sin API ni automatización                     |
| ADR-020 | Selección de variantes en la URL y stock deshabilitado                      |
| ADR-021 | No inventar una confirmación de pedido para WhatsApp                        |

---

## 13. Incidencias y cómo se resolvieron

| Incidencia                                      | Causa                                         | Solución                                                |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| pnpm no encontraba módulos al ejecutar binarios | Junctions del linker aislado en Windows       | `nodeLinker: hoisted`                                   |
| `pnpm install` fallaba por scripts pendientes   | pnpm 11 bloquea `postinstall`                 | `allowBuilds: false` para paquetes con binario opcional |
| TypeScript 7 rompía el lint con tipos           | `typescript-eslint` soporta `< 6.1.0`         | Fijar `~5.9.3`                                          |
| Vite 8 y `plugin-react` 6 instalaban mal        | Dependencias opcionales/junctions             | Stack estable Vite 7 + plugin 5                         |
| Captura móvil “cortada”                         | Chrome headless impone ancho mínimo de 500 px | Emulación con CDP a 390 px                              |
| Enlaces de sección no funcionaban desde 404     | Anclas relativas a la página actual           | `sectionHref` con `BASE_URL`                            |
| `/catalogo` respondía 404 con la app dentro     | Pages no reescribe rutas                      | `dist/catalogo/index.html` estático                     |
| Productos profundos respondían 404              | Misma limitación                              | Rutas estáticas de producto en el build                 |
| Copy de la tienda con voseo                     | No es lo habitual en Venezuela                | Tuteo en toda la interfaz                               |
| Prenda blanca invisible sobre fondo claro       | Falta de contraste del placeholder            | Fondo más profundo, contorno y sombra                   |
| Portapapeles bloqueado sin foco                 | Restricción del navegador                     | Campo de solo lectura con el mensaje                    |

---

## 14. Limitaciones conocidas

1. **Backend no conectado:** no hay proyecto Supabase enlazado ni funciones desplegadas. El modo
   remoto está implementado y probado con PostgreSQL embebido, pero no en la nube.
2. **Almacenamiento local:** en modo demo, los datos quedan en `localStorage` de este navegador. No
   son pedidos compartidos y se pierden al limpiar los datos del sitio.
3. **WhatsApp sin credenciales:** el webhook y la cola están preparados, pero no se probaron con
   Meta. `WHATSAPP_SEND_ENABLED=false` impide envíos salientes y no se enviaron mensajes reales.
4. **Pagos y entregas manuales:** no hay conciliación bancaria, captura de comprobantes en imagen,
   pasarela ni conexión con MRW, ZOOM o servicios de delivery. «Pagado» siempre requiere revisión
   humana.
5. **Supabase local incompleto:** Docker Desktop falló con errores de E/S y poco espacio; no se
   ejecutó el stack completo. PGlite valida migraciones y RLS, no PostgREST ni Edge Runtime.
6. **Rutas dinámicas en Pages:** las rutas conocidas se copian como archivos estáticos. Rutas
   desconocidas cargan el fallback `404.html` con estado HTTP 404.
7. **Visuales:** las siluetas SVG son ilustraciones temporales; aún no hay fotografía de producto.
8. **Pruebas de navegador:** Vitest y Testing Library cubren reglas e interacciones principales, pero
   no hay Playwright ni verificación automatizada en navegadores reales.
9. **Accesibilidad:** foco, etiquetas, contraste y movimiento reducido están contemplados; falta una
   auditoría completa con lector de pantalla y personas usuarias.
10. **Tema:** solo hay tema claro.

---

## 15. Próximos pasos

La siguiente fase es activar y validar la infraestructura que ya existe en código:

1. Crear un proyecto Supabase Free, enlazarlo y aplicar las 12 migraciones y, si se desea, el seed.
2. Desplegar las 16 Edge Functions, configurar secretos y registrar el usuario administrador.
3. Probar en staging el checkout, el enlace privado, la referencia de pago, RLS, el descuento de
   stock y el panel. Verificar PostgREST y Edge Runtime, no solo PGlite.
4. Elegir un hosting permitido para una tienda y publicar allí. Pages queda solo como demo.
5. Configurar WhatsApp con un número de prueba, validar firma, deduplicación y cola sin enviar
   mensajes reales; habilitar envíos solo con autorización expresa.
6. Definir métodos de pago, políticas de privacidad/retención y logística real.

Pagos, mensajería y envíos deben integrarse solo con credenciales y proveedores autorizados.

---

## 16. Comandos y operación

### Requisitos

- Node.js 22.12 o superior.
- pnpm 11 (`corepack enable && corepack prepare pnpm@11.28.5 --activate`).

### Desarrollo

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

### Verificación

```bash
pnpm test         # 197 pruebas en 22 archivos (verificación actual)
pnpm test:db      # 37 comprobaciones SQL/RLS con PGlite
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint sin advertencias
pnpm format:check # Prettier
pnpm build        # build de producción + rutas estáticas
pnpm check        # tipos + lint + pruebas
```

### Publicación

```bash
git push origin main
```

El 2026-10-22 se publicó el commit `df24557` en `main` y el workflow de Pages completó con éxito.
La URL publicada responde con el nuevo bundle; se comprobaron inicio, catálogo, producto, pedido y
admin con HTTP 200. El backend Supabase y las funciones Edge no se despliegan desde este workflow.

---

## 17. Convenciones

- **Git:** commits convencionales en español (`feat:`, `fix:`, `ci:`, `docs:`, `test:`).
- **Ramas:** `feat/sesion-01-base`, `feat/sesion-02-modelo-datos`, etc.
- **Idioma:** interfaz y nombres de dominio en español; API técnica en inglés.
- **Dinero:** centavos enteros; nunca decimales flotantes.
- **Tipos:** `import type`, sin `any`, sin `@ts-ignore` sin justificar.
- **Pruebas:** cada regla de dominio nueva llega con su prueba.
- **Diseño:** 44 px de objetivo táctil, foco visible, contraste AA, `prefers-reduced-motion`.

---

## 18. Créditos y uso

Proyecto de portafolio sin fines comerciales. Todos los productos, precios, clientes y pedidos son
inventados. La taxonomía se inspira en tiendas de ropa de tamaño medio; los nombres y descripciones
son originales y no se copió el catálogo de ninguna marca. El número de WhatsApp es ficticio.

Las guías de diseño provienen del skill `apple-design`, basado en las Human Interface Guidelines de
Apple. Las siluetas SVG son propias del proyecto.
