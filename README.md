# Norte Moda

Tienda conceptual de ropa para pequeños comercios venezolanos. Proyecto de portafolio construido
por etapas, con datos ficticios y sin integraciones reales.

> **Estado:** sesión 2 de 18 completada. Modelo de datos, catálogo ficticio y 42 pruebas de dominio
> en verde; la interfaz del catálogo empieza en la sesión 3.

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
| Tailwind CSS | 4.3     | Plugin oficial de Vite, sin `tailwind.config.js` |
| ESLint       | 10.13   | Configuración plana y reglas con tipos           |
| Prettier     | 3.9     | Formato único para TS, CSS, JSON y Markdown      |
| Vitest       | 5.0     | Pruebas de dominio en entorno Node               |
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
`VITE_BASE_PATH=/ProyectOne/`. En local la variable no existe y la aplicación vive en `/`. El
workflow además copia `index.html` a `404.html` para que las rutas del cliente no devuelvan un 404
real al recargar.

---

## Estructura

```text
norte-moda/
├─ docs/
│  ├─ 01-alcance.md          # problema, requisitos, flujos y criterios de aceptación
│  └─ 03-decisiones.md       # registro de decisiones técnicas (ADR)
├─ public/
│  ├─ favicon.svg
│  └─ images/products/placeholder.svg
├─ src/
│  ├─ app/                   # router y providers (sesión 3 en adelante)
│  ├─ components/ui/         # componentes reutilizables sin lógica de negocio
│  ├─ data/
│  │  ├─ seed/
│  │  │  ├─ categories.ts    # las tres categorías ficticias
│  │  │  ├─ products.ts      # productos y expansión de variantes
│  │  │  └─ index.ts         # seedCatalog
│  │  └─ repositories/       # interfaces y adaptadores de persistencia
│  ├─ domain/
│  │  ├─ types.ts            # Category, Product, Variant, CartLine, Order...
│  │  ├─ money.ts            # centavos, formato es-VE, sumas y multiplicaciones
│  │  ├─ product.ts          # stock, tallas y colores
│  │  └─ __tests__/          # money, product y seed
│  ├─ features/
│  │  ├─ catalog/            # listado, filtros y búsqueda
│  │  ├─ product/            # detalle y selector de variantes
│  │  ├─ cart/               # carrito
│  │  ├─ checkout/           # formulario y creación del pedido
│  │  ├─ order-tracking/     # consulta de pedido por código
│  │  └─ admin/              # productos, pedidos y resumen
│  ├─ hooks/                 # hooks compartidos
│  ├─ lib/                   # utilidades sin estado (ids, formatos, guards)
│  ├─ styles/
│  │  └─ index.css           # Tailwind y tokens de diseño
│  ├─ App.tsx                # pantalla provisional hasta la sesión 3
│  ├─ main.tsx               # punto de entrada
│  └─ vite-env.d.ts
├─ eslint.config.js
├─ index.html
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ vite.config.ts
```

Las carpetas todavía vacías llevan un `.gitkeep` para que Git las conserve. Cada una recibe
contenido en la sesión que le corresponde; no hay módulos de relleno.

### Por qué esta separación

- `domain/` no importa React ni Supabase. Ahí viven los totales, el stock y las transiciones de
  estado, y ahí se concentran los tests.
- `data/repositories/` aísla el acceso a datos. Cambiar `localStorage` por Supabase será agregar un
  adaptador, no reescribir pantallas.
- `features/` agrupa por capacidad de negocio, no por tipo de archivo. Todo lo del carrito vive
  junto.
- `components/ui/` es presentacional puro, reutilizable entre tienda y panel.

El detalle de cada decisión y su motivo está en [`docs/03-decisiones.md`](docs/03-decisiones.md).

---

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
  color y la talla, de modo que el seed no repita datos a mano.

## Pruebas

`pnpm test` ejecuta 42 pruebas en tres archivos, con Vitest en entorno Node:

- `money.test.ts`: formato `es-VE`, rechazo de montos inválidos y sumas sin coma flotante.
- `product.test.ts`: búsqueda de variantes, stock, disponibilidad y listados para la interfaz.
- `seed.test.ts`: integridad del catálogo (ids, SKU, categorías, precios y stock).

Se prueba el dominio, no los componentes: todavía no hay interfaz que probar y las reglas son la
parte que más conviene blindar. Las pruebas de UI llegan cuando exista el flujo de compra.

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

Todos los productos, precios, clientes y pedidos son inventados. Cualquier parecido con un comercio
real es coincidencia. No se recogen datos de usuarios ni se envía información a servicios externos.

## Próxima sesión

Sesión 3: layout real, rutas con `react-router-dom`, portada con productos destacados y página 404.
El catálogo navegable llega en la sesión 4.

## Licencia

Proyecto de portafolio, sin fines comerciales.
