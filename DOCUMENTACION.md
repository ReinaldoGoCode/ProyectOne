# Norte Moda — Documentación completa

> Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio con datos
> ficticios. El repositorio contiene configuración de despliegue para GitHub Pages.
>
> **Última actualización:** 2026-10-20 · **Versión de la aplicación:** 0.5.0 · **Copia de trabajo:** esta carpeta no contiene metadatos `.git`.
>
> **Sitio publicado anteriormente:** <https://reinaldogocode.github.io/ProyectOne/>. Esta copia de trabajo incluye cambios locales que aún no se han publicado.
>
> **Repositorio:** <https://github.com/ReinaldoGoCode/ProyectOne>

---

## 1. Resumen ejecutivo

Norte Moda es una tienda conceptual para mostrar un flujo comercial completo dentro de una
demostración local: catálogo, selección de variantes, carrito, checkout, creación y consulta de
pedidos, y panel de productos y pedidos. Los datos son ficticios; pago y entrega se actualizan a mano.

La implementación actual incluye:

- Base técnica con React 19, TypeScript estricto, Vite 7 y Tailwind 4.
- Modelo de dominio con dinero en centavos y dos ejes de estado para pedidos.
- Catálogo ficticio de 6 categorías, 21 prendas y 171 variantes.
- Portada editorial, catálogo con filtros/búsqueda/orden y página 404.
- Ficha de producto con selector de talla y color, stock y combinaciones agotadas deshabilitadas.
- Persistencia local tipada para catálogo, carrito y pedidos, con recuperación ante datos dañados.
- Checkout de invitado y consulta de pedidos por código en el mismo navegador.
- Panel demo para productos, variantes, stock, estados de pago y entrega con historial.
- Suite de pruebas de dominio, repositorios, interfaz y flujo de compra.

No hay backend compartido, autenticación de producción, pagos ni envíos reales. Los pedidos y cambios
locales no se comparten entre dispositivos.

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
- Creación de pedidos con código, precios y descripciones congelados y confirmación local.
- Consulta de pedido por código con estados separados, historial y resumen copiable.
- Panel local para productos, variantes, SKU, stock y pedidos.
- Persistencia local con validación de datos y opción para restaurar la demo.
- Página 404 y navegación completa entre portada, catálogo y ficha.
- Datos ficticios centralizados y pruebas de integridad del seed.
- Workflow configurado para verificar, construir y desplegar cuando se publica desde `main`.

### Pendiente para producción

- Backend compartido, transacciones y reserva de inventario.
- Autenticación real, roles y políticas de acceso del servidor.
- Pagos, despacho y seguimiento con proveedores configurados y revisados.
- Almacenamiento de imágenes y proceso de privacidad para datos de clientes.
- E2E con Playwright y auditoría completa de accesibilidad con tecnologías de asistencia.

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
│  │  └─ repositories/              # localStorage tipado y recuperación
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
│  │  ├─ cart/                      # resumen y edición del carrito
│  │  ├─ checkout/                  # validación y creación del pedido
│  │  ├─ order-tracking/            # consulta local por código
│  │  └─ admin/                     # productos, variantes y pedidos
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

- 21 ADR documentados.

### 5.2 Capas y reglas

| Capa                 | Responsabilidad                                      | Regla                             |
| -------------------- | ---------------------------------------------------- | --------------------------------- |
| `domain/`            | Tipos, dinero, stock, filtros y transiciones         | No importa React ni Supabase      |
| `data/seed/`         | Catálogo ficticio y expansión de variantes           | Datos puros, sin lógica de UI     |
| `data/repositories/` | Adaptadores tipados sobre `localStorage`             | Validar datos al leer y escribir  |
| `features/`          | Capacidades de negocio (catálogo, ficha, carrito...) | Componentes y páginas por dominio |
| `components/ui/`     | Presentación reutilizable                            | Sin reglas de negocio             |
| `lib/`               | Utilidades sin estado                                | WhatsApp, colores, rutas base     |
| `app/`               | Router, layout y composición                         | Punto de entrada de las páginas   |

Reglas transversales:

- Dinero siempre en centavos enteros; formatear solo al mostrar.
- El carrito guarda `variantId` y cantidad, no precios; el pedido congela los datos del catálogo.
- Pago y entrega son dos ejes independientes, no un único estado.
- La lógica nueva de dominio se prueba antes de conectarla a la UI.
- Sin `any` explícito y sin `@ts-ignore` sin justificar.

### 5.3 Rutas

| Ruta                     | Contenido                                         | Estado       |
| ------------------------ | ------------------------------------------------- | ------------ |
| `/`                      | Portada editorial con selección, relato y proceso | Implementada |
| `/catalogo`              | Catálogo con filtros, búsqueda y orden            | Implementada |
| `/producto/:slug`        | Ficha de producto y variantes                     | Implementada |
| `/carrito`               | Cantidades, subtotal y disponibilidad             | Implementada |
| `/checkout`              | Compra invitada y creación local                  | Implementada |
| `/pedido?codigo=NM-0001` | Consulta e historial del pedido                   | Implementada |
| `/admin/productos`       | Productos, variantes, SKU y stock                 | Implementada |
| `/admin/pedidos`         | Búsqueda, detalle y transiciones                  | Implementada |
| `*`                      | Página 404 dentro del layout                      | Implementada |

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
| `Order`            | código, cliente, entrega, pago, líneas, totales, dos estados, notas e historial                 |
| `OrderItem`        | datos congelados: nombre, talla, color, precio unitario y cantidad                              |
| `OrderStatusEvent` | unión discriminada por `axis` (`payment` o `fulfillment`)                                       |

Estados:

- **Pago:** `pendiente → por_verificar → pagado | rechazado`; `cancelado` como salida.
- **Entrega:** `nuevo → preparando → despachado → entregado`; `cancelado` como salida.

### 5.5 Flujo de datos actual

```text
seed + localStorage validado ←→ repositorios de catálogo, carrito y pedidos
        │                                   │
        ▼                                   ▼
domain/ (stock, importes, estados) ←→ providers de aplicación
        │                                   │
        └────── features (tienda, checkout, tracking, admin)
                            │
                            ▼
React Router + Tailwind → build estático → GitHub Pages
```

No hay backend compartido: el seed abastece el primer catálogo y `localStorage` conserva los cambios
de este navegador. Los precios se resuelven contra el catálogo actual al crear el pedido; el pedido
guarda después una copia histórica de sus líneas y totales.

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

Módulo puro en `src/lib/whatsapp.ts`:

Funciones en `src/lib/whatsapp.ts`: mensajes de pedido y producto, validación del número y enlace
`wa.me` con el texto codificado.

Características:

- `VITE_STORE_WHATSAPP_NUMBER` es opcional y queda vacío por defecto. No hay un teléfono ajeno ni
  ficticio hardcodeado.
- Mensajes con negritas (`*texto*`), listas y saltos de línea.
- `encodeURIComponent` para escapar acentos, saltos de línea, `#` y símbolos.
- Validación de pedidos sin código o sin prendas, y de números demasiado cortos.
- La consulta incluye prenda, talla, color y precio.
- El pedido incluye código, cliente, líneas con nombre/talla/color/cantidad/total, pago, entrega,
  agencia si aplica, total y nota opcional.

Interfaz `WhatsAppActions`:

- Si se configura explícitamente el teléfono de la tienda, abre el enlace con el mensaje listo.
- Sin configuración, solo muestra “Copiar mensaje” y avisa que está en modo demo.
- Si el navegador bloquea el portapapeles, muestra el mensaje completo en un campo de solo lectura
  para copiarlo a mano.
- La consulta del pedido ofrece un resumen copiable; no envía mensajes automáticamente.

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
- Genera el código `NM-####`, congela producto, variante y precio, e inicia pago y entrega por separado.
- Solo limpia el carrito y navega a confirmación si el pedido se guardó correctamente.
- Explica que no procesa pagos ni crea envíos.

### 6.8 Consulta del pedido (`/pedido?codigo=NM-0001`)

- Busca por código normalizado en los pedidos locales del navegador actual.
- Presenta artículos y totales congelados, pago previsto, pago actual y preparación/entrega.
- Muestra el historial por eje y deja copiar un resumen sin enviar datos a WhatsApp.
- Explica los códigos inexistentes y que los pedidos no se comparten entre navegadores.

### 6.9 Panel de administración (`/admin`)

- Crea y edita productos; activa o pausa su aparición en la tienda.
- Crea, edita y elimina variantes con talla, color, SKU único y stock entero no negativo.
- Busca y filtra pedidos; consulta sus líneas, totales, comprador y coordinación.
- Cambia pago y entrega en controles separados, solo mediante transiciones de dominio válidas.
- «Por verificar» registra recepción pendiente; «Pagado» requiere una acción posterior de revisión
  manual. No hay consulta bancaria ni señal del comprador que confirme un pago.
- Cada transición se agrega al historial. La entrega avanza en orden de preparación, despacho y
  entrega.
- Incluye restauración confirmada de los datos ficticios.
- Avisa que los datos son locales y que el panel no tiene autenticación ni protección de producción.

### 6.10 Persistencia local

- Repositorios separados para catálogo, carrito y pedidos; los componentes no llaman directamente a
  `localStorage`.
- Zod valida datos persistidos, totales congelados, referencias del catálogo, ids y códigos.
- Datos dañados se descartan o restauran desde el seed; el carrito se recorta al stock disponible.
- El estado sobrevive a recargas en el mismo navegador, pero no se comparte entre dispositivos.

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

| Comando             | Resultado                                              |
| ------------------- | ------------------------------------------------------ |
| `pnpm test`         | Correcto: 115 pruebas en 12 archivos                   |
| `pnpm typecheck`    | Correcto                                               |
| `pnpm lint`         | Correcto, sin advertencias                             |
| `pnpm format:check` | Correcto                                               |
| `pnpm build`        | Correcto; entrada principal 447,11 kB (138,43 kB gzip) |
| `pnpm check`        | Correcto: tipos, lint y 115 pruebas                    |

El build divide las pantallas por ruta y ya no genera un paquete de entrada por encima de 500 kB.
Rollup muestra avisos no bloqueantes al retirar anotaciones de comentarios de Zod 4.
En `vite preview`, las 29 rutas verificadas (inicio, rutas principales y 21 productos) respondieron
HTTP 200.

### Distribución

| Área de pruebas                                    | Cobertura                                                     |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `domain/__tests__/`                                | Dinero, catálogo, carrito, producto, pedidos y transiciones   |
| `data/repositories.test.ts`                        | Persistencia, validación y recuperación de datos dañados      |
| `features/home/__tests__/home-page.test.tsx`       | Render de portada y 404                                       |
| `features/catalog/__tests__/catalog-page.test.tsx` | Filtros, URL, búsqueda, orden y vacío                         |
| `features/product/__tests__/product-page.test.tsx` | Variantes, agotado e interacción segura de WhatsApp           |
| `features/checkout/checkout-flow.test.tsx`         | Añadir, modificar, checkout, guardar, consultar y administrar |

Las pruebas de humo usan `renderToStaticMarkup`; el recorrido comprador/administrador usa
Testing Library y jsdom. No se configuró Playwright ni una suite E2E en navegador real.

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
  4. `pnpm build` con `VITE_BASE_PATH=/ProyectOne/`.
  5. Genera `dist/404.html`.
  6. Publica el artefacto en Pages.
- El build copia `index.html` a `/catalogo`, `/carrito`, `/checkout`, `/pedido`, las rutas estáticas
  del panel y cada `/producto/:slug`, de modo que esas rutas respondan **200**.
- Las rutas desconocidas reciben `404.html`, que renderiza la app con la página 404. Es una
  limitación de GitHub Pages: no hay reescritura de rutas.
- `VITE_BASE_PATH` mantiene la base `/` en local y `/ProyectOne/` en Pages.

Esta copia de trabajo no contiene metadatos `.git`; por eso no se pudo comprobar su rama, comparar
cambios locales con el remoto ni publicar esta versión. La URL anterior puede seguir mostrando una
versión previa. No hay credenciales ni secretos de producción en el código.

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
- No se generó un commit. Esta copia de trabajo no incluye `.git`, así que no se pudo comparar
  cambios locales con un historial o rama.

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

1. **Almacenamiento local:** los datos quedan en `localStorage` de este navegador. No son pedidos
   compartidos y se pierden al limpiar los datos del sitio.
2. **Sin autoridad de servidor:** catálogo, stock, importes y estados solo se validan en el cliente.
   No hay transacciones ni reserva de stock entre pedidos o dispositivos.
3. **Panel sin autenticación:** cualquier persona que abra la ruta puede editar los datos locales.
   No debe recibir datos reales ni usarse para administrar un comercio.
4. **Pagos y entregas manuales:** no hay consulta bancaria, captura de comprobantes ni conexión con
   MRW, ZOOM o servicios de delivery. «Pagado» es un registro manual de la demo.
5. **WhatsApp opcional:** el número de `VITE_STORE_WHATSAPP_NUMBER` está vacío por defecto; se
   necesita configurar explícitamente el teléfono propio para abrir un enlace.
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

La siguiente fase es convertir la demo local en un sistema compartido. Requiere configurar Supabase
u otro backend, autenticación y autorización de servidor, transacciones de inventario, recuperación
de cuenta, privacidad/retención de datos y pruebas E2E. Los pagos, mensajería y envíos deben
integrarse solo con credenciales y proveedores autorizados.

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
pnpm test         # 115 pruebas en la verificación de esta entrega
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

Al ejecutar esta secuencia en un clon Git válido, un push a `main` inicia el workflow y publica en
GitHub Pages si pasan las verificaciones. Esta copia local no incluye `.git` y no se publicó desde
ella. Consulta la tabla de verificaciones para los resultados de esta entrega.

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
