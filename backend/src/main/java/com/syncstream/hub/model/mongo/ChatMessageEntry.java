package com.syncstream.hub.model.mongo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageEntry {
    private String id;              // Unique message identifier
    private Long userId;            // User who sent the message
    private String username;        // Name of sender
    private String message;         // Message text
    private Instant timestamp;      // When it was sent
}
