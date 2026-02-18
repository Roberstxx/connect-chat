package com.connectchat.service;

import com.connectchat.model.User;
import com.connectchat.model.UserEntity;
import com.connectchat.repository.UserRepository;
import com.connectchat.security.JwtService;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final BCryptPasswordEncoder encoder;
  private final JwtService jwtService;
  private final UserRepository userRepository;

  public AuthService(BCryptPasswordEncoder encoder, JwtService jwtService, UserRepository userRepository) {
    this.encoder = encoder;
    this.jwtService = jwtService;
    this.userRepository = userRepository;
  }

  @Transactional
  public User register(String username, String displayName, String password) {
    if (userRepository.existsByUsername(username)) {
      throw new IllegalArgumentException("username ya existe");
    }

    UserEntity entity = new UserEntity();
    entity.setId(UUID.randomUUID().toString());
    entity.setUsername(username);
    entity.setDisplayName(displayName);
    entity.setStatus("online");
    entity.setPasswordHash(encoder.encode(password));

    UserEntity saved = userRepository.save(entity);
    return toPublicUser(saved);
  }

  @Transactional
  public User login(String usernameOrEmail, String password) {
    UserEntity entity = userRepository
        .findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
        .orElseThrow(() -> new IllegalArgumentException("usuario no encontrado"));

    if (!encoder.matches(password, entity.getPasswordHash())) {
      throw new IllegalArgumentException("credenciales invalidas");
    }

    entity.setStatus("online");
    userRepository.save(entity);

    return toPublicUser(entity);
  }

  public String tokenFor(User user) {
    return jwtService.generate(user.id());
  }

  public String userIdFromToken(String token) {
    return jwtService.extractUserId(token);
  }

  public User userById(String userId) {
    return userRepository.findById(userId).map(this::toPublicUser).orElse(null);
  }

  private User toPublicUser(UserEntity entity) {
    return new User(
        entity.getId(),
        entity.getUsername(),
        entity.getDisplayName(),
        entity.getAvatarUrl(),
        entity.getStatus()
    );
  }
}
