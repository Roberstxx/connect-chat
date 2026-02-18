package com.connectchat.model;

public record User(
    String id,
    String username,
    String displayName,
    String avatarUrl,
    String status
) {}
