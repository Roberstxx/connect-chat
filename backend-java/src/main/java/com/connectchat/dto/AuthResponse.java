package com.connectchat.dto;

import com.connectchat.model.User;

public record AuthResponse(String token, User user) {}
