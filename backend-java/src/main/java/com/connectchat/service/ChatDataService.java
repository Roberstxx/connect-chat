package com.connectchat.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatDataService {
  private final JdbcTemplate jdbc;

  public ChatDataService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> listUsers() {
    return jdbc.query(
        """
            SELECT id, username, displayName, avatarUrl, status
            FROM users
            ORDER BY created_at DESC
            """,
        this::mapUser
    );
  }

  public List<Map<String, Object>> listChatsForUser(String userId) {
    var chats = jdbc.query(
        """
            SELECT
              c.id,
              c.type,
              CASE
                WHEN c.type = 'direct' THEN COALESCE(
                  (
                    SELECT u2.displayName
                    FROM chat_members cm2
                    JOIN users u2 ON u2.id = cm2.userId
                    WHERE cm2.chatId = c.id AND cm2.userId <> ?
                    LIMIT 1
                  ),
                  c.title
                )
                ELSE c.title
              END AS title,
              c.description
            FROM chats c
            JOIN chat_members cm ON cm.chatId = c.id
            WHERE cm.userId = ?
            ORDER BY c.created_at DESC
            """,
        (rs, rowNum) -> {
          Map<String, Object> chat = new LinkedHashMap<>();
          chat.put("id", rs.getString("id"));
          chat.put("type", rs.getString("type"));
          chat.put("title", rs.getString("title"));
          chat.put("description", rs.getString("description"));
          chat.put("members", new ArrayList<Map<String, Object>>());
          return chat;
        },
        userId,
        userId
    );

    for (var chat : chats) {
      var chatId = (String) chat.get("id");
      chat.put("members", membersForChat(chatId));
      var last = lastMessage(chatId);
      if (last != null) {
        chat.put("lastMessage", last);
      }
    }

    return chats;
  }

  public List<Map<String, Object>> membersForChat(String chatId) {
    return jdbc.query(
        """
            SELECT u.id, u.username, u.displayName, u.avatarUrl, u.status
            FROM chat_members cm
            JOIN users u ON u.id = cm.userId
            WHERE cm.chatId = ?
            ORDER BY cm.joined_at ASC
            """,
        this::mapUser,
        chatId
    );
  }

  public List<Map<String, Object>> listMessages(String chatId, int limit) {
    int safeLimit = Math.max(1, Math.min(limit, 500));
    return jdbc.query(
        """
            SELECT id, chatId, senderId, kind, content, createdAt
            FROM messages
            WHERE chatId = ?
            ORDER BY createdAt DESC
            LIMIT ?
            """,
        (rs, rowNum) -> mapMessage(rs),
        chatId,
        safeLimit
    ).stream().sorted((a, b) -> Long.compare(
        ((Number) a.get("createdAt")).longValue(),
        ((Number) b.get("createdAt")).longValue()
    )).toList();
  }

  private boolean userExists(String userId) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, userId);
    return count != null && count > 0;
  }

  private String userDisplayName(String userId) {
    return jdbc.query(
        "SELECT displayName FROM users WHERE id = ? LIMIT 1",
        (rs, rowNum) -> rs.getString("displayName"),
        userId
    ).stream().findFirst().orElse("Direct chat");
  }

  @Transactional
  public Map<String, Object> createDirectChat(String fromUserId, String targetUserId) {
    if (targetUserId == null || targetUserId.isBlank() || fromUserId.equals(targetUserId)) {
      throw new IllegalArgumentException("usuario destino inválido");
    }
    if (!userExists(targetUserId)) {
      throw new IllegalArgumentException("usuario destino no existe");
    }
    var existing = jdbc.query(
        """
            SELECT c.id
            FROM chats c
            JOIN chat_members cm1 ON cm1.chatId = c.id AND cm1.userId = ?
            JOIN chat_members cm2 ON cm2.chatId = c.id AND cm2.userId = ?
            WHERE c.type = 'direct'
            LIMIT 1
            """,
        (rs, rowNum) -> rs.getString("id"),
        fromUserId,
        targetUserId
    );

    if (!existing.isEmpty()) {
      return chatById(existing.get(0));
    }

    String chatId = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO chats (id, type, title, description) VALUES (?, 'direct', ?, NULL)",
        chatId, userDisplayName(targetUserId));
    jdbc.update("INSERT INTO chat_members (chatId, userId, role) VALUES (?, ?, 'member')", chatId, fromUserId);
    jdbc.update("INSERT INTO chat_members (chatId, userId, role) VALUES (?, ?, 'member')", chatId, targetUserId);
    return chatById(chatId);
  }

  @Transactional
  public Map<String, Object> createGroup(String ownerUserId, String title, String description, List<String> memberIds) {
    String normalizedTitle = title == null ? "" : title.trim();
    if (normalizedTitle.isBlank()) {
      throw new IllegalArgumentException("título de grupo requerido");
    }

    String chatId = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO chats (id, type, title, description) VALUES (?, 'group', ?, ?)", chatId, normalizedTitle, description);
    jdbc.update("INSERT INTO chat_members (chatId, userId, role) VALUES (?, ?, 'owner')", chatId, ownerUserId);

    for (String memberId : memberIds) {
      if (!ownerUserId.equals(memberId)) {
        jdbc.update(
            "INSERT IGNORE INTO chat_members (chatId, userId, role) VALUES (?, ?, 'member')",
            chatId,
            memberId
        );
      }
    }

    return chatById(chatId);
  }

  @Transactional
  public Map<String, Object> inviteToGroup(String chatId, List<String> userIds) {
    for (String userId : userIds) {
      jdbc.update("INSERT IGNORE INTO chat_members (chatId, userId, role) VALUES (?, ?, 'member')", chatId, userId);
    }
    return chatById(chatId);
  }

  @Transactional
  public Map<String, Object> createMessage(String chatId, String senderId, String kind, String content) {
    String msgId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    jdbc.update(
        "INSERT INTO messages (id, chatId, senderId, kind, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        msgId,
        chatId,
        senderId,
        kind,
        content,
        now
    );
    return messageById(msgId);
  }

  public void updateUserStatus(String userId, String status) {
    jdbc.update("UPDATE users SET status = ? WHERE id = ?", status, userId);
  }

  public Map<String, Object> chatById(String chatId) {
    var chats = jdbc.query(
        "SELECT id, type, title, description FROM chats WHERE id = ?",
        (rs, rowNum) -> {
          Map<String, Object> chat = new HashMap<>();
          chat.put("id", rs.getString("id"));
          chat.put("type", rs.getString("type"));
          chat.put("title", rs.getString("title"));
          chat.put("description", rs.getString("description"));
          return chat;
        },
        chatId
    );

    if (chats.isEmpty()) {
      throw new IllegalArgumentException("chat no encontrado");
    }

    Map<String, Object> chat = chats.get(0);
    chat.put("members", membersForChat(chatId));
    var last = lastMessage(chatId);
    if (last != null) {
      chat.put("lastMessage", last);
    }
    return chat;
  }

  public Map<String, Object> messageById(String messageId) {
    var messages = jdbc.query(
        "SELECT id, chatId, senderId, kind, content, createdAt FROM messages WHERE id = ?",
        (rs, rowNum) -> mapMessage(rs),
        messageId
    );
    if (messages.isEmpty()) {
      throw new IllegalArgumentException("mensaje no encontrado");
    }
    return messages.get(0);
  }

  private Map<String, Object> mapUser(ResultSet rs, int rowNum) throws SQLException {
    Map<String, Object> user = new LinkedHashMap<>();
    user.put("id", rs.getString("id"));
    user.put("username", rs.getString("username"));
    user.put("displayName", rs.getString("displayName"));
    user.put("avatarUrl", rs.getString("avatarUrl"));
    user.put("status", rs.getString("status"));
    return user;
  }

  private Map<String, Object> mapMessage(ResultSet rs) throws SQLException {
    Map<String, Object> msg = new LinkedHashMap<>();
    msg.put("id", rs.getString("id"));
    msg.put("chatId", rs.getString("chatId"));
    msg.put("senderId", rs.getString("senderId"));
    msg.put("kind", rs.getString("kind"));
    msg.put("content", rs.getString("content"));
    msg.put("createdAt", rs.getLong("createdAt"));
    return msg;
  }

  private Map<String, Object> lastMessage(String chatId) {
    var list = jdbc.query(
        "SELECT id, chatId, senderId, kind, content, createdAt FROM messages WHERE chatId = ? ORDER BY createdAt DESC LIMIT 1",
        (rs, rowNum) -> mapMessage(rs),
        chatId
    );
    return list.isEmpty() ? null : list.get(0);
  }
}
