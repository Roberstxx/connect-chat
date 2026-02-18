package com.connectchat.ws;

import com.connectchat.dto.AuthLoginRequest;
import com.connectchat.dto.AuthRegisterRequest;
import com.connectchat.dto.AuthResponse;
import com.connectchat.dto.RtcSignal;
import com.connectchat.dto.WsFrame;
import com.connectchat.service.AuthService;
import com.connectchat.service.ChatDataService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
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
  private final ChatDataService chatDataService;

  public ChatWebSocketHandler(
      ObjectMapper objectMapper,
      AuthService authService,
      WsSessionRegistry registry,
      ChatDataService chatDataService
  ) {
    this.objectMapper = objectMapper;
    this.authService = authService;
    this.registry = registry;
    this.chatDataService = chatDataService;
  }

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    JsonNode root = objectMapper.readTree(message.getPayload());
    String event = root.path("event").asText();
    JsonNode data = root.path("data");

    try {
      switch (event) {
        case "auth:register" -> handleRegister(session, data);
        case "auth:login" -> handleLogin(session, data);
        case "chat:list" -> handleChatList(session);
        case "user:list" -> handleUserList(session);
        case "message:list" -> handleMessageList(session, data);
        case "chat:createDirect" -> handleCreateDirect(session, data);
        case "group:create" -> handleCreateGroup(session, data);
        case "group:invite" -> handleInviteGroup(session, data);
        case "message:send" -> handleSendMessage(session, data);
        case "presence:update" -> handlePresenceUpdate(session, data);
        case "rtc:signal" -> relayRtcSignal(data);
        default -> session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
            new WsFrame(event, objectMapper.convertValue(data, Map.class))
        )));
      }
    } catch (IllegalArgumentException ex) {
      sendEvent(session, "error", Map.of("message", ex.getMessage(), "event", event));
    }
  }

  private void handleRegister(WebSocketSession session, JsonNode data) throws IOException {
    var req = objectMapper.convertValue(data, AuthRegisterRequest.class);
    var user = authService.register(req.username(), req.displayName(), req.email(), req.password());
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

  private void handleChatList(WebSocketSession session) throws IOException {
    var userId = requireUserId(session);
    sendEvent(session, "chat:list", chatDataService.listChatsForUser(userId));
  }

  private void handleUserList(WebSocketSession session) throws IOException {
    requireUserId(session);
    sendEvent(session, "user:list", chatDataService.listUsers());
  }

  private void handleMessageList(WebSocketSession session, JsonNode data) throws IOException {
    requireUserId(session);
    String chatId = data.path("chatId").asText();
    int limit = data.path("limit").asInt(100);
    sendEvent(session, "message:list", chatDataService.listMessages(chatId, limit));
  }

  private void handleCreateDirect(WebSocketSession session, JsonNode data) throws IOException {
    var userId = requireUserId(session);
    var targetUserId = data.path("userId").asText();
    var chat = chatDataService.createDirectChat(userId, targetUserId);
    sendEvent(session, "chat:created", chat);
  }

  private void handleCreateGroup(WebSocketSession session, JsonNode data) throws IOException {
    var userId = requireUserId(session);
    String title = data.path("title").asText();
    String description = data.path("description").asText(null);
    List<String> memberIds = toStringList(data.path("memberIds"));
    var chat = chatDataService.createGroup(userId, title, description, memberIds);
    sendEvent(session, "chat:created", chat);
  }

  private void handleInviteGroup(WebSocketSession session, JsonNode data) throws IOException {
    requireUserId(session);
    String groupId = data.path("groupId").asText();
    List<String> userIds = toStringList(data.path("userIds"));
    var chat = chatDataService.inviteToGroup(groupId, userIds);
    sendEvent(session, "chat:updated", chat);
  }

  private void handleSendMessage(WebSocketSession session, JsonNode data) throws IOException {
    String userId = requireUserId(session);
    String chatId = data.path("chatId").asText();
    String kind = data.path("kind").asText("text");
    String content = data.path("content").asText("");
    var msg = chatDataService.createMessage(chatId, userId, kind, content);

    for (var member : chatDataService.membersForChat(chatId)) {
      var toUserId = (String) member.get("id");
      registry.byUserId(toUserId).ifPresent(ws -> {
        try {
          sendEvent(ws, "message:receive", msg);
        } catch (IOException ignored) {
        }
      });
    }
  }

  private void handlePresenceUpdate(WebSocketSession session, JsonNode data) throws IOException {
    String userId = requireUserId(session);
    String status = data.path("status").asText("online");
    chatDataService.updateUserStatus(userId, status);
    sendEvent(session, "presence:update", Map.of("userId", userId, "status", status));
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

  private String requireUserId(WebSocketSession session) {
    String userId = (String) session.getAttributes().get("userId");
    if (userId == null || userId.isBlank()) {
      throw new IllegalArgumentException("No autenticado");
    }
    return userId;
  }


  private List<String> toStringList(JsonNode node) {
    List<String> values = new ArrayList<>();
    if (node == null || !node.isArray()) {
      return values;
    }
    for (JsonNode item : node) {
      String value = item.asText();
      if (value != null && !value.isBlank()) {
        values.add(value);
      }
    }
    return values;
  }
  private void sendEvent(WebSocketSession session, String event, Object data) throws IOException {
    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(new WsFrame(event, data))));
  }
}
