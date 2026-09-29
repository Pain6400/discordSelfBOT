# Discord Selfbot - Restaurador Automático de Apodo (NestJS)

Aplicación construida en **NestJS** y **TypeScript** que utiliza `discord.js-selfbot-v13` para restaurar de forma inmediata y automática tu apodo original en servidores específicos de Discord cuando un moderador o administrador te lo cambie.

> ⚠️ **Aviso de Responsabilidad (Discord ToS):**
> El uso de cuentas de usuario automatizadas ("Selfbots") infringe los [Términos del Servicio de Discord](https://discord.com/terms). Esta herramienta se proporciona con fines exclusivamente educativos. El uso de esta herramienta corre bajo tu propia responsabilidad y riesgo de suspensión de cuenta.

---

## 🚀 Características

- **Arquitectura Modular en NestJS**: Separación limpia de responsabilidades (`AppModule`, `DiscordModule`, `DiscordService`, `NicknameService`).
- **Prevención de Bucles Infinitos**: Ignora eventos donde el apodo ya sea el deseado o cuando el cambio provenga del propio bot.
- **Delay Configurable**: Retardo de espera (1.5s por defecto) antes de restaurar para evitar colisiones y *rate-limits*.
- **Vigilancia Selectiva**: Solo actúa en los servidores (Guilds) que tú especifiques.
- **Manejo Robusto de Errores y Logging**: Registra detalladamente en consola el servidor, el apodo anterior y el nuevo apodo restaurado.

---

## 📁 Estructura del Proyecto

```text
.
├── src/
│   ├── discord/
│   │   ├── discord.module.ts       # Módulo que encapsula el cliente y servicios de Discord
│   │   ├── discord.service.ts      # Conexión y gestión del ciclo de vida del cliente Discord
│   │   └── nickname.service.ts     # Lógica de detección y restauración de apodos
│   ├── app.module.ts               # Módulo raíz que carga ConfigModule y DiscordModule
│   └── main.ts                     # Punto de entrada de la aplicación NestJS
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Archivos y carpetas ignorados por Git
├── nest-cli.json                   # Configuración del CLI de NestJS
├── package.json                    # Dependencias y scripts del proyecto
├── tsconfig.json                   # Configuración de TypeScript
└── README.md                       # Documentación del proyecto
```

---

## 🛠️ Requisitos Previos

- **Node.js** (versión 18 o superior recomendada, probado en v20/v22/v24).
- **npm** (versión 9 o superior).

---

## ⚙️ Instalación

1. Clona o descarga este repositorio en tu equipo.
2. Abre una terminal en la raíz del proyecto e instala las dependencias:

```bash
npm install
```

---

## 🔐 Configuración de Variables de Entorno

Crea un archivo llamado `.env` en la raíz del proyecto basándote en `.env.example`:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales y configuración:

```env
# Token personal de tu cuenta de Discord (Selfbot)
DISCORD_USER_TOKEN=mfa.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Tu ID de usuario de Discord (Snowflake numérico)
MI_USER_ID=123456789012345678

# Lista de IDs de los servidores a vigilar (separados por coma, sin espacios)
WATCHED_GUILDS=111111111111111111,222222222222222222

# El apodo exacto que deseas mantener siempre
DESIRED_NICKNAME=MiApodoFavorito

# Tiempo de espera en milisegundos antes de aplicar la restauración (opcional, por defecto 1500)
RESTORE_DELAY_MS=1500
```

---

## 🔍 ¿Cómo obtener los IDs y tu Token de Usuario?

### 1. Activar el Modo Desarrollador en Discord
1. En Discord, abre los **Ajustes de usuario** (icono de engranaje).
2. Ve a la sección **Avanzado** en la barra lateral izquierda.
3. Activa la opción **Modo desarrollador**.

### 2. Obtener tu ID de Usuario (`MI_USER_ID`)
- Haz clic derecho sobre tu propio perfil (en cualquier chat o lista de miembros) y selecciona **Copiar ID de usuario**.

### 3. Obtener el ID del Servidor (`WATCHED_GUILDS`)
- Haz clic derecho sobre el icono del servidor que deseas vigilar en la barra lateral y selecciona **Copiar ID del servidor**. Si son varios servidores, colócalos separados por comas.

### 4. Obtener tu Token de Usuario de Discord (`DISCORD_USER_TOKEN`)
El token de usuario es la credencial privada que identifica tu sesión activa:
1. Abre Discord en un navegador web (como Google Chrome, Brave o Edge) e inicia sesión.
2. Presiona `F12` o `Ctrl + Shift + I` para abrir las **Herramientas de Desarrollador** (DevTools).
3. Dirígete a la pestaña **Network** (Red).
4. En el campo de filtro escribe `/api` o `science` o `messages`.
5. Realiza alguna acción en Discord (por ejemplo, cambia de canal o escribe un mensaje).
6. Haz clic en cualquiera de las peticiones que aparezcan en la lista.
7. En la pestaña **Headers** (Encabezados), busca la sección **Request Headers** (Encabezados de la solicitud).
8. Localiza la cabecera `Authorization`. El valor que aparece allí es tu token de usuario.
> ⚠️ **NUNCA compartas este token con nadie**, ya que da acceso total a tu cuenta.

---

## ▶️ Ejecución

### Modo Desarrollo (con recarga en vivo)
```bash
npm run start:dev
```

### Modo Producción
Compila el proyecto con TypeScript y ejecuta el build generado:

```bash
npm run build
npm run start:prod
```

---

## 🛡️ Comportamiento y Seguridad contra Bucles

1. **Filtro de ID**: Solo procesa eventos cuando el miembro modificado coincida con `MI_USER_ID`.
2. **Filtro de Servidor**: Solo actúa si el evento proviene de uno de los servidores definidos en `WATCHED_GUILDS`.
3. **Validación de Apodo Idéntico**: Si el apodo ya coincide con `DESIRED_NICKNAME`, la acción se cancela inmediatamente para evitar bucles cuando el bot aplique el cambio.
4. **Delay de Seguridad**: El retardo configurable (`RESTORE_DELAY_MS`) garantiza que no se envíen peticiones concurrentes si hay cambios múltiples en pocos segundos.
