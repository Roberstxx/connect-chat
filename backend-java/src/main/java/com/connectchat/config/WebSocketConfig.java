package com.connectchat.config;

import com.connectchat.ws.ChatWebSocketHandler;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  private final ChatWebSocketHandler handler;

  public WebSocketConfig(ChatWebSocketHandler handler) {
    this.handler = handler;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(handler, "/ws/chat")
        .setAllowedOrigins("*")
        .addInterceptors(new TokenHandshakeInterceptor());
  }

  static class TokenHandshakeInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, org.springframework.http.server.ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
      if (request instanceof ServletServerHttpRequest servletRequest) {
        var httpRequest = servletRequest.getServletRequest();
        String token = httpRequest.getParameter("token");
        if ((token == null || token.isBlank())) {
          String auth = httpRequest.getHeader("Authorization");
          if (auth != null && auth.startsWith("Bearer ")) {
            token = auth.substring(7);
          }
        }
        if (token != null && !token.isBlank()) {
          attributes.put("token", token);
        }
      }
      return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, org.springframework.http.server.ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
  }
}
