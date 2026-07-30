package com.syncstream.hub.controller;

import com.syncstream.hub.model.mongo.ChatMessageEntry;
import com.syncstream.hub.model.mongo.SessionLogEntry;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.model.websocket.ChatEvent;
import com.syncstream.hub.model.websocket.SyncEvent;
import com.syncstream.hub.model.websocket.RtcSignalEvent; // (Keep in case needed, or remove. Let's keep it safe)
import com.syncstream.hub.service.RoomStateService;
import com.syncstream.hub.service.WatchPartyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class SyncWebSocketController {

    private final RoomStateService roomStateService;
    private final WatchPartyService watchPartyService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Handles playback synchronization events (PLAY, PAUSE, SEEK, JOIN, LEAVE, CHANGE_VIDEO).
     * Destination: /app/room/{roomId}/sync
     */
    @MessageMapping("/room/{roomId}/sync")
    public void handlePlaybackSync(@DestinationVariable String roomId, 
                                   SyncEvent event, 
                                   SimpMessageHeaderAccessor headerAccessor) {
        log.info("Received sync event action: {} from user: {} in room: {}", 
                 event.getAction(), event.getUsername(), roomId);

        ActiveRoomState activeState = roomStateService.getRoomState(roomId);
        if (activeState == null) {
            log.warn("Sync event received for non-existent room: {}", roomId);
            return;
        }
        
        switch (event.getAction().toUpperCase()) {
            case "JOIN":
                // Save user tracking info in WebSocket session attributes
                if (headerAccessor.getSessionAttributes() != null) {
                    headerAccessor.getSessionAttributes().put("roomId", roomId);
                    headerAccessor.getSessionAttributes().put("username", event.getUsername());
                    headerAccessor.getSessionAttributes().put("userId", event.getUserId());
                }
                activeState = roomStateService.incrementParticipantCount(roomId);
                break;
                
            case "LEAVE":
                activeState = roomStateService.decrementParticipantCount(roomId);
                break;
                
            case "PLAY":
                activeState.setPlaying(true);
                activeState.setPlaybackPosition(event.getPlaybackPosition());
                roomStateService.saveRoomState(activeState);
                break;
                
            case "PAUSE":
                activeState.setPlaying(false);
                activeState.setPlaybackPosition(event.getPlaybackPosition());
                roomStateService.saveRoomState(activeState);
                break;
                
            case "SEEK":
                activeState.setPlaybackPosition(event.getPlaybackPosition());
                roomStateService.saveRoomState(activeState);
                break;

            case "CHANGE_VIDEO":
                if (event.getVideoUrl() != null && !event.getVideoUrl().trim().isEmpty()) {
                    activeState.setVideoUrl(event.getVideoUrl());
                    activeState.setPlaying(false);
                    activeState.setPlaybackPosition(0.0);
                    roomStateService.saveRoomState(activeState);
                }
                break;
                
            default:
                log.warn("Unknown sync action: {}", event.getAction());
                break;
        }

        // Asynchronously log the activity into MongoDB
        SessionLogEntry sessionLog = SessionLogEntry.builder()
                .action(event.getAction())
                .playbackPosition(event.getPlaybackPosition())
                .timestamp(Instant.now())
                .userId(event.getUserId())
                .username(event.getUsername())
                .build();
        watchPartyService.logSessionEventAsync(roomId, sessionLog);

        // Broadcast the active room state back to all subscribers of the room
        messagingTemplate.convertAndSend("/topic/room/" + roomId, activeState);
    }

    /**
     * Handles chat messages within the watch room.
     * Destination: /app/room/{roomId}/chat
     */
    @MessageMapping("/room/{roomId}/chat")
    public void handleChatMessage(@DestinationVariable String roomId, ChatEvent event) {
        log.info("Received chat message from user {} in room {}", event.getUsername(), roomId);

        // Ensure the event details are normalized
        if (event.getId() == null) {
            event.setId(UUID.randomUUID().toString());
        }
        event.setTimestamp(System.currentTimeMillis());

        // Asynchronously log the message into MongoDB
        ChatMessageEntry chatEntry = ChatMessageEntry.builder()
                .id(event.getId())
                .userId(event.getUserId())
                .username(event.getUsername())
                .message(event.getMessage())
                .timestamp(Instant.ofEpochMilli(event.getTimestamp()))
                .build();
        watchPartyService.saveChatMessageAsync(roomId, chatEntry);

        // Broadcast the message back to all users listening on the channel
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", event);
    }

    /**
     * Handles emoji reactions.
     * Destination: /app/room/{roomId}/emoji
     */
    @MessageMapping("/room/{roomId}/emoji")
    public void handleEmojiEvent(@DestinationVariable String roomId, ChatEvent event) {
        log.info("Received emoji reaction '{}' from user {} in room {}", 
                 event.getMessage(), event.getUsername(), roomId);
        
        // Broadcast the emoji event to the room
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/emoji", event);
    }
}
