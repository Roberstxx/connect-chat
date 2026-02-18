# Connect Chat — Guía completa de instalación y ejecución

Este repositorio tiene **2 partes**:
- **Frontend**: React + Vite (`/`)
- **Backend**: Java Spring Boot con WebSocket (`/backend-java`)

---

## 1) Requisitos (qué debes instalar)

### Frontend
- **Node.js 20+** (recomendado LTS)
- **npm** (viene con Node)

### Backend
- **Java 17+**
- **Maven 3.9+**
- **MySQL 8+** o **MariaDB 10.4+**

### Opcional (si quieres HTTPS/WSS en local)
- **mkcert**

> Nota importante sobre "requirements.txt": este proyecto **no usa Python**, así que no hay `requirements.txt`.
> - Las dependencias del frontend están en `package.json`.
> - Las dependencias del backend están en `backend-java/pom.xml`.

---

## 2) Clonar e instalar dependencias

```bash
git clone <TU_REPO>
cd connect-chat
npm install
```

Para backend, Maven descarga dependencias automáticamente al correrlo.

---

## 3) Configurar base de datos (`chatapp`)

1. Levanta MySQL/MariaDB.
2. Importa el esquema:

```bash
cd backend-java
mysql -u root chatapp < src/main/resources/db/schema.sql
```

> Si tu usuario/clave de DB son diferentes, luego actualiza `backend-java/src/main/resources/application.yml`.

Configuración actual por defecto del backend (pensada para XAMPP):
- DB: `chatapp`
- Usuario: `root`
- Password: *(vacío)*
- Puerto DB: `3306`

---

## 4) Configurar variables de entorno (`.env`)

### 4.1 Frontend (`/.env`)

En la raíz del proyecto crea un archivo **`.env`**:

```env
VITE_WS_URL=ws://localhost:8443/ws/chat
```

Si habilitas TLS en backend, cambia a:

```env
VITE_WS_URL=wss://localhost:8443/ws/chat
```

### 4.2 Backend (variables de entorno para Spring Boot)

El backend ahora toma valores desde variables de entorno, con defaults compatibles con XAMPP.

Variables principales:

```env
# DB (XAMPP por defecto)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatapp
DB_USERNAME=root
DB_PASSWORD=
DB_USE_SSL=false
DB_TIMEZONE=UTC

# Servidor
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

> Nota: Spring Boot no carga `.env` automáticamente. Puedes exportar variables en tu terminal o pasar `-D` properties al ejecutar Maven.

Ejemplo rápido en Linux/macOS:

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=chatapp
export DB_USERNAME=root
export DB_PASSWORD=
cd backend-java
mvn spring-boot:run
```

Ejemplo rápido en Windows PowerShell:

```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="chatapp"
$env:DB_USERNAME="root"
$env:DB_PASSWORD=""
cd backend-java
mvn spring-boot:run
```

---

## 5) (Opcional) Generar certificados locales con mkcert

Solo si quieres usar `wss://`.

### 5.1 Instalar autoridad local

```bash
mkcert -install
```

### 5.2 Generar cert y key para localhost

```bash
mkcert localhost 127.0.0.1 ::1
```

Esto te genera dos archivos (nombres similares a):
- `localhost+2.pem`
- `localhost+2-key.pem`

### 5.3 Convertir a `.p12` para Spring Boot

Desde la carpeta donde quedaron los PEM:

```bash
openssl pkcs12 -export \
  -in localhost+2.pem \
  -inkey localhost+2-key.pem \
  -out localhost.p12 \
  -name localhost \
  -password pass:changeit
```

### 5.4 Copiar `localhost.p12` al backend

```bash
cp localhost.p12 backend-java/src/main/resources/localhost.p12
```

### 5.5 Habilitar SSL en backend

Edita `backend-java/src/main/resources/application.yml` y deja:

```yaml
server:
  port: 8443
  ssl:
    enabled: true
    key-store: classpath:localhost.p12
    key-store-password: changeit
    key-store-type: PKCS12
```

---

## 6) Correr backend (Spring Boot)

En una terminal:

```bash
cd backend-java
mvn spring-boot:run
```

Endpoint WebSocket:
- Sin SSL: `ws://localhost:8443/ws/chat`
- Con SSL: `wss://localhost:8443/ws/chat`

---

## 7) Correr frontend (Vite)

En otra terminal, desde la raíz:

```bash
npm run dev
```

Vite normalmente abre en:
- `http://localhost:5173`

---

## 8) Orden recomendado de arranque

1. Base de datos MySQL/MariaDB.
2. Backend (`mvn spring-boot:run`).
3. Frontend (`npm run dev`).
4. Abrir el navegador en `http://localhost:5173`.

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

## 10) Si algo falla (checklist rápido)

- ¿La DB `chatapp` existe y el schema fue importado?
- ¿Credenciales `DB_*` correctas en tus variables de entorno/backend?
- ¿Ves en logs de Spring que la conexión JDBC fue exitosa (sin `Access denied`)?
- ¿Después de registrar, aparece un `INSERT`/nuevo registro en tabla `users`?
- ¿`VITE_WS_URL` coincide con `ws://` o `wss://` según tu backend?
- Si usas SSL: ¿`localhost.p12` está en `backend-java/src/main/resources/` y `ssl.enabled: true`?
- ¿Backend corriendo en puerto `8443`?
- ¿Frontend corriendo en puerto `5173`?

---

## Estructura principal

- Frontend: `src/`
- Backend: `backend-java/src/main/java`
- Config backend: `backend-java/src/main/resources/application.yml`
- Schema DB: `backend-java/src/main/resources/db/schema.sql`
