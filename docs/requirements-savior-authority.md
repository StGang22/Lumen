# Requisitos preliminares — Savior Authority

**Estado:** descubrimiento de producto; todavía no es una especificación técnica aprobada ni una integración en funcionamiento.

## Confirmado por el propietario

- **Empresa/organización:** Savior Authority.
- **Forma del producto:** plataforma web.
- **Primer espacio:** administración de registros de ingreso y de tags NFC detectados por un sensor.
- **Funciones deseadas:** recibir los tags detectados; asignar un número de ID a cada tag; asignar tags a empresas; administrar lo que ocurre con los tags dentro de la plataforma; auditar toda la actividad del espacio.
- **Asistencia de Lumen:** poder hacer y responder preguntas relacionadas con las acciones que se realizan dentro de la plataforma, respetando los permisos y solicitando autorización humana para cambios sensibles.
- **Correo indicado para Lumen:** `authoritysavior@gmail.com`. Su uso aún no está definido: podría ser una cuenta administrativa, un destino de notificaciones o un remitente. No iniciar sesión, enviar correo, registrar cuentas ni guardar contraseñas/tokens hasta definirlo.

## Alcance técnico aún no confirmado

No hay lector NFC conectado ni se conoce su fabricante, modelo, interfaz o API. Tampoco se ha definido si cada tag representa a una persona, un visitante, un equipo, una credencial de acceso u otra cosa. Por ello, el MVP actual **no lee tags, no concede/retira acceso físico y no controla puertas**; la información anterior registra una necesidad futura, no una capacidad existente.

## Decisiones necesarias antes de implementar

1. **Sitio de Savior Authority:** enlace público opcional para entender la actividad, vocabulario e identidad del servicio. No hace falta para registrar este requisito; un sitio con inicio de sesión no requiere compartir credenciales.
2. **Sensor NFC:** fabricante/modelo, cómo entrega los eventos (API, webhook, red local, USB u otro método), formato de ejemplo de un evento y quién administra el dispositivo. No compartir claves ni datos reales de personas; usar ejemplos redactados.
3. **Significado y ciclo de vida del tag:** qué identifica cada tag; si el número interno lo asigna Lumen o procede del lector; qué pasa con duplicados, pérdida, reemplazo, reasignación y desactivación.
4. **Empresas destinatarias:** aclarar si Savior Authority administra tags de empresas clientes separadas o si son unidades internas. Cada empresa debe tener un espacio aislado, miembros y permisos explícitos.
5. **Registros de ingreso:** definir qué campos se necesitan (por ejemplo, hora, lector, tag/ID, empresa y resultado) y si se asociarán a personas. Si identifican empleados o visitantes, definir aviso, acceso autorizado, retención y eliminación antes de almacenar registros reales.
6. **Acciones permitidas:** indicar si “controlar tags” significa solo consultar/asignar/reasignar/desactivar en el sitio o también cambiar permisos de acceso físico. Cualquier efecto físico permanece fuera de alcance hasta identificar y autorizar el sistema compatible.
7. **Personas y roles:** nombres o alias de quienes usarán el espacio, quién administra miembros, quién registra/reasigna tags, quién consulta auditoría y quién puede autorizar acciones. Aplicar mínimo privilegio y permisos por empresa/espacio.
8. **Correo:** confirmar si `authoritysavior@gmail.com` será correo de inicio de sesión, de notificaciones, remitente, o solo contacto. No colocar credenciales en Git, código cliente ni documentos compartidos.

## Salvaguardas base

- Cada cambio importante de asignación o estado debe registrar actor, fecha, empresa/espacio, recurso y resultado.
- La bitácora debe registrar eventos, no contraseñas, tokens ni datos innecesarios.
- Consultas y cambios deben autorizarse en el servidor según empresa, espacio y rol; ocultar un botón en la interfaz no cuenta como control de acceso.
- Mantener los datos de Savior Authority separados de los contextos personales y del hogar.
- Usar primero un entorno de pruebas con tags ficticios y eventos redactados. No conectar hardware ni datos de producción hasta cerrar las decisiones anteriores.
- El repositorio es privado. Antes de una publicación pública, revisar y retirar direcciones de correo u otros datos operativos que no deban difundirse.
