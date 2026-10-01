# Requisitos preliminares — Savior Authority

**Estado:** descubrimiento del producto. Lumen todavía no está conectado a Savior Authority ni ejecuta cambios en esa plataforma.

## Confirmado por el propietario

- **Organización:** Savior Authority.
- **Producto:** una plataforma web administrativa.
- **Alcance pedido:** administrar registros de ingreso, tags NFC, asignar un número de ID a cada tag, asignar tags a empresas, controlar acciones dentro de la plataforma y auditar todo el espacio.
- **Ayuda de Lumen:** responder y preguntar sobre las acciones dentro de la plataforma, respetando los permisos y solicitando autorización humana para cambios sensibles.
- **Cuenta maestra administrativa indicada:** `authoritysavior@gmail.com`. El propietario indicó que esa es la cuenta para iniciar sesión en SaviFiAuthority. No se almacenan ni solicitan contraseñas o tokens.

## Repositorios y sitio revisados

Inspección de solo lectura del código de la rama `main`:

- **Consola administrativa:** [StGang22/SaviFiAuthority](https://github.com/StGang22/SaviFiAuthority), SHA revisada `f46dfe515761bc3e222ccf3a22bc7197562dcd71`.
- **Plataforma relacionada y esquema compartido:** [StGang22/Savior-Network](https://github.com/StGang22/Savior-Network), SHA revisada `0e5d4d09be2d183fa87df87b3b4053602311ede3`.
- Fuentes relevantes: [Tags.tsx](https://github.com/StGang22/SaviFiAuthority/blob/main/src/pages/Tags.tsx), [Merchants.tsx](https://github.com/StGang22/SaviFiAuthority/blob/main/src/pages/Merchants.tsx), [Login.tsx](https://github.com/StGang22/SaviFiAuthority/blob/main/src/pages/Login.tsx), [control superadmin](https://github.com/StGang22/SaviFiAuthority/blob/main/src/auth/RequireSuperadmin.tsx), [esquema Supabase](https://github.com/StGang22/Savior-Network/blob/main/supabase/migrations/001_schema_savior.sql) y [registro de toques](https://github.com/StGang22/Savior-Network/blob/main/supabase/migrations/002_register_tap.sql).
- El enlace público compartido, `https://savior-network-dgpg.vercel.app`, muestra una pantalla de **Savior Business** con acceso de Google; no presenta la consola SaviFiAuthority ni el módulo de tags sin autenticación. El repositorio de SaviFiAuthority no declara una URL pública en sus metadatos de GitHub, así que falta la URL desplegada de esa consola si se quiere revisar su interfaz en vivo.

## Qué existe en el código revisado

1. **Inicio de sesión y autoridad:** SaviFiAuthority ofrece acceso con Google o correo/contraseña mediante Supabase. La pantalla de administración requiere sesión y el perfil debe tener `is_superadmin=true`; el código consultado no demuestra que la cuenta indicada ya tenga ese atributo en la base activa. No se intentó iniciar sesión.
2. **Empresas:** la consola tiene una pantalla de comercios para listar, activar y suspender empresas registradas desde Savior Business. En la aplicación de negocio hay membresías por comercio con roles `owner`, `manager` y `cashier`.
3. **Tags:** la página permite leer un tag, crearlo, asignarlo a un comercio, revocarlo/reactivarlo y copiar la URL asociada. El escaneo actual lo inicia el usuario con el botón **Leer tag NFC** y usa Web NFC (`NDEFReader`), indicado para Chrome en Android; no es una conexión a un sensor de red ni un lector de fondo.
4. **Identificadores:** el esquema distingue el UUID interno de la fila, `public_code` aleatorio de 12 caracteres hexadecimales usado en la ruta del tag y `tag_uid` (serial leído del hardware). Por lo tanto, falta precisar cuál de esos identificadores —o un nuevo número legible— quiere mostrar/usar el propietario como “número de ID”.
5. **Flujo actual del tag:** la URL pública `/t/<public_code>` pertenece a SaviFi. La función `register_tap` registra visitas de clientes para sellos, reglas de cooldown y recompensas. Lo que muestra el código es un flujo de fidelización/visitas de clientes, no control de acceso físico de empleados o visitantes ni apertura de puertas.
6. **Auditoría:** el esquema relacionado contiene `audit_log` y limita su lectura a superadministradores; la consola SaviFiAuthority solo muestra las secciones Comercios y Tags. No se encontró una pantalla de auditoría en sus rutas, y la escritura/ cobertura de eventos de la bitácora debe verificarse antes de afirmar que toda acción queda auditada.

Estos son hallazgos del código en los SHA indicados; no se probó el sistema desplegado, la base Supabase activa, el hardware ni la cuenta administrativa.

## Decisiones necesarias antes de conectar Lumen

1. **Significado de “registros de ingreso”:** confirmar si se refiere a visitas de clientes para fidelización (flujo existente) o al ingreso/ asistencia de empleados o visitantes. Si se requieren ambos, separarlos en módulos y permisos distintos.
2. **Identidad de tag:** decidir cuál identificador será el número visible y único para el negocio: UUID, `public_code`, `tag_uid` del hardware o un nuevo ID legible.
3. **Lectura NFC:** confirmar si el teléfono Android con Chrome es el lector deseado o si existe otro sensor dedicado. Para otro lector, identificar fabricante/modelo, interfaz/API, formato de eventos y quién lo administra.
4. **Empresas y aislamiento:** definir qué empresas cliente administra Savior Authority, qué usuarios pertenecen a cada una y qué información ve cada empresa. La membresía por comercio existente no da acceso global a Lumen automáticamente.
5. **Permisos para Lumen:** decidir si Lumen empieza en modo de solo lectura y qué cambios podrá proponer (alta/asignación/reasignación/revocación de tags, activar/suspender comercios). Los cambios de alto impacto deben exigir aprobación explícita y generar auditoría.
6. **Auditoría:** definir eventos obligatorios, campos mínimos, quién puede consultar, retención y cómo verificar que se registra cada operación de la consola y de la función NFC.
7. **URL de la consola:** compartir el dominio desplegado de SaviFiAuthority si se quiere revisar la interfaz en vivo. El URL recibido hasta ahora corresponde a Savior Business.

## Salvaguardas

- No intentar iniciar sesión ni solicitar contraseñas por chat. Si hace falta una sesión real, el propietario debe completar la autenticación en el navegador.
- No dar a Lumen una clave Supabase `service_role` ni incluir credenciales en el frontend, el repositorio o este documento. Diseñar una API de privilegio mínimo; comenzar con lectura solamente.
- Filtrar toda operación por comercio/espacio y autorización del actor en el servidor/base de datos; no confiar solo en controles visuales.
- Separar los datos de Savior Authority de los contextos personales y del hogar de Lumen.
- Usar un entorno de prueba, tags ficticios y registros redactados antes de modificar datos reales.
- El repositorio Lumen sigue privado; retirar datos operativos antes de cualquier publicación pública.
