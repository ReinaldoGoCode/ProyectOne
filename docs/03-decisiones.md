# 03 · Registro de decisiones técnicas

Una entrada por decisión relevante: qué se decidió, por qué y qué implica. Se actualiza cuando una
decisión cambia, no cuando se implementa algo obvio.

| ID      | Decisión                                                    | Fecha      |
| ------- | ----------------------------------------------------------- | ---------- |
| ADR-001 | TypeScript 5.9 en lugar de 7                                | 2026-10-19 |
| ADR-002 | Una sola configuración de TypeScript                        | 2026-10-19 |
| ADR-003 | Tailwind 4 con plugin de Vite, sin archivo de configuración | 2026-10-19 |
| ADR-004 | Alias `@/` y puerto de desarrollo fijo                      | 2026-10-19 |
| ADR-005 | pnpm con `nodeLinker: hoisted`                              | 2026-10-19 |
| ADR-006 | Scripts de instalación desactivados de forma explícita      | 2026-10-19 |
| ADR-007 | ESLint con reglas que usan información de tipos             | 2026-10-19 |
| ADR-008 | Sin router ni test runner en la sesión 1                    | 2026-10-19 |
| ADR-009 | `App.tsx` es una pantalla provisional                       | 2026-10-19 |
| ADR-010 | Dinero en centavos enteros                                  | 2026-10-19 |
| ADR-011 | Pago y entrega como dos ejes de estado                      | 2026-10-19 |
| ADR-012 | Vitest en entorno Node y configuración compartida con Vite  | 2026-10-19 |
| ADR-013 | Seed declarativo con ids y SKU derivados                    | 2026-10-19 |
| ADR-014 | Router con base dinámica y enlaces de sección               | 2026-10-19 |
| ADR-015 | Sistema visual propio con siluetas SVG                      | 2026-10-19 |
| ADR-016 | Filtros del catálogo como estado de la URL                  | 2026-10-19 |
| ADR-017 | Catálogo verosímil sin copiar una marca                     | 2026-10-19 |
| ADR-018 | Reglas de Apple HIG aplicadas al catálogo                   | 2026-10-19 |
| ADR-019 | WhatsApp por enlace profundo, sin API ni automatización     | 2026-10-19 |
| ADR-020 | Selección de variantes en la URL y stock deshabilitado      | 2026-10-19 |
| ADR-021 | No inventar una confirmación de pedido para WhatsApp        | 2026-10-19 |

---

## ADR-001 · TypeScript 5.9 en lugar de 7

**Contexto.** El registro de npm ya publica TypeScript 7, la reescritura nativa del compilador.
`typescript-eslint` 8.71 declara compatibilidad con `>=4.8.4 <6.1.0`.

**Decisión.** Fijar `typescript` en `~5.9.3`.

**Consecuencia.** Se mantiene el análisis de ESLint con tipos, que es una de las garantías del
proyecto. Actualizar a TypeScript 7 exige esperar soporte de `typescript-eslint` y volver a validar
lint y build.

---

## ADR-002 · Una sola configuración de TypeScript

**Contexto.** La plantilla de Vite usa tres archivos (`tsconfig.json`, `tsconfig.app.json`,
`tsconfig.node.json`) con referencias de proyecto. Eso obliga a ejecutar `tsc -b` y hace que
`tsc --noEmit` no cubra todo.

**Decisión.** Un único `tsconfig.json` que incluye `src` y `vite.config.ts`.

**Consecuencia.** `pnpm typecheck` y `tsc --noEmit` cubren todo el código con un solo comando.
Contrapartida: los tipos de Node quedan visibles para el código de navegador. Se acepta porque el
`lib` sigue siendo DOM y el código de aplicación no usa APIs de Node; si el proyecto crece, se
puede dividir en configuraciones por entorno.

---

## ADR-003 · Tailwind 4 con plugin de Vite, sin archivo de configuración

**Contexto.** Tailwind 4 integra el escaneo de clases y los tokens en CSS mediante `@theme`.

**Decisión.** Usar `@tailwindcss/vite` y declarar el tema en `src/styles/index.css`. Sin
`tailwind.config.js` ni `postcss.config.js`.

**Consecuencia.** Una pieza menos que mantener y los tokens (colores de marca, tipografía) viven
junto a los estilos base. Los valores personalizados se usan como utilidades normales
(`bg-brand-900`).

---

## ADR-004 · Alias `@/` y puerto de desarrollo fijo

**Contexto.** Las rutas relativas profundas (`../../../domain/...`) son frágiles al mover archivos.

**Decisión.** Alias `@` hacia `src` en `vite.config.ts` y en `paths` de TypeScript. El servidor usa
`port: 5173` con `strictPort`.

**Consecuencia.** Las importaciones internas se leen igual desde cualquier profundidad. Si el puerto
está ocupado, el servidor falla en lugar de cambiar de URL silenciosamente.

---

## ADR-005 · pnpm con `nodeLinker: hoisted`

**Contexto.** En este entorno de Windows, los junctions que crea el linker aislado de pnpm no
resuelven al ejecutar binarios: `tsc`, `vite` y `eslint` fallaban con módulos no encontrados.

**Decisión.** `nodeLinker: hoisted` en `pnpm-workspace.yaml`, que produce una `node_modules` plana
equivalente a la de npm.

**Consecuencia.** El proyecto funciona sin depender de enlaces simbólicos. Se pierde el aislamiento
estricto entre dependencias transitivas, algo que no afecta a una aplicación y no a una librería
publicada.

---

## ADR-006 · Scripts de instalación desactivados de forma explícita

**Contexto.** pnpm 11 bloquea por defecto los scripts de instalación y falla si quedan pendientes de
aprobación. `esbuild` y `@tailwindcss/oxide` publican su binario nativo como dependencia opcional de
plataforma, así que su `postinstall` no es necesario para funcionar.

**Decisión.** `allowBuilds` con `esbuild: false` y `@tailwindcss/oxide: false`.

**Consecuencia.** `pnpm install` es determinista y no depende de poder lanzar procesos hijos. Si en
el futuro se agrega un paquete que sí requiera compilar, hay que aprobarlo de forma explícita.

---

## ADR-007 · ESLint con reglas que usan información de tipos

**Contexto.** Un lint sin tipos detecta estilo, pero no promesas sin manejar, `any` implícitos ni
comparaciones accidentales.

**Decisión.** `typescript-eslint` con `strictTypeChecked` y `stylisticTypeChecked`, más reglas de
hooks de React y de Fast Refresh. `pnpm lint` corre con `--max-warnings=0`.

**Consecuencia.** El lint es más lento y más exigente, pero coherente con el objetivo de tipado
estricto. Las reglas se ajustan solo con una razón documentada aquí.

---

## ADR-008 · Sin router ni test runner en la sesión 1

**Contexto.** Instalar dependencias antes de usarlas deja código y configuración sin propósito.

**Decisión.** `react-router-dom` y `vitest` se agregan en las sesiones que los necesitan (3 y 2,
respectivamente).

**Consecuencia.** La base no tiene dependencias muertas. Vitest entró en la sesión 2 y
`react-router-dom` en la 3. La estructura de carpetas ya reserva el lugar de cada pieza.

---

## ADR-009 · `App.tsx` es una pantalla provisional

**Contexto.** La sesión 1 debe demostrar que el stack compila, renderiza y aplica estilos.

**Decisión.** Una pantalla informativa con el estado del proyecto y los hitos por etapa, sin
productos ni botones que aparenten funcionalidad inexistente.

**Consecuencia.** No hay componentes de relleno ni enlaces muertos. La pantalla se reemplazó en la
sesión 3 por el layout real y la portada.

---

## ADR-010 · Dinero en centavos enteros

**Contexto.** Los precios con decimales flotantes producen errores de redondeo al sumar
(`0.1 + 0.2`).

**Decisión.** Guardar y operar precios como enteros en centavos (`priceCents`). Formatear solo al
mostrar, con `Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' })`.

**Consecuencia.** Las sumas son exactas y los tests comparan enteros. Se implementa desde la sesión
2, con las utilidades de `src/domain/money.ts`.

---

## ADR-011 · Pago y entrega como dos ejes de estado

**Contexto.** Un pedido puede estar pagado y sin despachar, o despachado con pago por verificar.

**Decisión.** Dos campos independientes (`paymentStatus` y `fulfillmentStatus`), cada uno con su
propio grafo de transiciones válidas e historial compartido.

**Consecuencia.** No existen estados combinados artificiales. La interfaz debe mostrar ambos ejes
por separado y el dominio debe rechazar transiciones inválidas con tests.

---

## ADR-012 · Vitest en entorno Node y configuración compartida con Vite

**Contexto.** Las reglas de dinero, stock y estados son la parte con más riesgo y no dependen del
DOM. En la sesión 2 todavía no había pantallas que probar.

**Decisión.** Vitest 5 con `environment: 'node'` y `test.include` limitado a
`src/**/*.test.{ts,tsx}`. La configuración vive en `vite.config.ts` usando `defineConfig` de
`vitest/config`, para compartir el alias y los plugins con el build. La interfaz se prueba con
`renderToStaticMarkup`, sin DOM simulado.

**Consecuencia.** Un solo archivo de configuración y pruebas que corren en menos de un segundo.
Contrapartida: `vite.config.ts` importa `vitest/config`, una dependencia de desarrollo, así que el
build necesita instalar `devDependencies` (lo normal en CI). Si eso se vuelve un problema, se separa
en `vitest.config.ts`.

---

## ADR-013 · Seed declarativo con ids y SKU derivados

**Contexto.** Diez productos con tres o cuatro tallas por color producen más de ochenta variantes.
Escribirlas a mano invita a duplicados y a SKU inconsistentes.

**Decisión.** Cada producto declara colores y stock por talla; una función constructora expande a
`Variant[]` con id derivado (`producto-color-talla`) y SKU (`NM-CODIGO-COLOR-TALLA`). El id del
producto es su slug.

**Consecuencia.** El seed se lee como una ficha de producto y no como una tabla. Los tests verifican
la unicidad de ids y SKU. Cambiar un slug cambia los identificadores del seed; en la fase Supabase
los ids serán UUID y el pedido ya congela los datos que importan.

---

## ADR-014 · Router con base dinámica y enlaces de sección

**Contexto.** En GitHub Pages el sitio vive bajo `/ProyectOne/`, mientras que en desarrollo vive en
`/`. Además, la navegación por anclas (`#seleccion`) solo funcionaba en la portada: desde la página
404 no llevaba a ninguna parte.

**Decisión.** `createBrowserRouter` con `basename` derivado de `import.meta.env.BASE_URL`, y un
helper `sectionHref(id)` que construye `${BASE_URL}#${id}` para que las anclas funcionen desde
cualquier ruta. El layout incluye `ScrollRestoration`.

**Consecuencia.** Los mismos enlaces funcionan en local y en Pages, y desde la 404 llevan a la
portada con la sección enfocada. Verificado: con el ancla `#seleccion` la página queda con la sección
a 96 px del borde superior, descontando la cabecera fija. Si cambia la ruta de publicación, se ajusta
una sola variable de entorno.

---

## ADR-015 · Sistema visual propio con siluetas SVG

**Contexto.** El proyecto no tiene fotografía ni presupuesto para imágenes de stock, y no quiere
depender de fuentes o CDN externos para verse bien. La interfaz debía sentirse cuidada desde la
primera sesión de diseño.

**Decisión.** Un sistema visual mínimo con tokens en CSS (papel, tinta, arena y escala terracota),
tipografía del sistema con jerarquía por tamaño y tracking, animaciones CSS con
`prefers-reduced-motion`, y siluetas SVG por categoría que toman el color real de la variante. Sin
librería de UI.

**Consecuencia.** Cero peticiones visuales externas y control total del bundle (≈37 kB de CSS y
≈359 kB de JS, 112 kB gzip). Las siluetas son un sustituto temporal de la fotografía: cuando existan
fotos, `GarmentArt` se reemplaza por una imagen sin tocar el resto del layout.

---

## ADR-016 · Filtros del catálogo como estado de la URL

**Contexto.** El catálogo necesita categoría, búsqueda y orden. Guardarlos solo en `useState` haría
que una recarga o un enlace compartido perdieran el contexto, y el botón Atrás no reflejaría lo que
la persona ve.

**Decisión.** `categoria`, `q` y `orden` son la única fuente de verdad y viven en la URL. Cada cambio
usa `setSearchParams` con `replace` y `preventScrollReset`; los enlaces de categoría usan
`preventScrollReset`. El filtrado se resuelve en `domain/catalog.ts` con `filterCatalog`, sin React.

**Consecuencia.** Los enlaces son compartibles y recargables, el historial no se llena con cada
tecla y la búsqueda conserva el foco. Con 21 productos el filtrado es inmediato. Cuando llegue
Supabase, la URL se mantiene y el filtrado se mueve a la consulta sin cambiar el contrato visible.

---

## ADR-017 · Catálogo verosímil sin copiar una marca

**Contexto.** Se pidió un catálogo de ropa real para dar verosimilitud al portafolio. Copiar nombres,
descripciones, precios o fotografías de una tienda conocida implicaría riesgo de marca y derechos de
autor, y sugeriría una afiliación que no existe.

**Decisión.** Usar la taxonomía y los rangos de precio de una tienda de ropa de tamaño medio
(camisas, camisetas, vestidos, pantalones, faldas y chaquetas) como referencia estructural, y
escribir un catálogo original: 6 categorías, 21 prendas y más de 170 variantes con nombres de
ciudades venezolanas, descripciones propias y precios plausibles.

**Consecuencia.** El catálogo se siente real sin apropiarse de una marca. Si un cliente real entrega
su inventario, el seed se reemplaza por sus datos y el resto de la aplicación no cambia.

---

## ADR-018 · Reglas de Apple HIG aplicadas al catálogo

**Contexto.** El skill `apple-design` reúne las Human Interface Guidelines y un criterio de oficio.
Para una pantalla de catálogo con búsqueda y filtros, las reglas relevantes son las de search
fields, collections, buttons y motion.

**Decisión.** Aplicar: búsqueda que empieza al escribir, con icono, placeholder y botón de limpiar;
scope bar de categorías con recuento; grilla estándar con separación suficiente; áreas táctiles de
44 pt; movimiento breve y solo en acciones explícitas; etiquetas de 11 px como mínimo; contraste de
texto secundario sobre papel de 4.6:1 o más; y `prefers-reduced-motion` respetado.

**Consecuencia.** La pantalla se comporta como un catálogo de plataforma: el foco se queda en el
campo mientras se filtra, el estado activo no depende solo del color y el resultado se anuncia con
`aria-live`. Verificado a 390 px y 1440 px, con foco conservado tras escribir y sin desbordamiento.

---

## ADR-019 · WhatsApp por enlace profundo, sin API ni automatización

**Contexto.** WhatsApp es el canal real de estos comercios, pero la automatización oficial queda fuera
de alcance. Hacía falta un puente simple entre la tienda y la conversación, sin backend ni claves.

**Decisión.** Un módulo puro (`src/lib/whatsapp.ts`) que construye el texto con el markdown de
WhatsApp (`*negrita*`) y devuelve `https://wa.me/<número>?text=<mensaje>` usando `encodeURIComponent`.
Dos entradas: consulta de una prenda y pedido completo (código, cliente, líneas congeladas, pago,
entrega y total). El número ficticio vive en una sola constante. La interfaz es `WhatsAppActions`:
acción principal prominente, botón para copiar, confirmación visual y, si el portapapeles está
bloqueado, el mensaje en un campo de solo lectura para copiarlo a mano.

**Consecuencia.** Funciona en móvil y escritorio sin API, sin credenciales y sin coste. El mensaje de
pedido queda cubierto por pruebas y listo para la confirmación; hoy solo se usa la consulta de prenda
porque todavía no existen pedidos.

---

## ADR-020 · Selección de variantes en la URL y stock deshabilitado

**Contexto.** AC-01 exige que las combinaciones agotadas se muestren deshabilitadas y no se puedan
elegir. Además, una selección de talla y color es compartible y debería sobrevivir a la recarga.

**Decisión.** `talla` y `color` viven en la URL (`?talla=M&color=Negro`) con `replace`. La selección
inicial es la primera combinación con stock en el orden del catálogo. Las tallas se deshabilitan para
el color elegido; los colores sin stock en ninguna talla se deshabilitan. Al cambiar de color, si la
talla actual no existe, se elige la primera disponible. El stock se anuncia con `aria-live`.

**Consecuencia.** Nunca se llega a una combinación inválida y la ficha se puede compartir con la
variante exacta. Un producto totalmente agotado deja la acción de WhatsApp deshabilitada.

---

## ADR-021 · No inventar una confirmación de pedido para WhatsApp

**Contexto.** Se pidió integrar el envío por WhatsApp en la página de éxito y en la consulta por
código. Esas pantallas dependen del carrito, el checkout y la persistencia de pedidos, que llegan en
las sesiones 6 a 10 y todavía no existen.

**Decisión.** Entregar el módulo y el componente completos, integrarlos en la ficha de producto con
una consulta real y dejar el mensaje de pedido probado y listo. No se crea una confirmación con un
pedido inventado ni una consulta por código vacía.

**Consecuencia.** La interfaz no promete nada que no pueda cumplir. Falta un cambio pequeño cuando
exista el pedido: pasar `buildOrderWhatsAppUrl(order)` a `WhatsAppActions` en la confirmación y el
seguimiento. Adelantar el carrito y el checkout es el siguiente paso natural.

---

## ADR-022 · Pago, pedido e inventario son estados separados

**Contexto.** La preparación no debe empezar solo porque exista un pedido o porque alguien marcó un comprobante como recibido.

**Decisión.** Mantener estados independientes de pedido, pago y entrega. Solo un administrador autenticado puede aprobar un pago en el backend. En esa transacción se vuelve a comprobar el stock; se descuenta si alcanza y se abre una incidencia si no alcanza. `preparando` exige pago aprobado y pedido confirmado. El checkout no aparta unidades.

**Consecuencia.** La ruta remota puede evitar sobreventa y dejar auditoría atómica. La demo local aplica las mismas reglas, pero `localStorage` no ofrece transacciones entre dispositivos ni autorización real.

---

## ADR-023 · Cotización de prueba marcada como ficticia

**Contexto.** La pantalla requiere mostrar USD y VES antes de contratar o validar un proveedor oficial.

**Decisión.** Mostrar una tasa fija de demostración, `40,00 Bs./USD`, con fuente `demo_ficticia`, fecha y vencimiento. Convertir usando decimales a céntimos; no leerla ni etiquetarla como BCV.

**Consecuencia.** El flujo puede probar formato y congelado de la cotización sin representar valores financieros vigentes. Se debe elegir una fuente oficial y una política de contingencia antes de ventas reales.

---

## ADR-024 · Backend preparado, no conectado ni publicado

**Contexto.** Faltan credenciales de Supabase, una cuenta administradora y configuración de Meta y del banco.

**Decisión.** Dejar migraciones, políticas RLS, funciones Edge y un gateway tipado, con modo demo local cuando falta configuración y modo remoto cuando existe. Validar el SQL con PGlite sin depender de Docker. Nunca incluir claves de servicio en `VITE_*`; no enviar mensajes ni pagos reales en esta fase.

**Consecuencia.** El repositorio contiene una base revisable y probada localmente, pero no debe describirse como una tienda remota ya activa. La versión de GitHub Pages sigue siendo una demostración estática y el backend requiere una prueba en Supabase Cloud.

---

## ADR-025 · Referencia de pago pública sin aprobación automática

**Contexto.** El comprador necesita informar el número de referencia de su pago desde el enlace privado, pero el sistema no puede verificar la llegada del dinero.

**Decisión.** Exponer `submit_public_payment_reference` solo a través de una Edge Function que exige código y token privado. La función guarda referencia y nota, deduplica y mueve el pago a `review`; `lookup_public_order` muestra la referencia. Ninguna ruta pública puede marcarlo como `paid`.

**Consecuencia.** El comprador tiene un paso claro y el administrador conserva la decisión. No se suben imágenes de comprobante; la verificación bancaria y la aprobación siguen siendo humanas.
