package com.connectchat.ws;

import com.connectchat.dto.AuthLoginRequest;
import com.connectchat.dto.AuthRegisterRequest;
import com.connectchat.dto.AuthResponse;
import com.connectchat.dto.RtcSignal;
import com.connectchat.dto.WsFrame;
import com.connectchat.service.AuthService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
  private final ObjectMapper objectMapper;
  private final AuthService authService;
  private final WsSessionRegistry registry;

  public ChatWebSocketHandler(ObjectMapper objectMapper, AuthService authService, WsSessionRegistry registry) {
    this.objectMapper = objectMapper;
    this.authService = authService;
    this.registry = registry;
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    JsonNode root = objectMapper.readTree(message.getPayload());
    String event = root.path("event").asText();
    JsonNode data = root.path("data");

    switch (event) {
      case "auth:register" -> handleRegister(session, data);
      case "auth:login" -> handleLogin(session, data);
      case "rtc:signal" -> relayRtcSignal(data);
      default -> session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
          new WsFrame(event, objectMapper.convertValue(data, Map.class))
      )));
    }
  }

  private void handleRegister(WebSocketSession session, JsonNode data) throws IOException {
    var req = objectMapper.convertValue(data, AuthRegisterRequest.class);
    var user = authService.register(req.username(), req.displayName(), req.password());
    var token = authService.tokenFor(user);
    session.getAttributes().put("userId", user.id());
    registry.bind(user.id(), session);
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
        new WsFrame("auth:register", new AuthResponse(token, user))
    )));
  }

  private void handleLogin(WebSocketSession session, JsonNode data) throws IOException {
    var req = objectMapper.convertValue(data, AuthLoginRequest.class);
    var user = authService.login(req.usernameOrEmail(), req.password());
    var token = authService.tokenFor(user);
    session.getAttributes().put("userId", user.id());
    registry.bind(user.id(), session);
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
        new WsFrame("auth:login", new AuthResponse(token, user))
    )));
  }

  private void relayRtcSignal(JsonNode data) throws IOException {
    var signal = objectMapper.convertValue(data, RtcSignal.class);
    registry.byUserId(signal.toUserId()).ifPresent(session -> {
      try {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(new WsFrame("rtc:signal", signal))));
      } catch (IOException ignored) {
      }
    });
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    var token = (String) session.getAttributes().get("token");
    if (token != null) {
      try {
        var userId = authService.userIdFromToken(token);
        session.getAttributes().put("userId", userId);
        registry.bind(userId, session);
      } catch (RuntimeException ignored) {
        // Token inválido/expirado: mantenemos la conexión abierta para permitir auth:login/auth:register.
        session.getAttributes().remove("token");
      }
    }
    super.afterConnectionEstablished(session);
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
    var userId = (String) session.getAttributes().get("userId");
    if (userId != null) {
      registry.remove(userId);
    }
    super.afterConnectionClosed(session, status);
  }
}
