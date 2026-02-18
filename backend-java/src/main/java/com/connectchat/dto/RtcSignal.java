package com.connectchat.dto;

public record RtcSignal(
    String type,
    String chatId,
    String fromUserId,
    String toUserId,
    String callType,
    Object payload
) {}
