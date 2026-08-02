package com.syncstream.hub.model.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InviteEvent {
    private String id;
    private String roomId;
    private Long senderId;
    private String senderUsername;
    private Long targetUserId;
    private long timestamp;
}
