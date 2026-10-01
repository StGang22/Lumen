# Seguridad de Lumen

## Alcance actual

Lumen es un proyecto en desarrollo y el panel permanece privado. La primera versión no escanea equipos automáticamente ni ejecuta pagos, comandos, bloqueos de red o controles domóticos. No se debe usar como sistema de seguridad crítico.

## Reporte responsable

Antes de cualquier distribución pública, el propietario del proyecto debe definir un canal privado de reporte y el SLA de respuesta. No publiques tokens, cookies, datos de salud, información de empresas ni detalles explotables en issues públicos.

## Principios

- Solo activos propios o con autorización expresa.
- Nunca registrar cabeceras de autorización, cookies, cuerpos ni respuestas que puedan contener credenciales o datos personales.
- Las mutaciones web deben rechazar solicitudes cross-site y limitar el tamaño de los cuerpos.
- Las sesiones web se validan contra un corte global persistido; las sesiones anteriores al corte se rechazan.
- Si se implementa voz manos libres, la detección y el procesamiento de audio deben permanecer locales; el audio no se transmite a servicios cloud.
- Revocar inmediatamente un dispositivo que ya no deba acceder.
- Tratar las respuestas del modelo como texto no confiable y nunca como autorización de una acción.
- Las decisiones financieras y otras acciones de alto impacto requieren una decisión humana explícita.
- No almacenar datos empresariales, financieros o de salud reales hasta completar la revisión de privacidad y retención.
