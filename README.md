# Lumen

**Lumen** es una base privada para un asistente personal supervisado: panel web y agente local de presencia. Esta primera versión es un **MVP de gobernanza**, no un administrador autónomo completo.

## Qué funciona hoy

- Panel en español con sesión Manus OAuth y datos separados por usuario.
- Solicitudes de decisiones financieras y de alto impacto con caducidad, revisión humana y auditoría. Aprobar o rechazar registra la decisión: **no ejecuta pagos, compras, transferencias ni cambios externos**.
- Chat con el asistente del servidor usando el LLM administrado. No dispone de herramientas para controlar dispositivos ni ejecutar acciones, y la conversación no se guarda en la aplicación.
- Inventario manual de dispositivos, redes o servidores declarados como propios/autorizados. Registrar un activo no inicia un escaneo.
- Códigos de pareo de un solo uso, credenciales de dispositivo guardadas como hash en el servidor, revocación desde el panel y un agente local que solo comunica presencia.
- Estados explícitos para los proveedores que aún no están conectados. No se inventan métricas de reloj, alertas o actividad.

## Límites intencionales

- “Conciencia” no se afirma: Lumen es software que puede conversar y mantener notas controladas por el usuario.
- No da diagnósticos médicos ni tratamientos. Las lecturas de smartwatch todavía no están integradas.
- No controla la casa ni administra sistemas empresariales; hay que elegir las plataformas y autorizar cada conexión.
- La defensa cibernética se limita al inventario declarado. No hay escaneo continuo, contención automática ni garantía de protección total. Cualquier medida disruptiva requerirá una política y autorización humana explícitas.
- El MVP no tiene ejecución de acciones, pagos, correo, control de cerraduras, shell remota, tool calling ni rutinas automáticas.
- El repositorio está marcado como privado y **sin licencia abierta**. La licencia comercial o pública queda pendiente de elección antes de distribuir el producto.

## Desarrollo web

Requisitos: Node compatible con el pin del proyecto y pnpm `10.18.0`.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

El proyecto administrado usa React, Express, tRPC, Drizzle y MySQL. WebDev proporciona `DATABASE_URL`, OAuth y las credenciales del servicio LLM en el entorno administrado. No pegues credenciales en el navegador ni en Git.

Para cambios de esquema, generar y revisar la migración antes de aplicar `pnpm db:migrate`. La base de desarrollo y la publicada son compartidas por el proyecto; las migraciones deben ser aditivas y no destructivas.

## Agente local

El agente usa Python 3.10+ y el llavero del sistema operativo (`keyring`). Instálalo desde esta carpeta:

```bash
python -m pip install -e ./agent
lumen-agent pair --server-url https://URL-DEL-PANEL --pairing-code CODIGO
lumen-agent status
lumen-agent run --interval 60
```

Usa siempre HTTPS, excepto en `localhost` para desarrollo. Si el llavero del sistema no está disponible, el agente intenta revocar inmediatamente el pareo recién creado; si no puede confirmar esa revocación por falta de red, muestra que debes revocarlo en el panel antes de volver a parear. El token nunca se imprime en terminal. El agente no procesa comandos remotos.

Pruebas de la frontera de URLs:

```bash
cd agent && python -m unittest discover -s tests
```

## Privacidad y seguridad

- El chat se envía al servicio LLM administrado para generar una respuesta, pero la aplicación no lo persiste.
- Las notas de memoria que el usuario agregue se podrán consultar, corregir y eliminar. Solo se incluyen como contexto del chat cuando el usuario lo usa.
- La auditoría registra actor, tipo de evento, contexto, resumen y fecha; evita copiar detalles sensibles o credenciales.
- El servidor guarda como hashes el token del agente y el código temporal; también persiste aprobaciones, auditoría, activos y notas de memoria asociadas al usuario. Los secretos de sesión pertenecen a los mecanismos administrados.
- La política global de sesiones invalida JWT de Lumen emitidos antes del corte registrado en la base; las sesiones anteriores deben volver a iniciar sesión.
- Las mutaciones del panel rechazan solicitudes POST cross-site mediante Fetch Metadata y, como alternativa, verificación Origin/Referer; los cuerpos de petición tienen límites pequeños.
- El colector Vite de depuración que guardaba cabeceras y cuerpos se retiró; los logs locales `.manus-logs/` se eliminan y quedan excluidos de Git.
- La base administrada del proyecto se comparte entre desarrollo y cualquier publicación futura; evita introducir datos confidenciales reales hasta revisar retención, acceso, exportación y controles operativos.
- No importes código, licencias o assets del ZIP original de Mark LIV.

## Configuración y salida a producción

`.env.example` enumera solo variables no secretas o explica qué inyecta el entorno; no debe contener valores reales. Mantén el proyecto privado. Antes de habilitar conexiones externas, selecciona cada proveedor, define el mínimo de permisos y prueba revocación. No publicar el sitio ni anunciarlo como agente totalmente integrado hasta completar esas decisiones y una revisión de seguridad independiente.


## Memoria editable

La sección **Memoria** permite guardar, editar y eliminar preferencias o pendientes bajo los ámbitos personal, hogar o empresa. Nada se añade automáticamente desde la conversación. Al usar el chat, hasta 12 notas recientes se envían al servicio LLM como contexto, identificadas como datos del usuario y no como instrucciones. No guardes contraseñas, tokens ni datos médicos identificables.
