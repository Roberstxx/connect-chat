# Connect Chat — Guía completa para correrlo sin errores (XAMPP + Spring + Vite)

Esta guía está pensada para evitar los problemas más comunes reportados en este proyecto:
- Backend que no conecta a MySQL.
- Registro/Login que no persiste usuarios en la tabla `users`.
- WebSocket con desconexiones por URL o token viejo.

---

## 1) Arquitectura del proyecto

Este repo tiene dos aplicaciones:

- **Frontend**: React + Vite (carpeta raíz).
- **Backend**: Spring Boot + WebSocket + JPA (carpeta `backend-java`).

---

## 2) Requisitos

### Frontend
- Node.js 20+
- npm

### Backend
- Java 17+
- Maven 3.9+
- MySQL 8+ o MariaDB (XAMPP usa MariaDB)

### Opcional (solo si quieres `wss://`)
- mkcert

---

## 3) Instalación

```bash
git clone <TU_REPO>
cd connect-chat
npm install
```

> Si `npm install` falla por red/proxy, corrige eso primero porque Vite/Vitest dependen de paquetes npm.

---

## 4) Base de datos (XAMPP)

1. Abre XAMPP y levanta **MySQL**.
2. Crea DB `chatapp` (si no existe).
3. Importa el schema:

```bash
cd backend-java
mysql -u root chatapp < src/main/resources/db/schema.sql
```

En XAMPP normalmente:
- `DB_USERNAME=root`
- `DB_PASSWORD=` (vacío)
- `DB_PORT=3306`

---

## 5) Variables de entorno

### 5.1 Frontend (`/.env`)

Crea `/.env` en la raíz:

```env
VITE_WS_URL=ws://localhost:8443/ws/chat
```

Si habilitas TLS en backend, usa:

```env
VITE_WS_URL=wss://localhost:8443/ws/chat
```

### 5.2 Backend (Spring Boot)

El backend lee estas variables (`application.yml`):

```env
# DB (defaults útiles para XAMPP)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatapp
DB_USERNAME=root
DB_PASSWORD=
DB_USE_SSL=false
DB_TIMEZONE=UTC

# Server
SERVER_PORT=8443

# JWT
JWT_SECRET=dev-secret-change-this-to-32-plus-characters
JWT_EXPIRATION_MS=86400000

# SSL opcional
SSL_ENABLED=false
SSL_KEY_STORE=classpath:localhost.p12
SSL_KEY_STORE_PASSWORD=changeit
SSL_KEY_STORE_TYPE=PKCS12
```

> Spring Boot no carga `.env` automáticamente. Debes exportar variables en tu terminal antes de correr `mvn spring-boot:run`.

---

## 6) Cómo arrancar (orden correcto)

1. MySQL/MariaDB en XAMPP.
2. Backend Spring Boot.
3. Frontend Vite.

### Backend (Windows PowerShell)

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="chatapp"
$env:DB_USERNAME="root"
$env:DB_PASSWORD=""
$env:SERVER_PORT="8443"
cd backend-java
mvn spring-boot:run
```

### Backend (Linux/macOS bash)

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=chatapp
export DB_USERNAME=root
export DB_PASSWORD=
export SERVER_PORT=8443
cd backend-java
mvn spring-boot:run
```

### Frontend

En otra terminal, desde la raíz:

```bash
npm run dev
```

Abre:
- `http://localhost:5173`

---

## 7) Verificación rápida (importante)

Cuando todo está bien:

1. El backend arranca sin errores JDBC (`Access denied`, `Communications link failure`, etc.).
2. El frontend conecta a `ws://localhost:8443/ws/chat`.
3. Al registrar usuario en la UI, aparece una fila nueva en `chatapp.users` (phpMyAdmin).
4. Luego login funciona usando esos mismos datos.

---

## 8) Troubleshooting real (errores típicos)

### A) “No se crean cuentas en DB”
Revisa en este orden:

1. ¿Backend realmente está corriendo con las variables `DB_*` correctas?
2. ¿La DB y la tabla `users` existen en `chatapp`?
3. ¿El backend se conectó a otra DB distinta por variables de entorno previas?
4. ¿Estás mirando la misma instancia MySQL en phpMyAdmin que usa Spring?

### B) “WebSocket failed / connect-disconnect loop”

- Asegura que `VITE_WS_URL` apunte al backend correcto.
- Borra token viejo del navegador (DevTools > Application > Local Storage > `chat.jwt`) y vuelve a intentar login.
- Verifica que backend y frontend estén en los puertos esperados (`8443` y `5173`).

### C) “Access denied for user”

- Corrige `DB_USERNAME` / `DB_PASSWORD`.
- En XAMPP usualmente el password de `root` está vacío.

---

## 9) Comandos útiles

### Frontend
```bash
npm run dev
npm run build
npm run test
npm run lint
```

### Backend
```bash
cd backend-java
mvn spring-boot:run
mvn test
```

---

## 10) Notas de implementación

- El registro/login WebSocket (`auth:register`, `auth:login`) ahora persiste en MySQL tabla `users`.
- Si no ves datos en DB, el problema es de conexión/config de entorno, no del flujo en memoria.

---

## 11) Estructura principal

- Frontend: `src/`
- Backend: `backend-java/src/main/java`
- Config backend: `backend-java/src/main/resources/application.yml`
- Schema DB: `backend-java/src/main/resources/db/schema.sql`
