# Connect Chat Backend (Java + WebSocket + WebRTC signaling)

Backend base en **Spring Boot** para manejar:
- Autenticación por WebSocket (`auth:login`, `auth:register`) con JWT.
- Señalización WebRTC (`rtc:signal`: offer/answer/ice/end).
- Echo de eventos de chat para conectar luego persistencia MySQL.

## 1) Requisitos
- Java 17+
- Maven 3.9+
- MySQL 8+
- mkcert (para HTTPS/WSS en local)

## 2) Base de datos
```bash
mysql -u root -p < src/main/resources/db/schema.sql
```

## 3) Ejecutar en local
```bash
mvn spring-boot:run
```
WebSocket endpoint: `ws://localhost:8443/ws/chat`

## 4) Habilitar TLS local con mkcert
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

## 5) Eventos WebSocket soportados
- `auth:register`
- `auth:login`
- `rtc:signal`
- Cualquier otro evento se hace echo (útil para pruebas de frontend)

## Notas
- La persistencia de usuarios/chats/mensajes está pensada para MySQL usando el esquema incluido.
- La lógica de negocio de grupos y mensajes puede crecer sobre `ChatWebSocketHandler` o migrarse a STOMP.
