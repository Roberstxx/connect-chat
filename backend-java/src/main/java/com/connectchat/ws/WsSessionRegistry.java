package com.connectchat.ws;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class WsSessionRegistry {
  private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

  public void bind(String userId, WebSocketSession session) {
    userSessions.put(userId, session);
  }

  public void remove(String userId) {
    userSessions.remove(userId);
  }

  public Optional<WebSocketSession> byUserId(String userId) {
    return Optional.ofNullable(userSessions.get(userId));
  }
}
