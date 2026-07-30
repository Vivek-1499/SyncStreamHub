package com.syncstream.hub.model.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatEvent {
    private String id;
    private Long userId;
    private String username;
    private String message;
    private Long timestamp;
}
