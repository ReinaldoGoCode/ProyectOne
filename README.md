# Norte Moda

Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio construido
por etapas, con datos ficticios y sin integraciones reales.

> **Estado:** sesión 5 de 18 completada. Ficha de producto con selector de talla y color, stock por
> variante y módulo de WhatsApp listo. La confirmación de pedido llega con el carrito y el checkout
> (sesiones 6 a 10).

**En vivo:** <https://reinaldogocode.github.io/ProyectOne/>

---

## Qué es y qué no es

Norte Moda modela el flujo real de un comercio pequeño que hoy vende por Instagram y WhatsApp:
catálogo con tallas y colores, carrito, creación de pedidos y un panel donde el dueño registra el
pago y el despacho a mano.

**Sí incluye (cuando el proyecto esté completo):**

- Catálogo con categorías y variantes de talla y color.
- Carrito con cantidades, subtotal y totales.
- Checkout como invitado y consulta de pedido por código.
- Panel administrativo de productos y pedidos.
- Estados de pago y de entrega con historial de cambios.
- Un adaptador de datos intercambiable: `localStorage` hoy, Supabase en una fase posterior.

**No incluye, ni lo simula:**

- Pagos reales ni confirmación bancaria automática.
- Integraciones con MRW, ZOOM ni ninguna agencia de envío.
- Automatización oficial de WhatsApp.
- Cuentas de cliente, cupones, tasas de cambio automáticas ni subida de imágenes.
- Datos de personas o comercios reales.

---

## Stack

| Pieza        | Versión | Nota                                             |
| ------------ | ------- | ------------------------------------------------ |
| React        | 19.3    | Sin framework meta; Vite como bundler            |
| TypeScript   | 5.9     | Modo `strict` más comprobaciones extra           |
| Vite         | 7.3     | Alias `@/` hacia `src/`                          |
| React Router | 7.18    | Router de datos con `basename` desde Vite        |
| Tailwind CSS | 4.3     | Plugin oficial de Vite, sin `tailwind.config.js` |
| ESLint       | 10.13   | Configuración plana y reglas con tipos           |
| Prettier     | 3.9     | Formato único para TS, CSS, JSON y Markdown      |
| Vitest       | 5.0     | Pruebas de dominio y humo de interfaz            |
| pnpm         | 11.28   | Gestor de paquetes del proyecto                  |

La versión de TypeScript está fijada en la rama 5.9 (`~5.9.3`) porque `typescript-eslint` declara
soporte hasta `<6.1.0`. Actualizarla sin revisar el lint rompería el análisis con tipos.

---

## Requisitos

- Node.js 22.12 o superior (probado con Node 24).
- pnpm 11. Si no lo tienes: `corepack enable && corepack prepare pnpm@11.28.5 --activate`.

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

La aplicación queda en <http://localhost:5173>. El puerto es fijo (`strictPort`): si está ocupado,
Vite falla en lugar de saltar a otro puerto y dejar una URL distinta a la documentada.

## Scripts

| Comando             | Qué hace                                        |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo con recarga en caliente  |
| `pnpm build`        | `tsc --noEmit` y build de producción en `dist/` |
| `pnpm preview`      | Sirve el build de producción                    |
| `pnpm typecheck`    | Solo la comprobación de tipos                   |
| `pnpm lint`         | ESLint con cero advertencias permitidas         |
| `pnpm lint:fix`     | ESLint con corrección automática                |
| `pnpm format`       | Prettier sobre todo el proyecto                 |
| `pnpm format:check` | Verifica el formato sin escribir                |
| `pnpm test`         | Vitest una vez y termina                        |
| `pnpm test:watch`   | Vitest en modo interactivo                      |
| `pnpm check`        | Tipos, lint y pruebas en secuencia              |

Antes de cada commit conviene ejecutar `pnpm check && pnpm format:check`.

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: instala dependencias, corre
`pnpm check`, construye el sitio y lo publica en GitHub Pages.

**URL:** <https://reinaldogocode.github.io/ProyectOne/>

Pages sirve el proyecto bajo el nombre del repositorio, así que el workflow define
`VITE_BASE_PATH=/ProyectOne/`. En local la variable no existe y la aplicación vive en `/`.

Como Pages no permite reescribir rutas, el build copia `index.html` a `/catalogo` y a cada
`/producto/:slug`, de modo que esos enlaces directos respondan 200. El workflow copia además
`index.html` a `404.html` para que cualquier otra ruta profunda renderice la aplicación; esas rutas
siguen respondiendo con estado 404, una limitación de Pages que no afecta la navegación interna.

## Catálogo

`/catalogo` lista las 20 piezas activas (la vigésimo primera está desactivada) y guarda el estado de
los filtros en la URL:

| Parámetro   | Valores                                                | Ejemplo               |
| ----------- | ------------------------------------------------------ | --------------------- |
| `categoria` | slug de la categoría                                   | `?categoria=vestidos` |
| `q`         | texto libre, sin distinguir acentos                    | `?q=lino`             |
| `orden`     | `novedades` (por defecto), `precio-asc`, `precio-desc` | `?orden=precio-asc`   |

Los tres se combinan: `/catalogo?categoria=vestidos&orden=precio-asc`. Cada cambio usa `replace` para
no llenar el historial y `preventScrollReset` para no saltar mientras se escribe. La búsqueda recorre
nombre, descripción, categoría y colores de las variantes.

## Ficha de producto

`/producto/:slug` muestra la prenda, el precio, la composición, los cuidados y la selección de talla
y color. Las tarjetas del catálogo ya enlazan aquí.

- La selección vive en la URL (`?talla=M&color=Negro`), así que se puede compartir y recargar.
- Las tallas agotadas para el color elegido se deshabilitan con `disabled` y se tachan; los colores
  sin stock en ninguna talla también.
- Al cambiar de color, si la talla actual no existe, se elige la primera talla disponible.
- La silueta de la prenda toma el color de la variante y el stock se anuncia con `aria-live`.
- Si todo está agotado, la acción de WhatsApp se desactiva y la página lo explica.

## WhatsApp

[`src/lib/whatsapp.ts`](src/lib/whatsapp.ts) concentra los mensajes y enlaces, sin API oficial ni
automatización:

- `buildProductInquiryMessage` y `buildProductInquiryUrl` arman la consulta de una prenda con talla,
  color y precio.
- `buildOrderMessage` y `buildOrderWhatsAppUrl` arman el pedido completo: código, cliente, líneas,
  pago, entrega, total y nota opcional.
- `STORE_WHATSAPP_NUMBER` es un número ficticio y el único lugar donde vive.
- `encodeURIComponent` escapa saltos de línea, acentos, `#` y cualquier carácter que rompería la URL.

La ficha usa `WhatsAppActions`: acción principal prominente, botón secundario para copiar el mensaje
y confirmación visual al copiar. Si el navegador bloquea el portapapeles, se muestra el mensaje
completo en un campo de solo lectura para copiarlo a mano. El mismo componente recibirá el mensaje del
pedido en la confirmación y el seguimiento, cuando esas pantallas existan. No se creó una
confirmación ficticia: los pedidos reales llegan con el carrito y el checkout.

---

## Estructura

```text
norte-moda/
├─ .github/workflows/deploy.yml
├─ docs/
│  ├─ 01-alcance.md          # problema, requisitos, flujos y criterios de aceptación
│  └─ 03-decisiones.md       # registro de decisiones técnicas (ADR)
├─ public/
│  ├─ favicon.svg
│  └─ images/products/placeholder.svg
├─ src/
│  ├─ app/
│  │  ├─ layouts/StoreLayout.tsx   # cabecera, contenido, pie y restauración de scroll
│  │  └─ router.tsx                # rutas y basename según el entorno
│  ├─ components/
│  │  ├─ layout/                   # SiteHeader y SiteFooter
│  │  └─ ui/                       # GarmentArt, ProductCard, WhatsAppActions y botones
│  ├─ data/
│  │  ├─ seed/                     # categorías, productos y variantes ficticias
│  │  └─ repositories/             # interfaces y adaptadores de persistencia
│  ├─ domain/                      # TypeScript puro: tipos, dinero, stock y filtros
│  │  ├─ types.ts
│  │  ├─ money.ts
│  │  ├─ product.ts                # stock, combinaciones y selección de variantes
│  │  ├─ catalog.ts                # búsqueda, filtro por categoría y orden
│  │  └─ __tests__/
│  ├─ features/
│  │  ├─ home/                     # Hero, selección, relato y proceso
│  │  ├─ not-found/                # página 404
│  │  ├─ catalog/                  # grilla, controles y estado en la URL
│  │  ├─ product/                  # ficha, selector de variantes y stock
│  │  ├─ cart/                     # sesiones 6 y 7
│  │  ├─ checkout/                 # sesiones 8 a 10
│  │  └─ admin/                    # sesiones 11 a 16
│  ├─ hooks/                       # useDocumentTitle
│  ├─ lib/                         # colores, rutas base y whatsapp.ts
│  ├─ styles/index.css             # Tailwind, tokens y animaciones
│  ├─ main.tsx
│  └─ vite-env.d.ts
├─ eslint.config.js
├─ index.html
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ vite.config.ts
```

Las carpetas que todavía no tienen contenido llevan un `.gitkeep`. Cada una recibe su código en la
sesión que le corresponde; no hay módulos de relleno.

### Por qué esta separación

- `domain/` no importa React ni Supabase. Ahí viven los totales, el stock y las transiciones de
  estado, y ahí se concentran los tests.
- `data/repositories/` aísla el acceso a datos. Cambiar `localStorage` por Supabase será agregar un
  adaptador, no reescribir pantallas.
- `features/` agrupa por capacidad de negocio, no por tipo de archivo.
- `components/ui/` es presentacional puro, reutilizable entre tienda y panel.
- `lib/` contiene utilidades sin estado que no son dominio: colores de presentación, enlaces base.

El detalle de cada decisión está en [`docs/03-decisiones.md`](docs/03-decisiones.md).

---

## Diseño de interfaz

La interfaz sigue un criterio editorial y minimalista, con la jerarquía y el movimiento como
herramientas principales:

- **Tipografía.** Una sola familia del sistema, sin fuentes externas. La jerarquía se construye con
  tamaño, peso, interletrado negativo en titulares y versalitas espaciadas para los rótulos.
- **Color.** Papel cálido (`--color-paper`), tinta (`--color-ink`), arena (`--color-sand`) y una
  escala terracota de marca. Los tokens viven en `src/styles/index.css`, no en valores sueltos.
- **Espacio.** Contenedor de 6xl, secciones con 80–112 px de aire y separadores de 1 px al 6–10 %.
- **Movimiento.** Entradas `rise` y `fade` con easing suave y retardos escalonados; botones con
  `active:scale-[0.97]`, subrayado progresivo en la navegación y una hamburguesa que se convierte en
  cruz. Todo se desactiva con `prefers-reduced-motion`.
- **Imágenes.** Siluetas SVG por categoría y color, sin red ni fotos de stock. Son un sustituto
  temporal de la fotografía y se reemplazan cuando exista material real.
- **Responsive.** Verificado a 390 px y 1440 px sin desbordamiento horizontal. En móvil la navegación
  se resuelve con un menú desplegable accesible.
- **Guías de Apple.** Se instaló el skill `apple-design` y se aplicaron sus reglas para este tipo de
  pantalla: búsqueda que arranca al escribir con icono y botón de limpiar (`search-fields.md › Best
practices`), scope bar para acotar por categoría, grilla estándar con padding suficiente
  (`collections.md › Best practices`), movimiento breve solo en acciones explícitas
  (`motion.md › Best practices`) y áreas táctiles de 44 pt.

## Modelo de datos

| Entidad            | Qué representa                                                        |
| ------------------ | --------------------------------------------------------------------- |
| `Category`         | Agrupación del catálogo; su `slug` viaja en la URL                    |
| `Product`          | Prenda con precio en centavos, categoría y estado activo              |
| `Variant`          | Combinación vendible de talla y color, con SKU y stock                |
| `CartLine`         | Solo `variantId` y cantidad; el precio se resuelve contra el catálogo |
| `Order`            | Pedido con datos del comprador, totales y dos ejes de estado          |
| `OrderItem`        | Línea congelada: nombre, talla, color y precio del momento de compra  |
| `OrderStatusEvent` | Cambio de estado de pago o de entrega, con fecha y nota               |

Reglas que sostienen el modelo:

- El dinero se guarda en centavos enteros y solo se formatea al mostrarlo.
- El carrito no guarda precios; el pedido sí los congela.
- Pago y entrega son estados independientes, no un único `status`.
- Los identificadores de producto son su `slug`; el de cada variante se deriva del producto, el
  color y la talla.

## Pruebas

`pnpm test` ejecuta 81 pruebas en ocho archivos, con Vitest en entorno Node:

- `money.test.ts`: formato `es-VE`, rechazo de montos inválidos y sumas sin coma flotante.
- `product.test.ts`: variantes, stock, disponibilidad y selección inicial.
- `seed.test.ts`: integridad del catálogo (ids, SKU, categorías, precios y stock).
- `catalog.test.ts`: filtro por categoría, búsqueda sin acentos, orden y conteos.
- `whatsapp.test.ts`: mensaje de pedido, consulta de prenda, escapado y números inválidos.
- `home-page.test.tsx`: renderizado de la portada con datos del seed y de la página 404.
- `catalog-page.test.tsx`: grilla completa, filtro por URL, búsqueda, orden y estado vacío.
- `product-page.test.tsx`: ficha, selección por URL, combinaciones agotadas y producto inexistente.

Las pruebas de interfaz usan `renderToStaticMarkup`: verifican que la página renderiza y contiene lo
esperado, sin necesidad de un DOM simulado. Las interacciones de variantes se verificaron además en
Chrome headless contra el servidor de desarrollo y el sitio publicado.

---

## Criterios de código

- `strict` activo, más `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`, `noUnusedLocals` y `noUnusedParameters`.
- Prohibido `any` explícito; el lint con tipos lo señala.
- Importaciones de tipos con `import type` (`verbatimModuleSyntax`).
- Dinero siempre en centavos enteros. Nunca `number` con decimales para precios.
- Componentes pequeños y con una sola responsabilidad; la lógica pesada va a `domain/`.
- Cada regla de dominio nueva llega con su prueba; `pnpm check` las corre todas.
- Textos de interfaz y nombres de dominio en español; nombres de API técnica en inglés cuando
  corresponda.

## Convenciones de Git

- Ramas por etapa: `feat/sesion-01-base`, `feat/sesion-02-modelo-datos`, etc.
- Commits convencionales en español: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- `main` siempre compila: `build`, `lint`, `test` y `format:check` en verde.

## Datos y privacidad

Todos los productos, precios, clientes y pedidos son inventados. La taxonomía y los rangos de precio
se inspiran en tiendas de ropa de tamaño medio; los nombres, descripciones, precios y combinaciones
son propios de Norte Moda. No se copiaron productos ni marcas, y el proyecto no está afiliado a
ninguna tienda. No se recogen datos de usuarios ni se envía información a servicios externos.

## Próxima sesión

Sesión 6: estado del carrito con reducer puro, cantidades y totales, con pruebas. Después, checkout y
creación de pedido para poder montar el mensaje de WhatsApp de pedido en la confirmación y el
seguimiento.

## Licencia

Proyecto de portafolio, sin fines comerciales.
