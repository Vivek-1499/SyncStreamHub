package com.syncstream.hub.controller;

import com.syncstream.hub.model.mongo.ChatMessageEntry;
import com.syncstream.hub.model.mongo.SessionLogEntry;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.model.websocket.ChatEvent;
import com.syncstream.hub.model.websocket.InviteEvent;
import com.syncstream.hub.model.websocket.RtcSignalEvent;
import com.syncstream.hub.model.websocket.SyncEvent;
import com.syncstream.hub.service.RoomInviteService;
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
    private final RoomInviteService roomInviteService;
    private final SimpMessagingTemplate messagingTemplate;

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
        
        boolean isHost = activeState.getHostUserId() == null || activeState.getHostUserId().equals(event.getUserId());

        switch (event.getAction().toUpperCase()) {
            case "JOIN":
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
                if (isHost) {
                    activeState.setPlaying(true);
                    activeState.setPlaybackPosition(event.getPlaybackPosition());
                    roomStateService.saveRoomState(activeState);
                } else {
                    log.warn("Non-host user {} tried to trigger PLAY in room {}", event.getUsername(), roomId);
                }
                break;
                
            case "PAUSE":
                if (isHost) {
                    activeState.setPlaying(false);
                    activeState.setPlaybackPosition(event.getPlaybackPosition());
                    roomStateService.saveRoomState(activeState);
                } else {
                    log.warn("Non-host user {} tried to trigger PAUSE in room {}", event.getUsername(), roomId);
                }
                break;
                
            case "SEEK":
                if (isHost) {
                    activeState.setPlaybackPosition(event.getPlaybackPosition());
                    roomStateService.saveRoomState(activeState);
                } else {
                    log.warn("Non-host user {} tried to trigger SEEK in room {}", event.getUsername(), roomId);
                }
                break;

            case "CHANGE_VIDEO":
                if (isHost && event.getVideoUrl() != null && !event.getVideoUrl().trim().isEmpty()) {
                    activeState.setVideoUrl(event.getVideoUrl());
                    activeState.setPlaying(false);
                    activeState.setPlaybackPosition(0.0);
                    roomStateService.saveRoomState(activeState);
                } else if (!isHost) {
                    log.warn("Non-host user {} tried to CHANGE_VIDEO in room {}", event.getUsername(), roomId);
                }
                break;
                
            default:
                log.warn("Unknown sync action: {}", event.getAction());
                break;
        }

        SessionLogEntry sessionLog = SessionLogEntry.builder()
                .action(event.getAction())
                .playbackPosition(event.getPlaybackPosition())
                .timestamp(Instant.now())
                .userId(event.getUserId())
                .username(event.getUsername())
                .build();
        watchPartyService.logSessionEventAsync(roomId, sessionLog);

        messagingTemplate.convertAndSend("/topic/room/" + roomId, activeState);
    }

    @MessageMapping("/room/{roomId}/chat")
    public void handleChatMessage(@DestinationVariable String roomId, ChatEvent event) {
        log.info("Received chat message from user {} in room {}", event.getUsername(), roomId);

        if (event.getId() == null) {
            event.setId(UUID.randomUUID().toString());
        }
        event.setTimestamp(System.currentTimeMillis());

        ChatMessageEntry chatEntry = ChatMessageEntry.builder()
                .id(event.getId())
                .userId(event.getUserId())
                .username(event.getUsername())
                .message(event.getMessage())
                .timestamp(Instant.ofEpochMilli(event.getTimestamp()))
                .build();
        watchPartyService.saveChatMessageAsync(roomId, chatEntry);

        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/chat", event);
    }

    @MessageMapping("/room/{roomId}/emoji")
    public void handleEmojiEvent(@DestinationVariable String roomId, ChatEvent event) {
        log.info("Received emoji reaction '{}' from user {} in room {}", 
                 event.getMessage(), event.getUsername(), roomId);
        
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/emoji", event);
    }

    @MessageMapping("/room/{roomId}/rtc")
    public void handleRtcSignal(@DestinationVariable String roomId, RtcSignalEvent signal) {
        log.info("Relaying WebRTC signal {} from sender {} to target {} in room {}", 
                 signal.getType(), signal.getSenderId(), signal.getTargetId(), roomId);
        
        // Broadcast signaling data to room or specific target peer channel
        if (signal.getTargetId() != null) {
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/rtc/" + signal.getTargetId(), signal);
        } else {
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/rtc", signal);
        }
    }

    @MessageMapping("/invite")
    public void handlePartyInvite(InviteEvent invite) {
        log.info("Dispatching party invite to room {} from user {} to target user {}", 
                 invite.getRoomId(), invite.getSenderUsername(), invite.getTargetUserId());
        
        InviteEvent savedInvite = roomInviteService.saveInvite(invite);
        messagingTemplate.convertAndSend("/topic/user/" + invite.getTargetUserId() + "/invites", savedInvite);
    }
}
