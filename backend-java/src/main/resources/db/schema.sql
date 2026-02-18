CREATE DATABASE IF NOT EXISTS chatapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chatapp;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  username VARCHAR(32) NOT NULL,
  email VARCHAR(120) DEFAULT NULL,
  displayName VARCHAR(80) NOT NULL,
  avatarUrl TEXT DEFAULT NULL,
  status ENUM('online','offline','busy') NOT NULL DEFAULT 'offline',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username (username),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chats (
  id CHAR(36) NOT NULL,
  type ENUM('direct','group') NOT NULL,
  title VARCHAR(80) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_members (
  chatId CHAR(36) NOT NULL,
  userId CHAR(36) NOT NULL,
  role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chatId, userId),
  KEY userId (userId),
  CONSTRAINT chat_members_ibfk_1 FOREIGN KEY (chatId) REFERENCES chats (id) ON DELETE CASCADE,
  CONSTRAINT chat_members_ibfk_2 FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL,
  chatId CHAR(36) NOT NULL,
  senderId CHAR(36) NOT NULL,
  kind ENUM('text','emoji','object') NOT NULL,
  content TEXT NOT NULL,
  createdAt BIGINT(20) NOT NULL,
  PRIMARY KEY (id),
  KEY senderId (senderId),
  KEY idx_messages_chat_created (chatId, createdAt),
  CONSTRAINT messages_ibfk_1 FOREIGN KEY (chatId) REFERENCES chats (id) ON DELETE CASCADE,
  CONSTRAINT messages_ibfk_2 FOREIGN KEY (senderId) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
