package com.syncstream.hub.config;

import com.syncstream.hub.model.mongo.SessionLogEntry;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.service.RoomStateService;
import com.syncstream.hub.service.WatchPartyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final RoomStateService roomStateService;
    private final WatchPartyService watchPartyService;
    private final SimpMessageSendingOperations messagingTemplate;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();

        if (sessionAttributes != null && sessionAttributes.containsKey("roomId")) {
            String roomId = (String) sessionAttributes.get("roomId");
            String username = (String) sessionAttributes.get("username");
            Long userId = (Long) sessionAttributes.get("userId");

            log.info("WebSocket connection closed for user {} (ID: {}) in room {}", username, userId, roomId);

            // 1. Decrement player count in Redis
            ActiveRoomState activeState = roomStateService.decrementParticipantCount(roomId);

            if (activeState != null) {
                // 2. If room has no active participants, delete it from Redis completely
                if (activeState.getParticipantCount() == 0) {
                    log.info("Room {} is empty. Deleting watch party room from Redis cache.", roomId);
                    roomStateService.deleteRoom(roomId);
                } else {
                    // Broadcast the updated active state to remaining users
                    messagingTemplate.convertAndSend("/topic/room/" + roomId, activeState);
                }

                // 3. Asynchronously log the disconnection in MongoDB
                SessionLogEntry sessionLog = SessionLogEntry.builder()
                        .action("DISCONNECT")
                        .playbackPosition(activeState.getPlaybackPosition())
                        .timestamp(Instant.now())
                        .userId(userId)
                        .username(username)
                        .build();
                watchPartyService.logSessionEventAsync(roomId, sessionLog);
            }
        }
    }
}
