package com.connectchat.repository;

import com.connectchat.model.UserEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, String> {
  boolean existsByUsername(String username);

  boolean existsByEmail(String email);

  Optional<UserEntity> findByUsernameOrEmail(String username, String email);
}
