# Preparación de lanzamiento de Lumen

## Estado de esta entrega

Lumen dispone de un panel privado autenticado, aprobaciones humanas que registran decisiones sin ejecutar acciones, memoria explícita que se puede editar o eliminar, inventario manual de activos y un agente local que únicamente comunica presencia. La interfaz distingue datos reales de proveedores desconectados.

Se añadieron protecciones contra POST cross-site en tRPC, límites pequeños de cuerpo, caducidad de aprobaciones verificada con hora SQL y rollback remoto del pareo si falla el llavero. Se retiró el colector Vite de depuración que guardaba cabeceras/cuerpos y se eliminó el directorio local de logs; `.manus-logs/` queda excluido de Git.

El propietario autorizó la invalidación de todas las sesiones de Lumen. La migración global estableció el corte en la base compartida y la verificación contra la base confirmó que los JWT anteriores al corte se rechazan y los posteriores se aceptan. Los usuarios deben volver a iniciar sesión. Esto no revoca las sesiones de la cuenta Manus ni de otras aplicaciones.

Esta entrega **no es un lanzamiento público**. No se ha publicado un sitio ni se ha habilitado auto-publicación. El código debe continuar en repositorio privado y sin licencia abierta hasta decidir lo contrario.

## Lo que aún bloquea un piloto real

1. **Pruebas de integración:** aún faltan pruebas con dos propietarios y una base de prueba para aislamiento de datos, doble decisión/expiración concurrente, pareo de un solo uso, revocación de credenciales y respuesta HTTP real del agente. Las pruebas actuales son unitarias; el corte de sesión además se verificó contra la base compartida.
2. **Empresas y permisos:** nombrar las empresas, definir espacios independientes y roles/usuarios con acceso; actualmente solo existen ámbitos Personal/Hogar/Empresa.
3. **Proveedores:** elegir reloj/plataforma de salud, domótica, sistemas empresariales y herramientas defensivas; determinar permisos mínimos, retención y revocación por integración.
4. **Agente de escritorio:** empaquetado e instalación por plataforma, llavero disponible en el sistema objetivo, actualizaciones firmadas, diagnóstico local y prueba de revocación en cada SO.
5. **Privacidad:** decidir retención/exportación/eliminación, avisos y consentimiento para datos personales; no guardar credenciales, tokens ni notas médicas en memoria.
6. **Operaciones:** probar migración/rollback y comportamiento con errores de base/LLM, definir monitoreo, backups operativos disponibles y respuesta a incidentes.
7. **Distribución:** elegir licencia si se planea compartir código, dominio, canal de soporte y destinatarios autorizados. El proyecto no debe abrirse ni anunciarse antes de esas decisiones.

## Voz manos libres — siguiente fase

El propietario pidió que Lumen permanezca en segundo plano, se active por palabra de activación, procese voz y genere respuestas completamente de forma local, y pueda avisar verbalmente. También autorizó usar Bluetooth para escuchar mejor. La implementación deberá mantener la detección y el procesamiento de audio en el dispositivo, mostrar claramente el estado del micrófono, ofrecer silencio/desactivación y permitir salida a dispositivos Bluetooth ya autorizados; no debe emparejar equipos nuevos sin confirmación. Esta capacidad no forma parte del MVP actual y requiere un companion de escritorio nativo, modelos offline y evaluación de hardware por sistema operativo.

## Secuencia segura sugerida

- Revisar el checkpoint de código y la configuración privada del proyecto.
- Completar pruebas en un entorno controlado y verificar que expiración, rechazo y revocación no disparan acciones externas.
- Seleccionar cada proveedor y autorizarlo por separado; mantener desconectado lo que no se haya probado.
- Realizar una revisión independiente de seguridad y privacidad antes de introducir datos empresariales, de salud o de producción.
- Solicitar una instrucción explícita para publicar la aplicación. La conexión del repositorio a GitHub no publica el panel.

La configuración actual mantiene `auto_publish` desactivado; conservarlo así hasta una decisión explícita de lanzamiento.


## Alcance empresarial añadido: Savior Authority

Se recibió el requerimiento preliminar de un espacio web para registros de ingreso y tags NFC: captura desde sensor, ID por tag, asignación a empresas, operaciones dentro de la plataforma y auditoría integral. Sigue siendo descubrimiento; no hay lector conectado ni control físico habilitado. Antes de un piloto deben definirse modelo/protocolo del sensor, finalidad de los tags, empresas/miembros/roles, operaciones autorizadas, datos personales y retención, y propósito del correo `authoritysavior@gmail.com`. El detalle está en `docs/requirements-savior-authority.md`. No usar credenciales ni conectar sistemas hasta confirmar esas decisiones.
