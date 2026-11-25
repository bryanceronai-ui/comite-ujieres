# Sistema de diseño — Comité de Ujieres · IPUE Barakaldo

Este documento recoge las reglas visuales y de interacción reales que utiliza la aplicación. Todos los colores, tamaños, alturas y patrones están pensados para ofrecer **alta legibilidad en tema oscuro** y **comodidad táctil** en ordenador, tablet y móvil.

---

## 1. Interfaz grande y tipografía base

- **Fuente principal**: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Fuente tabular numérica** (`.font-mono-tabular`): `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` con `font-variant-numeric: tabular-nums`. Se usa obligatoriamente en fechas, totales, teléfonos, contadores, años, ejes de gráficos y campos numéricos.
- **Letra base del cuerpo**: `17px` sobre fondo `#0d0f14` y texto `#e6e8ec`.
- **Campos de texto y selectores**: altura mínima `56px` (`min-h-[56px]`), relleno interno `16px`, texto `18px` en blanco (`#ffffff`), fondo `#12151b`, borde `#2d3340` y radio `12px`. Al enfocar, el borde pasa a `#F2A65A` (o `red-500` en campos de confirmación de borrado). Los campos numéricos grandes (p. ej. conteo de asistencia) suben a `28px` en negrita tabular.
- **Botones estándar**: altura mínima `52px` (`min-h-[52px]`), relleno horizontal `28px`, texto `17px`, radio `12px`, `whitespace-nowrap shrink-0` y ancho completo (`w-full`) en móvil pasando a ancho automático (`md:w-auto`) en escritorio.
- **Controles táctiles secundarios / iconos**: mínimo `44px × 44px` (`h-[44px]`) para cumplir comodidad táctil en tablet y móvil.

---

## 2. Barra superior con logo, migas de pan y crédito

### Pantalla de inicio
1. **Crédito superior izquierdo**: aparece **encima** de la fila del logotipo y el título, con separación inferior `8px` (`mb-2`):
   - Texto exacto: `‹ Creado por: Bryan Ceron`
   - Estilo: `14px`, peso normal (`400`), color `#6b7280` (hover `#9ca3af`), sin subrayado.
2. **Cabecera principal**: logotipo de IPUE Barakaldo (`110px × 110px` en móvil, `160px × 160px` en escritorio, `object-contain`) a la izquierda; junto a él, título `Comité de Ujieres` en `44px` negrita (`#F2A65A`) y subtítulo en `18px` (`#9ca3b0`).
3. **Pie de página**: nota informativa separada por borde superior `#1e222b` (`15px`, `#6f7685`) y, centrado debajo, el crédito `‹ Creado por: Bryan Ceron` en `15px` (`#9ca3af`).

### Vistas internas (barra superior fija)
- **Altura y borde**: `min-h-[84px]`, ancho máximo `1900px`, `px-[24px] py-2.5`, fondo `#0d0f14/95` y borde inferior `1px solid #1c2029`.
- **Migas de pan (`nav aria-label="Migas de pan"`)** a la izquierda:
  1. Botón con el logo (`52px × 52px` en móvil, `64px × 64px` en escritorio, `object-contain`, `rounded-full` para el anillo de foco) que vuelve al inicio.
  2. Enlace/botón `← Comité de Ujieres` en `17px` (`#9ca3b0`, hover `#ffffff`, `min-h-[44px]`).
  3. Separador `›` en `#555c6b`.
  4. Nombre de la vista actual en `font-semibold text-white`.
- **Lado derecho**: accesos rápidos al proyector cuando corresponde y el crédito `‹ Creado por: Bryan Ceron` (`hidden md:inline`, `14px`, `#6b7280`).
- **Documentos exportados (`Compartir turnos`)**: pie discreto con `Creado por: Bryan` (`20px`, `#6b7280` en oscuro / `#6b7280` en PDF claro).

---

## 3. Tarjetas de la pantalla de inicio

Las secciones (`ASISTENCIA`, `COMITÉ`) se titulan en `14px`, `font-semibold`, `tracking-wider`, color `#9ca3b0`, y se disponen en rejilla `grid-cols-1 md:grid-cols-3` con `gap-[24px]`.

Cada tarjeta (`min-h-[240px]`, `rounded-xl` = `12px`, `border-[#242832]`, `bg-[#1a1d24]`, `p-[28px]`) sigue **exactamente cuatro elementos**:
1. **Borde superior de color**: franja absoluta arriba de `3px` de alto (`h-[3px]`) del color de su módulo.
2. **Degradado superior sutil**: `linear-gradient(180deg, rgba(<color>, 0.06) 0%, rgba(26,29,36,0) 42%)`.
3. **Icono en recuadro**: caja de `64px × 64px`, `rounded-xl` (`12px`), tamaño de emoji `32px` con fondo tintado propio.
4. **Título y descripción**: título `24px font-bold text-white` (que cambia al color de acento en `:hover`) y descripción `17px leading-relaxed text-[#9ca3b0]`.

En `:hover`, la tarjeta se eleva `-2px` (`hover:-translate-y-0.5`) en `150ms` y su borde adopta el color de la tarjeta:

| Tarjeta | Color acento | Fondo recuadro icono | Degradado (`0% -> 42%`) |
| --- | --- | --- | --- |
| **Registro por reunión** | `#F2A65A` (naranja) | `#382d24` | `rgba(242,166,90,0.06)` -> transparente |
| **Gráficos** | `#E06C65` (rojo coral) | `#382426` | `rgba(224,108,101,0.06)` -> transparente |
| **Simpatizantes** | `#E8C547` (amarillo) | `#36311d` | `rgba(232,197,71,0.06)` -> transparente |
| **Turnos del comité** | `#4ADE80` (verde) | `#1e3429` | `rgba(74,222,128,0.06)` -> transparente |
| **Ruleta** | `#E8C547` (amarillo) | `#36311d` | `rgba(232,197,71,0.06)` -> transparente |

---

## 4. Paneles y contenedores

- **Disposición estándar de dos columnas**: contenedor `max-w-[1900px] px-[24px] py-6`; columna lateral fija en escritorio `md:w-[420px] md:shrink-0` (formularios o listados de miembros/tarjetas) + panel derecho fluido `flex-1 min-w-0`, separados por `gap-[24px]`.
- **Panel principal (`<section>`)**: `rounded-xl` (`12px`), `border border-[#242832]`, `bg-[#1a1d24]`, `p-[28px]`. Título de panel en `24px font-bold text-white`.
- **Sub-tarjetas internas** (miembro, tarjeta pendiente, opción de modal): `rounded-[12px]`, `border-[#282d39]` o `border-[#2d3340]`, fondo `#14171d`. Los elementos inactivos reducen su presencia con `bg-[#14171d]/50 opacity-60`.
- **Estados vacíos**: caja `rounded-xl` o `rounded-lg`, borde discontinuo `border-dashed border-[#2a2f3a]`, fondo `#14171d`, título `18px–19px` en `#d4d8e0` y texto de ayuda `15px–17px` en `#8a91a0`.

---

## 5. Chips y pestañas

- **Pestañas de filtro y selector de rangos** (`Próximos / Este mes / Todos`, `Hoy / Todos`, `7 días ... 365 días`, `Este mes / Próximo mes / Rango de fechas`):
  - Forma: pastilla (`rounded-full`), altura fija `46px` (`h-[46px]`), `px-5`, `text-[16px] font-medium`, `whitespace-nowrap shrink-0`.
  - **Estado activo**: `border-[#F2A65A] bg-[#F2A65A]/15 text-[#F2A65A]`.
  - **Estado inactivo**: `border-[#2d3340] bg-[#14171d] text-[#9ca3b0]` con hover a `text-white` (y `hover:border-[#41495b]` en gráficos).
- **Selector de modo segmentado** (`Simple` / `Por grupos` en Registro): rejilla de 2 columnas (`gap-2.5`), `h-[46px]`, `rounded-[12px]`, `text-[16px] font-semibold`; activo con `border-[#F2A65A] bg-[#F2A65A]/12 text-[#F2A65A]`.
- **Chips seleccionables de ujieres** (en añadir/editar turno y vista previa rotativa): botones en línea `rounded-full` o `rounded-[10px]` con estado activo resaltado en `#F2A65A`.

---

## 6. Tablas

- **Contenedor**: `mt-5 overflow-x-auto` con `w-full min-w-[760px]` (o `820px` / `600px`) y `border-collapse text-left text-[16px]`.
- **Cabecera (`thead`)**: borde inferior `border-[#242832]`, texto `14px font-semibold uppercase tracking-wider text-[#8a91a0]`, padding vertical `py-3.5`.
- **Cuerpo (`tbody`)**: divisores horizontales `divide-y divide-[#222630]`.
- **Celdas (`td`)**: relleno vertical `py-[18px]`, texto principal `#e6e8ec` / `#ffffff`, secundario `#9ca3b0` o `#c7ccd6`, notas en `15px text-[#858c9b]`.
- **Estados de fila**:
  - Hover normal: `hover:bg-[#20242d]` (o `hover:bg-[#222731]`).
  - Fila del día (`hoy` en Simpatizantes): `bg-[#F2A65A]/[0.08]`.
  - Fila en edición (Registro): `bg-[#F2A65A]/[0.06]`.
  - Turno pasado (`fecha < hoy`): `opacity-55`.

---

## 7. Botones (Principal, Secundario, Peligro y Acción)

| Variante | Clases / Valores exactos | Uso |
| --- | --- | --- |
| **Principal** | `min-h-[52px] rounded-[12px] bg-[#F2A65A] px-[28px] text-[17px] font-semibold text-[#111318] hover:bg-[#f5b473]` | Guardar, Añadir turno, Confirmar, Girar ruleta (`shadow-lg`), Descargar PNG (`min-h-[54px] shadow-lg shadow-[#F2A65A]/20`). |
| **Acento contorno** | `min-h-[52px] rounded-[12px] border border-[#F2A65A] bg-[#F2A65A]/10 px-[28px] text-[17px] font-medium text-[#F2A65A] hover:bg-[#F2A65A]/20` | *Compartir turnos*, botones de acción destacada secundaria. |
| **Secundario** | `min-h-[52px] rounded-[12px] border border-[#2d3340] bg-[#222630] px-[28px] text-[17px] font-medium text-[#e6e8ec] (o #d4d8e0) hover:bg-[#2a2f3c]` | Cancelar, Generar turnos rotativos, PDF, acciones neutras. |
| **Peligro (botón barra)** | `min-h-[52px] rounded-[12px] border border-red-500/35 bg-red-500/10 px-[28px] text-[17px] font-medium text-red-300 hover:border-red-500/60 hover:bg-red-500/20` | *Vaciar para el próximo mes*. |
| **Peligro (confirmación)** | `min-h-[52px] rounded-[12px] bg-red-600 px-[28px] text-[17px] font-semibold text-white hover:bg-red-500 disabled:opacity-40` | Botón *Eliminar* / *Borrar* dentro de modales de confirmación. |
| **Botón de acción / icono en fila** | `h-[44px] w-[44px] rounded-[10px] border border-[#2d3340] bg-[#222630] text-[#9ca3b0] hover:text-white` (y `hover:border-red-500/40 hover:text-red-400` si borra) | Editar, borrar fila o eliminar miembro. |

---

## 8. Insignias y alertas

### Insignias (badges)
- **Hoy (Turnos)**: `rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-400`.
- **Hoy (Simpatizantes)**: `rounded-md bg-[#F2A65A]/20 px-2.5 py-0.5 text-[13px] font-semibold text-[#F2A65A]`.
- **Falta N (turno incompleto)**: `rounded-md border border-[#F2A65A]/45 bg-[#F2A65A]/15 px-2.5 py-0.5 text-[13px] font-semibold text-[#F2A65A]`.
- **N por revisar (tarjeta Simpatizantes)**: `rounded-lg bg-[#E8C547]/15 px-3 py-1.5 text-[15px] font-semibold text-[#E8C547]`.
- **Estado de miembro (`Activo` / `Inactivo`)**: `min-h-[44px] rounded-[10px] border px-3 text-[14px] font-medium`:
  - Activo: `border-emerald-500/35 bg-emerald-500/15 text-emerald-300`.
  - Inactivo: `border-[#2d3340] bg-[#222630] text-[#8a91a0]`.

### Alertas y avisos
- **Aviso positivo con acción (`Deshacer`)**: `rounded-[12px] border border-emerald-500/35 bg-emerald-500/10 px-5 py-3.5 text-[16px] text-emerald-200`, con botón interno `min-h-[42px] rounded-[10px] border border-emerald-400/50 bg-[#14171d] px-4 text-[15px] font-semibold text-emerald-300`.
- **Confirmación de guardado / copiado**: `text-[15px] font-medium text-emerald-400` o cápsula `rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[15px] text-emerald-300`.
- **Advertencia (ámbar)**: `rounded-[12px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[15px] text-amber-200` con icono `text-amber-400`.
- **Error de validación**: `text-[15px] font-medium text-red-400` (`role="alert"`).
- **Opción destructiva seleccionada (modal Vaciar)**: `border-red-500/60 bg-red-500/10` con texto de recuento en `13px font-medium text-red-300`.

---

## 9. Modales

- **Telón de fondo (`backdrop`)**: `fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs` (`bg-black/80` en *Compartir turnos*).
- **Contenedor del diálogo**: `rounded-xl border border-[#2a2f3a] bg-[#1a1d24] p-[28px] shadow-2xl` (máximos según contenido: `max-w-lg` confirmaciones, `max-w-xl` vaciar, `max-w-2xl` formularios, `max-w-3xl` reparto rotativo, `max-w-4xl` compartir turnos; `max-h-[92vh] overflow-y-auto` en modales extensos).
- **Cabecera del modal**: título a la izquierda (`20px–24px` blanco en negrita) + subtítulo opcional (`15px text-[#9ca3b0]`); botón cerrar a la derecha de `44px × 44px` (`rounded-[12px] text-[#8a91a0] hover:bg-[#252a34] hover:text-white`).
- **Icono de advertencia (`ConfirmModal`)**: caja `44px × 44px` (`h-11 w-11 rounded-[12px]`) con `bg-red-500/15 text-red-400` en peligro o `bg-[#F2A65A]/15 text-[#F2A65A]` en aviso.
- **Pie de acciones**: `flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end`, colocando el botón primario/peligro arriba en móvil y a la derecha en escritorio.
