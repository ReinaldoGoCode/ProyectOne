# 01 · Alcance de Norte Moda (v1)

Documento aprobado antes de escribir código. Define qué se construye, para quién y cómo se
verifica. Cualquier cambio de alcance se anota aquí y se discute antes de implementarlo.

## 1. Problema

Un comercio pequeño de ropa en Venezuela vende por Instagram y WhatsApp. El catálogo vive en
publicaciones, el stock en la cabeza del dueño y el pedido en un chat. Eso produce:

- ventas de tallas o colores que ya no existen;
- totales calculados a mano y cobrados mal;
- pérdida de pedidos entre conversaciones;
- compradores preguntando varias veces por el estado de su compra.

Norte Moda modela ese flujo completo con datos ficticios. La verificación del pago y el despacho
siguen siendo humanos: el sistema solo los registra y los ordena.

## 2. Usuarios

| Usuario       | Contexto                                                 | Necesita                                                                             |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Comprador     | Móvil, datos limitados, llega desde un enlace            | Saber si su talla y color existen, ver el total exacto, dejar el pedido una sola vez |
| Administrador | Dueño o encargado, móvil o laptop, sin formación técnica | Cargar productos y stock rápido, ver pedidos nuevos, marcar pagado y despachado      |
| Visitante     | Solo curiosea                                            | Entender la tienda en segundos                                                       |
| Desarrollador | Portafolio                                               | Código que demuestre criterio, no solo pantallas                                     |

## 3. Requisitos funcionales

### Catálogo

- **RF-01** Listar productos activos con imagen, nombre, categoría, precio y disponibilidad.
- **RF-02** Filtrar por categoría (reflejado en la URL), buscar por nombre y ordenar por precio o
  novedad.
- **RF-03** Detalle con descripción, categoría, composición, cuidados y precio.
- **RF-04** Selector de talla y color derivado de variantes reales; combinaciones inexistentes o
  agotadas se muestran deshabilitadas.
- **RF-05** Mostrar stock de la variante elegida y bloquear la compra en cero.
- **RF-06** Precios en USD con formato `es-VE` y dos decimales.

### Carrito

- **RF-07** Agregar variante con cantidad; si existe, sumar.
- **RF-08** Editar cantidad y eliminar líneas sin superar el stock.
- **RF-09** Mostrar artículos, subtotal y total; el envío se suma en el checkout.
- **RF-10** Persistir en `localStorage` y revalidar precio y stock al cargar.
- **RF-11** Estado de carrito vacío con enlace al catálogo.

### Checkout y pedido

- **RF-12** Datos: nombre, apellido, cédula, teléfono, email opcional, estado, municipio, dirección
  y punto de referencia.
- **RF-13** Entrega: delivery local, envío nacional por agencia (la escribe el comprador) o retiro.
- **RF-14** Pago ficticio: Pago Móvil, transferencia o efectivo, con referencia opcional. Solo se
  registra la elección.
- **RF-15** Validación con Zod y mensajes en español.
- **RF-16** Revisión del pedido antes de confirmar.
- **RF-17** Código legible único (`NM-0001`) y estados iniciales `pago: pendiente` /
  `entrega: nuevo`.
- **RF-18** Confirmación con resumen y próximo paso en texto estático.
- **RF-19** Pedido consultable por código tras recargar.

### Panel de productos

- **RF-20** Listar con búsqueda y estado.
- **RF-21** Crear y editar producto: nombre, categoría, descripción, precio, imagen por URL, activo.
- **RF-22** Gestionar variantes (talla, color, SKU, stock) sin duplicar talla + color.
- **RF-23** Desactivar en lugar de borrar cuando hay pedidos asociados.
- **RF-24** Precio mayor que 0, stock entero mayor o igual a 0, SKU único.

### Panel de pedidos

- **RF-25** Listar con filtros por estado de pago y entrega, y búsqueda por código o cliente.
- **RF-26** Detalle con líneas congeladas (nombre, talla, color y precio del momento), totales y
  datos del comprador.
- **RF-27** Cambiar estados de pago y entrega por separado, solo con transiciones válidas.
- **RF-28** Nota interna e historial con fecha.
- **RF-29** Resumen mínimo: pedidos por estado y total vendido del período ficticio.

### Estados

- **RF-30** Pago: `pendiente → por_verificar → pagado | rechazado`; `cancelado` como salida.
- **RF-31** Entrega: `nuevo → preparando → despachado → entregado`; `cancelado` como salida.
- **RF-32** Historial inmutable con marca de tiempo.

### Transversal

- **RF-33** Rutas con 404 propio.
- **RF-34** Responsive de 360 px a 1440 px.
- **RF-35** Accesibilidad: labels, foco visible, contraste AA, teclado y `aria-live` en el carrito.
- **RF-36** Datos ficticios centralizados y reinicio de la demo desde el panel.
- **RF-37** Guard del panel ficticio y avisado como tal en la interfaz.

## 4. Requisitos no funcionales

| ID     | Requisito                                                     |
| ------ | ------------------------------------------------------------- |
| RNF-01 | TypeScript `strict`, sin `any` ni `@ts-ignore` sin justificar |
| RNF-02 | Reglas de negocio en `src/domain`, sin importar React         |
| RNF-03 | Dinero en centavos enteros                                    |
| RNF-04 | Acceso a datos detrás de una interfaz de repositorio          |
| RNF-05 | Tests de dominio con Vitest                                   |
| RNF-06 | Panel con carga diferida e imágenes con `loading="lazy"`      |
| RNF-07 | Sin librería de UI pesada                                     |
| RNF-08 | Interfaz en español y formatos `es-VE`                        |
| RNF-09 | README, commits convencionales y una rama por etapa           |
| RNF-10 | Ningún secreto en el cliente                                  |
| RNF-11 | Datos 100 % ficticios                                         |
| RNF-12 | Componentes pequeños y estado global mínimo                   |

## 5. Flujos

### Comprador

1. Llega a la tienda y filtra o busca.
2. Entra al detalle y elige talla y color entre las combinaciones disponibles.
3. Agrega al carrito y ajusta cantidades.
4. Completa el checkout: datos, entrega y método de pago.
5. Revisa el resumen y confirma.
6. Recibe un código, envía su comprobante por el canal de siempre y puede consultar el estado con
   ese código.

**Casos límite:** combinación agotada, stock insuficiente al revalidar, carrito vacío, código
inexistente.

### Administrador

1. Entra al panel (guard ficticio).
2. Crea o edita productos y variantes con stock.
3. Revisa pedidos nuevos y compara la referencia de pago por fuera del sistema.
4. Marca el pago como verificado y avanza la entrega.
5. Deja notas y consulta el historial.

Pago y entrega son dos ejes independientes: un pedido puede estar pagado y sin despachar, o
despachado con pago por verificar.

## 6. Criterios de aceptación

Verificables a mano, sin leer el código.

- **AC-01** Una combinación agotada se muestra deshabilitada y no se puede agregar.
- **AC-02** El filtro de categoría sobrevive a una recarga porque está en la URL.
- **AC-03** Un precio de 1999 centavos se muestra como `$19,99`.
- **AC-04** A 360 px no hay scroll horizontal en catálogo, detalle ni checkout.
- **AC-05** Agregar dos veces la misma variante produce una línea con cantidad 2.
- **AC-06** Con stock 3, la cantidad no pasa de 3 ni baja de 1; quitar es una acción explícita.
- **AC-07** Recargar conserva el carrito y el subtotal coincide con las líneas.
- **AC-08** Si cambia el precio, el carrito usa el nuevo y lo advierte.
- **AC-09** Carrito vacío muestra estado vacío con enlace al catálogo.
- **AC-10** Formulario vacío muestra errores en español y no crea nada.
- **AC-11** Teléfono con letras o cédula inválida se rechazan.
- **AC-12** Confirmar genera código único, vacía el carrito y muestra la confirmación.
- **AC-13** `/pedido/<código>` tras recargar muestra el mismo pedido.
- **AC-14** El pedido conserva precios y nombres del momento de la compra.
- **AC-15** Un código inexistente muestra un mensaje claro.
- **AC-16** `/admin` sin sesión ficticia redirige y el aviso de demo es visible.
- **AC-17** Un producto activo con stock 2 aparece en la tienda con stock 2.
- **AC-18** Dos variantes con la misma talla y color muestran error y no se guardan.
- **AC-19** Un pedido del checkout aparece en el panel con el mismo total.
- **AC-20** `entregado → nuevo` y `pendiente → pagado` no están disponibles y tienen test.
- **AC-21** Cambiar estado agrega una entrada al historial sin modificar las anteriores.
- **AC-22** Desactivar un producto no rompe los pedidos que lo contienen.
- **AC-23** `typecheck`, lint y tests pasan en limpio.
- **AC-24** El flujo compra → panel → cambio de estado se completa solo con teclado.
- **AC-25** El build de producción compila y la demo se reproduce en menos de 5 minutos.

## 7. Fuera de alcance en v1

Pagos reales, confirmación bancaria automática, integraciones con MRW o ZOOM, automatización oficial
de WhatsApp, cuentas de cliente, cupones, tasas de cambio automáticas y subida de imágenes a
Storage.

## 8. Plan de sesiones (1 hora cada una)

| #   | Foco     | Entregable                                                            |
| --- | -------- | --------------------------------------------------------------------- |
| 1   | Base     | Vite, React, TypeScript estricto, Tailwind, lint, estructura y README |
| 2   | Modelo   | Tipos, dinero en centavos, seed de productos y primeros tests         |
| 3   | Catálogo | Layout, rutas, home y 404                                             |
| 4   | Catálogo | Grid, filtro por categoría, búsqueda y orden                          |
| 5   | Catálogo | Detalle con selector de talla y color                                 |
| 6   | Carrito  | Reducer, selectores y tests                                           |
| 7   | Carrito  | Interfaz, persistencia y revalidación                                 |
| 8   | Checkout | Formulario con Zod, entrega y pago                                    |
| 9   | Checkout | Creación de pedido y confirmación                                     |
| 10  | Checkout | Consulta por código y estados de error                                |
| 11  | Panel    | Shell, guard ficticio y tabla de productos                            |
| 12  | Panel    | Formulario de producto                                                |
| 13  | Panel    | Editor de variantes                                                   |
| 14  | Panel    | Lista y detalle de pedidos                                            |
| 15  | Panel    | Transiciones de estado, historial y notas                             |
| 16  | Panel    | Resumen y reinicio de datos                                           |
| 17  | Cierre   | Accesibilidad, responsive y estados de carga                          |
| 18  | Cierre   | Tests de flujos, README final, build y despliegue                     |

Las sesiones 1 a 15 forman el mínimo defendible. La 16 es deseable; la 17 y la 18 no deberían
recortarse porque son las que vuelven presentable el proyecto.

## 9. Supuestos confirmados

1. Solo USD con dos decimales; sin bolívares ni tasa en v1.
2. El stock se descuenta al confirmar el pedido y se valida en el cliente; no es autoritativo hasta
   Supabase y se documenta como limitación.
3. No hay cuentas de cliente: checkout como invitado y consulta por código.
4. El panel usa una contraseña de desarrollo y avisa que no hay seguridad real.
5. Envío con tarifa fija por método: local 3,00 / nacional 5,00 / retiro 0,00.
6. Tailwind con componentes propios, sin librería de UI.
