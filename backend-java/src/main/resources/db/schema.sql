CREATE DATABASE IF NOT EXISTS connect_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE connect_chat;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('online','offline','busy') DEFAULT 'offline',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(36) PRIMARY KEY NOT NULL,
  type ENUM('direct','group') NOT NULL,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  created_by VARCHAR(36) NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_chats_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  joined_at BIGINT NOT NULL,
  role ENUM('admin','member') DEFAULT 'member',
  PRIMARY KEY (chat_id, user_id),
  CONSTRAINT fk_chat_members_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY NOT NULL,
  chat_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  kind ENUM('text','emoji','object') NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rtc_sessions (
  id VARCHAR(36) PRIMARY KEY NOT NULL,
  chat_id VARCHAR(36),
  type ENUM('audio','video') NOT NULL,
  started_by VARCHAR(36),
  started_at BIGINT NOT NULL,
  ended_at BIGINT NULL,
  CONSTRAINT fk_rtc_chat FOREIGN KEY (chat_id) REFERENCES chats(id),
  CONSTRAINT fk_rtc_started_by FOREIGN KEY (started_by) REFERENCES users(id)
);
