# Connect Chat Backend (Java + WebSocket + WebRTC signaling)

Backend base en **Spring Boot** para manejar:
- Autenticación por WebSocket (`auth:login`, `auth:register`) con JWT.
- Señalización WebRTC (`rtc:signal`: offer/answer/ice/end).
- Echo de eventos de chat para conectar luego persistencia MySQL.

## 1) Requisitos
- Java 17+
- Maven 3.9+
- MySQL 8+ (o MariaDB 10.4+)
- mkcert (para HTTPS/WSS en local)

## 2) Base de datos
```bash
mysql -u root chatapp < src/main/resources/db/schema.sql
```

> XAMPP normalmente usa `root` sin contraseña. Si tu caso es distinto, ajusta variables de entorno.


## 3) Configurar variables de entorno (XAMPP/MySQL)

El backend lee estas variables (con defaults):

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatapp
DB_USERNAME=root
DB_PASSWORD=
DB_USE_SSL=false
DB_TIMEZONE=UTC

SERVER_PORT=8443
JWT_SECRET=dev-secret-change-this-to-32-plus-characters
JWT_EXPIRATION_MS=86400000

SSL_ENABLED=false
SSL_KEY_STORE=classpath:localhost.p12
SSL_KEY_STORE_PASSWORD=changeit
SSL_KEY_STORE_TYPE=PKCS12
```

Ejemplo (PowerShell):
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="chatapp"
$env:DB_USERNAME="root"
$env:DB_PASSWORD=""
mvn spring-boot:run
```

Ejemplo (bash):
```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=chatapp
export DB_USERNAME=root
export DB_PASSWORD=
mvn spring-boot:run
```

## 4) Ejecutar en local
```bash
mvn spring-boot:run
```
WebSocket endpoint: `ws://localhost:8443/ws/chat`

## 5) Habilitar TLS local con mkcert
```bash
mkcert -install
mkcert localhost 127.0.0.1 ::1
```
Luego configura en `application.yml`:
```yaml
server:
  ssl:
    enabled: true
    key-store: classpath:localhost.p12
    key-store-password: changeit
    key-store-type: PKCS12
```

## 6) Eventos WebSocket soportados
- `auth:register`
- `auth:login`
- `rtc:signal`
- Cualquier otro evento se hace echo (útil para pruebas de frontend)

## Estado de autenticación
- `auth:register` y `auth:login` ahora leen/escriben en tabla `users` de MySQL (ya no en memoria).
- Si no ves usuarios nuevos en phpMyAdmin, revisa primero credenciales `DB_*` y logs de arranque de Spring.

## Notas
- La persistencia de usuarios/chats/mensajes está pensada para MySQL usando el esquema incluido.
- La lógica de negocio de grupos y mensajes puede crecer sobre `ChatWebSocketHandler` o migrarse a STOMP.


### Eventos con persistencia en DB
- `chat:list`
- `user:list`
- `message:list`
- `chat:createDirect`
- `group:create`
- `group:invite`
- `message:send`
