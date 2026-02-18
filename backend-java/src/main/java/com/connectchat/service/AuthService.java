package com.connectchat.service;

import com.connectchat.model.User;
import com.connectchat.model.UserEntity;
import com.connectchat.repository.UserRepository;
import com.connectchat.security.JwtService;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

  private final BCryptPasswordEncoder encoder;
  private final JwtService jwtService;
  private final UserRepository userRepository;

  public AuthService(BCryptPasswordEncoder encoder, JwtService jwtService, UserRepository userRepository) {
    this.encoder = encoder;
    this.jwtService = jwtService;
    this.userRepository = userRepository;
  }

  @Transactional
  public User register(String username, String displayName, String email, String password) {
    String normalizedUsername = username == null ? "" : username.trim();
    String normalizedDisplayName = displayName == null ? "" : displayName.trim();
    String normalizedEmail = email == null ? "" : email.trim().toLowerCase();

    if (normalizedDisplayName.isBlank()) {
      throw new IllegalArgumentException("El nombre para mostrar es obligatorio");
    }

    if (normalizedUsername.isBlank()) {
      throw new IllegalArgumentException("El usuario es obligatorio");
    }

    if (normalizedUsername.length() < 3 || normalizedUsername.length() > 32) {
      throw new IllegalArgumentException("El usuario debe tener entre 3 y 32 caracteres");
    }

    if (!normalizedUsername.matches("^[a-zA-Z0-9_.-]+$")) {
      throw new IllegalArgumentException("El usuario solo puede contener letras, números, guion, guion bajo y punto");
    }

    if (normalizedEmail.isBlank()) {
      throw new IllegalArgumentException("El correo es obligatorio");
    }

    if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
      throw new IllegalArgumentException("El correo no es válido");
    }

    if (password == null || password.length() < 6) {
      throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");
    }

    if (userRepository.existsByUsername(normalizedUsername)) {
      throw new IllegalArgumentException("El usuario ya existe");
    }

    if (userRepository.existsByEmail(normalizedEmail)) {
      throw new IllegalArgumentException("El correo ya está registrado");
    }

    UserEntity entity = new UserEntity();
    entity.setId(UUID.randomUUID().toString());
    entity.setUsername(normalizedUsername);
    entity.setDisplayName(normalizedDisplayName);
    entity.setEmail(normalizedEmail);
    entity.setStatus("online");
    entity.setPasswordHash(encoder.encode(password));

    UserEntity saved = userRepository.save(entity);
    return toPublicUser(saved);
  }

  @Transactional
  public User login(String usernameOrEmail, String password) {
    String credential = usernameOrEmail == null ? "" : usernameOrEmail.trim();

    if (credential.isBlank()) {
      throw new IllegalArgumentException("El usuario o correo es obligatorio");
    }

    if (password == null || password.isBlank()) {
      throw new IllegalArgumentException("La contraseña es obligatoria");
    }

    UserEntity entity = userRepository
        .findByUsernameOrEmail(credential, credential)
        .orElseThrow(() -> new IllegalArgumentException("Usuario o contraseña incorrectos"));

    if (!encoder.matches(password, entity.getPasswordHash())) {
      throw new IllegalArgumentException("Usuario o contraseña incorrectos");
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
