# Norte Moda — Documentación completa

> Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio con datos
> ficticios, construido por etapas y desplegado en GitHub Pages.
>
> **Última actualización:** 2026-10-19 · **Versión de la aplicación:** 0.5.0 · **Rama:** `main`
>
> **Sitio publicado:** <https://reinaldogocode.github.io/ProyectOne/>
>
> **Repositorio:** <https://github.com/ReinaldoGoCode/ProyectOne>

---

## 1. Resumen ejecutivo

Norte Moda modela el flujo de venta de un comercio pequeño de ropa en Venezuela: catálogo con tallas
y colores, ficha de producto con stock real, filtros de catálogo y un puente directo a WhatsApp para
consultar una prenda. La verificación del pago y la coordinación del envío son manuales, como en el
mostrador; no hay pagos ni integraciones automáticas.

A la fecha están implementadas las **sesiones 1 a 5 de 18**:

- Base técnica con React 19, TypeScript estricto, Vite 7 y Tailwind 4.
- Modelo de dominio con dinero en centavos y dos ejes de estado para pedidos.
- Catálogo ficticio de 6 categorías, 21 prendas y 171 variantes.
- Portada editorial, catálogo con filtros/búsqueda/orden y página 404.
- Ficha de producto con selector de talla y color, stock y combinaciones agotadas deshabilitadas.
- Módulo de WhatsApp con mensajes de consulta y de pedido, URL `wa.me` escapada y pruebas.
- 81 pruebas automatizadas, tipado y lint en verde, despliegue automático en GitHub Pages.

Lo que sigue: carrito, checkout, creación de pedidos, confirmación y seguimiento, panel
administrativo y persistencia con Supabase. La sección 15 detalla el plan.

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
- Página 404 y navegación completa entre portada, catálogo y ficha.
- Datos ficticios centralizados y pruebas de integridad del seed.
- Despliegue automático con verificación previa (tipos, lint y pruebas).

### Pendiente (planificado)

- Carrito con cantidades y totales (sesiones 6 y 7).
- Checkout como invitado, creación de pedido y confirmación (sesiones 8 a 10).
- Consulta de pedido por código (sesión 10).
- Panel administrativo de productos y pedidos (sesiones 11 a 16).
- Estados de pago y entrega con historial (sesión 15).
- Persistencia con Supabase, autenticación real y RLS (fase posterior).
- Pasada de accesibilidad, pruebas de flujo y cierre de portafolio (sesiones 17 y 18).

### Fuera de alcance

Pagos reales, confirmación bancaria automática, integraciones con MRW o ZOOM, automatización oficial
de WhatsApp, cuentas de cliente, cupones, tasas de cambio automáticas y subida de imágenes a
Storage.

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
├─ .github/workflows/deploy.yml     # CI: verifica, construye y publica
├─ docs/
│  ├─ 01-alcance.md                 # problema, requisitos, flujos y criterios
│  └─ 03-decisiones.md              # 21 ADR
├─ DOCUMENTACION.md                 # este documento
├─ public/
│  ├─ favicon.svg
│  └─ images/products/placeholder.svg
├─ src/
│  ├─ app/
│  │  ├─ layouts/StoreLayout.tsx
│  │  └─ router.tsx
│  ├─ components/
│  │  ├─ layout/                    # SiteHeader, SiteFooter
│  │  └─ ui/                        # GarmentArt, ProductCard, WhatsAppActions, button
│  ├─ data/
│  │  ├─ seed/                      # categorías, productos, variantes
│  │  └─ repositories/              # reservado para persistencia
│  ├─ domain/
│  │  ├─ types.ts
│  │  ├─ money.ts
│  │  ├─ product.ts
│  │  ├─ catalog.ts
│  │  └─ __tests__/
│  ├─ features/
│  │  ├─ home/
│  │  ├─ catalog/
│  │  ├─ product/
│  │  ├─ not-found/
│  │  ├─ cart/                      # vacío, sesiones 6-7
│  │  ├─ checkout/                  # vacío, sesiones 8-10
│  │  └─ admin/                     # vacío, sesiones 11-16
│  ├─ hooks/useDocumentTitle.ts
│  ├─ lib/                          # colors.ts, paths.ts, whatsapp.ts
│  ├─ styles/index.css
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ eslint.config.js
├─ index.html
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ vite.config.ts
```

Métricas actuales de código:

- 40 archivos `.ts`/`.tsx` en `src`, ~3.538 líneas.
- 8 de esos archivos son pruebas (~608 líneas); 32 archivos de aplicación (~2.930 líneas).
- 21 ADR documentados.

### 5.2 Capas y reglas

| Capa                 | Responsabilidad                                      | Regla                             |
| -------------------- | ---------------------------------------------------- | --------------------------------- |
| `domain/`            | Tipos, dinero, stock, filtros y transiciones         | No importa React ni Supabase      |
| `data/seed/`         | Catálogo ficticio y expansión de variantes           | Datos puros, sin lógica de UI     |
| `data/repositories/` | Futuro adaptador de persistencia                     | Interfaz antes que implementación |
| `features/`          | Capacidades de negocio (catálogo, ficha, carrito...) | Componentes y páginas por dominio |
| `components/ui/`     | Presentación reutilizable                            | Sin reglas de negocio             |
| `lib/`               | Utilidades sin estado                                | WhatsApp, colores, rutas base     |
| `app/`               | Router, layout y composición                         | Punto de entrada de las páginas   |

Reglas transversales:

- Dinero siempre en centavos enteros; formatear solo al mostrar.
- El carrito guardará `variantId` y cantidad, no precios; el pedido congelará los datos.
- Pago y entrega son dos ejes independientes, no un único estado.
- La lógica nueva de dominio se prueba antes de conectarla a la UI.
- Sin `any` explícito y sin `@ts-ignore` sin justificar.

### 5.3 Rutas

| Ruta                            | Contenido                                         | Estado                     |
| ------------------------------- | ------------------------------------------------- | -------------------------- |
| `/`                             | Portada editorial con selección, relato y proceso | Implementada               |
| `/catalogo`                     | Catálogo con filtros, búsqueda y orden            | Implementada               |
| `/producto/:slug`               | Ficha de producto y variantes                     | Implementada               |
| `/producto/:slug?talla=&color=` | Variante preseleccionada y compartible            | Implementada               |
| `*`                             | Página 404 dentro del layout                      | Implementada               |
| `/pedido/:code`                 | Confirmación y seguimiento                        | Pendiente (sesión 10)      |
| `/admin`                        | Panel administrativo                              | Pendiente (sesiones 11-16) |

Parámetros del catálogo: `categoria` (slug), `q` (texto) y `orden` (`novedades`, `precio-asc`,
`precio-desc`).

### 5.4 Modelo de datos

| Entidad            | Campos principales                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `Category`         | `id`, `slug`, `name`, `description`                                                             |
| `Product`          | `id`, `slug`, `name`, `categoryId`, `priceCents`, `active`, `createdAt`, composición y cuidados |
| `Variant`          | `id`, `productId`, `size`, `color`, `sku`, `stock`                                              |
| `Catalog`          | `categories`, `products`, `variants`                                                            |
| `CartLine`         | `variantId`, `quantity`                                                                         |
| `Customer`         | nombre, cédula, teléfono, email opcional                                                        |
| `Order`            | código, cliente, entrega, pago, líneas, totales, dos estados, notas e historial                 |
| `OrderItem`        | datos congelados: nombre, talla, color, precio unitario y cantidad                              |
| `OrderStatusEvent` | unión discriminada por `axis` (`payment` o `fulfillment`)                                       |

Estados:

- **Pago:** `pendiente → por_verificar → pagado | rechazado`; `cancelado` como salida.
- **Entrega:** `nuevo → preparando → despachado → entregado`; `cancelado` como salida.

### 5.5 Flujo de datos actual

```text
data/seed (21 productos, 171 variantes)
        │
        ▼
domain/catalog.ts (filtro, búsqueda, orden)
domain/product.ts (stock, combinaciones, selección)
        │
        ▼
features/* (páginas y componentes)
        │
        ▼
React Router + Tailwind → build estático → GitHub Pages
```

No hay backend: el seed es la fuente de verdad de la v1. El día que llegue Supabase, el contrato de
los repositorios permitirá cambiar el origen sin reescribir las pantallas.

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
- Estado agotado: badge, acción de WhatsApp deshabilitada y explicación.
- Selección reflejada en la URL (`?talla=M&color=Negro`).

### 6.4 WhatsApp

Módulo puro en `src/lib/whatsapp.ts`:

```ts
buildWhatsAppUrl(message, phone?)       // https://wa.me/<número>?text=<mensaje escapado>
buildOrderMessage(input)                // pedido completo con markdown de WhatsApp
buildOrderWhatsAppUrl(input)            // mensaje + enlace
buildProductInquiryMessage(input)       // consulta de una prenda
buildProductInquiryUrl(input)           // consulta + enlace
```

Características:

- Número ficticio de la tienda en una sola constante: `584125550134`.
- Mensajes con negritas (`*texto*`), listas y saltos de línea.
- `encodeURIComponent` para escapar acentos, saltos de línea, `#` y símbolos.
- Validación de pedidos sin código o sin prendas, y de números demasiado cortos.
- La consulta incluye prenda, talla, color y precio.
- El pedido incluye código, cliente, líneas con nombre/talla/color/cantidad/total, pago, entrega,
  agencia si aplica, total y nota opcional.

Interfaz `WhatsAppActions`:

- Acción principal “Consultar por WhatsApp”.
- Acción secundaria “Copiar mensaje” con confirmación visual.
- Si el navegador bloquea el portapapeles, muestra el mensaje completo en un campo de solo lectura
  para copiarlo a mano.
- El mismo componente recibirá el mensaje del pedido en confirmación y seguimiento.

### 6.5 Navegación y 404

- Layout con cabecera fija translúcida, contenido y pie.
- Enlace “Saltar al contenido” para teclado.
- Menú móvil con `aria-expanded`, `aria-controls` y cierre al navegar.
- Enlaces de sección que funcionan desde cualquier ruta (`BASE_URL#seccion`).
- 404 con copy propio y acción para volver al inicio.
- Título del documento por vista (`Catálogo · Norte Moda`, nombre del producto, etc.).

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

### Estado actual

| Comando             | Resultado                                               |
| ------------------- | ------------------------------------------------------- |
| `pnpm test`         | 81 pruebas en 8 archivos                                |
| `pnpm typecheck`    | 0 errores                                               |
| `pnpm lint`         | 0 errores, 0 advertencias                               |
| `pnpm format:check` | Todo formateado                                         |
| `pnpm build`        | 69 módulos; CSS 40,42 kB; JS 369,47 kB (115,06 kB gzip) |

### Distribución

| Archivo                                            | Pruebas | Qué cubre                                           |
| -------------------------------------------------- | ------- | --------------------------------------------------- |
| `domain/__tests__/money.test.ts`                   | 15      | Formato `es-VE`, centavos, sumas y validaciones     |
| `domain/__tests__/product.test.ts`                 | 21      | Variantes, stock, combinaciones y selección inicial |
| `domain/__tests__/seed.test.ts`                    | 10      | Integridad del catálogo                             |
| `domain/__tests__/catalog.test.ts`                 | 13      | Filtros, búsqueda sin acentos, orden y conteos      |
| `lib/__tests__/whatsapp.test.ts`                   | 10      | Mensajes, URL `wa.me`, escapado y validaciones      |
| `features/home/__tests__/home-page.test.tsx`       | 2       | Render de portada y 404                             |
| `features/catalog/__tests__/catalog-page.test.tsx` | 5       | Catálogo, URL, búsqueda, orden y vacío              |
| `features/product/__tests__/product-page.test.tsx` | 5       | Ficha, variante por URL, agotado e inexistente      |

Las pruebas de UI usan `renderToStaticMarkup` con `MemoryRouter`: verifican render y contenido sin
DOM simulado. Las interacciones se comprobaron además con Chrome headless contra el servidor local y
el sitio publicado.

### Verificaciones manuales con Chrome headless

- Catálogo: búsqueda `lino` → 5 resultados, foco conservado, URL actualizada.
- Catálogo: filtro `Vestidos` → 4 piezas; orden descendente $42 → $34.
- Ficha: selección inicial S/Blanco con 4 unidades.
- Ficha: clic en Negro → S/Negro con 2 unidades y XL deshabilitada.
- Ficha: clic en talla M → URL `?talla=M&color=Negro`, 3 unidades.
- Agotado: acción “Agotado por ahora”, sin enlace a WhatsApp.
- Portapapeles bloqueado en headless: aparece el campo manual con el mensaje completo.
- Móvil: `scrollWidth = 390` en portada, catálogo y ficha.

### Historial de pruebas por etapa

| Etapa    | Pruebas                                |
| -------- | -------------------------------------- |
| Sesión 1 | 0 (validación con tipos, lint y build) |
| Sesión 2 | 42                                     |
| Sesión 3 | 44                                     |
| Sesión 4 | 62                                     |
| Sesión 5 | 81                                     |

---

## 10. Despliegue

- **Repositorio público:** `ReinaldoGoCode/ProyectOne`.
- **GitHub Pages** configurado con `build_type: workflow`.
- **URL:** <https://reinaldogocode.github.io/ProyectOne/>.
- El workflow `.github/workflows/deploy.yml` corre en cada push a `main`:
  1. Instala pnpm y Node.
  2. `pnpm install --frozen-lockfile`.
  3. `pnpm check` (tipos, lint y 81 pruebas).
  4. `pnpm build` con `VITE_BASE_PATH=/ProyectOne/`.
  5. Genera `dist/404.html`.
  6. Publica el artefacto en Pages.
- El build copia `index.html` a `/catalogo` y a cada `/producto/:slug`, de modo que esos enlaces
  directos respondan **200**.
- Las rutas desconocidas reciben `404.html`, que renderiza la app con la página 404. Es una
  limitación de GitHub Pages: no hay reescritura de rutas.
- `VITE_BASE_PATH` mantiene la base `/` en local y `/ProyectOne/` en Pages.

Credenciales: el repositorio usa la credencial de Git configurada en la máquina; no hay secretos en
el código.

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
- 81 pruebas.

### Totales de Git

- 7 commits de desarrollo (sesiones 1 a 5) más el commit de esta documentación.
- +8.335 líneas, −352 líneas en los siete commits de desarrollo (suma de los `--shortstat`).
- Árbol limpio y sincronizado con `origin/main`.

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

1. **No hay carrito ni checkout.** La compra real no está implementada; la ficha solo permite
   consultar por WhatsApp.
2. **No hay pedidos.** `buildOrderMessage` está probado pero no montado en una confirmación. No se
   creó una pantalla ficticia de éxito.
3. **El stock se valida en el cliente.** Es correcto para la demo, pero no es autoritativo hasta que
   exista una transacción en Supabase.
4. **Sin panel administrativo.** No se pueden crear productos ni cambiar estados desde la app.
5. **Sin autenticación.** No hay cuentas ni roles.
6. **Sin pagos ni envíos integrados.** Todo se coordina a mano.
7. **Imágenes de placeholder.** Las siluetas SVG sustituyen a la fotografía.
8. **Rutas desconocidas con estado 404.** Pages no permite rewrites; las rutas conocidas sí son
   estáticas.
9. **Cobertura de UI parcial.** Las pruebas renderizan HTML; no hay E2E automatizado con navegador.
10. **Accesibilidad parcial.** Hay foco visible, etiquetas y contraste revisado, pero falta la
    auditoría completa con teclado y lector de pantalla (sesión 17).
11. **Solo tema claro.** No hay modo oscuro.
12. **Número de WhatsApp ficticio.** No se envía nada automáticamente.

---

## 15. Próximos pasos

| Sesión | Entregable                                                                 |
| ------ | -------------------------------------------------------------------------- |
| 6      | Carrito: reducer puro, cantidades, límites de stock y totales, con pruebas |
| 7      | UI del carrito, persistencia y revalidación contra el catálogo             |
| 8      | Checkout con React Hook Form y Zod: datos, entrega y pago                  |
| 9      | Creación de pedido, código único, confirmación y WhatsApp del pedido       |
| 10     | Consulta de pedido por código y estados                                    |
| 11-13  | Panel de productos y variantes                                             |
| 14-15  | Panel de pedidos, transiciones e historial                                 |
| 16     | Resumen y reinicio de datos demo                                           |
| 17     | Accesibilidad, responsive y estados de carga/error                         |
| 18     | Pruebas de flujo, README final, build y guion de demo                      |
| Futuro | Supabase, autenticación, RLS, imágenes y tasa de cambio                    |

Para cerrar el flujo de WhatsApp de punta a punta hace falta el bloque **carrito → checkout →
confirmación**. El mensaje de pedido ya está listo; solo falta pasarle un `Order` real a
`WhatsAppActions`.

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
pnpm test         # 81 pruebas
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

Cada push ejecuta el workflow, verifica y publica en GitHub Pages. Si falla la verificación, no se
despliega.

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
