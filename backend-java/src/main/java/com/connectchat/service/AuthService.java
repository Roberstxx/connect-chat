package com.connectchat.service;

import com.connectchat.model.User;
import com.connectchat.security.JwtService;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  private final JwtService jwtService;

  private final Map<String, String> byUsername = new ConcurrentHashMap<>();
  private final Map<String, User> users = new ConcurrentHashMap<>();
  private final Map<String, String> hashes = new ConcurrentHashMap<>();

  public AuthService(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  public User register(String username, String displayName, String password) {
    if (byUsername.containsKey(username)) {
      throw new IllegalArgumentException("username ya existe");
    }
    var id = UUID.randomUUID().toString();
    var user = new User(id, username, displayName, null, "online");
    users.put(id, user);
    byUsername.put(username, id);
    hashes.put(id, encoder.encode(password));
    return user;
  }

  public User login(String usernameOrEmail, String password) {
    var userId = byUsername.get(usernameOrEmail);
    if (userId == null) {
      throw new IllegalArgumentException("usuario no encontrado");
    }
    if (!encoder.matches(password, hashes.get(userId))) {
      throw new IllegalArgumentException("credenciales invalidas");
    }
    return users.get(userId);
  }

  public String tokenFor(User user) {
    return jwtService.generate(user.id());
  }

  public String userIdFromToken(String token) {
    return jwtService.extractUserId(token);
  }

  public User userById(String userId) {
    return users.get(userId);
  }
}
