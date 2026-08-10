package com.syncstream.hub.controller;

import com.syncstream.hub.model.jpa.RoomPermission;
import com.syncstream.hub.model.mongo.WatchPartyHistory;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.repository.mongo.WatchPartyHistoryRepository;
import com.syncstream.hub.security.JwtTokenProvider;
import com.syncstream.hub.model.websocket.InviteEvent;
import com.syncstream.hub.service.RoomInviteService;
import com.syncstream.hub.service.RoomPermissionService;
import com.syncstream.hub.service.RoomStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class RoomController {

    private final RoomStateService roomStateService;
    private final RoomPermissionService roomPermissionService;
    private final WatchPartyHistoryRepository watchPartyHistoryRepository;
    private final JwtTokenProvider tokenProvider;
    private final RoomInviteService roomInviteService;
    private final SimpMessagingTemplate messagingTemplate;

    private Long extractUserId(String bearerToken) {
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            String token = bearerToken.substring(7);
            if (tokenProvider.validateToken(token)) {
                return tokenProvider.getUserIdFromTokenSafely(token);
            }
        }
        return null;
    }


    @GetMapping("/public")
    public ResponseEntity<List<ActiveRoomState>> getPublicRooms() {
        log.debug("Requesting list of active public watch party rooms");
        return ResponseEntity.ok(roomStateService.getPublicRooms());
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<?> getRoomState(@PathVariable String roomId,
                                          @RequestParam(required = false) Long userId) {
        log.debug("Checking room existence for: {}", roomId);
        if (!roomStateService.exists(roomId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "There is no watch party happening in room '" + roomId + "'. Please check the ID or create a room."));
        }
        ActiveRoomState state = roomStateService.getRoomState(roomId);
        if (state != null) {
            boolean isHost = userId != null && userId.equals(state.getHostUserId());
            if (state.getParticipantCount() <= 0 && !isHost && (System.currentTimeMillis() - state.getLastUpdated() > 30000)) {
                roomStateService.deleteRoom(roomId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "There is no watch party happening in room '" + roomId + "'. Please check the ID or create a room."));
            }
            if (state.getMaxParticipants() != null && state.getMaxParticipants() > 0) {
                if (!isHost && state.getParticipantCount() >= state.getMaxParticipants()) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(Map.of("message", "Watch party room '" + roomId + "' is at full capacity (" + state.getParticipantCount() + "/" + state.getMaxParticipants() + " viewers)."));
                }
            }
        }
        return ResponseEntity.ok(state);
    }

    @PostMapping("/create")
    public ResponseEntity<?> createRoom(@RequestParam String roomId,
                                        @RequestParam Long userId,
                                        @RequestParam String username,
                                        @RequestParam(defaultValue = "true") Boolean isPublic,
                                        @RequestParam(defaultValue = "10") Integer maxParticipants) {
        log.info("Request to create room '{}' (isPublic: {}, maxParticipants: {}) by host user: {}", roomId, isPublic, maxParticipants, username);
        
        if (roomStateService.exists(roomId)) {
            ActiveRoomState existingState = roomStateService.getRoomState(roomId);
            if (existingState != null) {
                boolean isOriginalHost = existingState.getHostUserId() != null && existingState.getHostUserId().equals(userId);
                boolean isEmpty = existingState.getParticipantCount() == null || existingState.getParticipantCount() <= 0;
                if (isOriginalHost || isEmpty) {
                    log.info("Host user {} (ID: {}) re-entering/reclaiming room '{}'", username, userId, roomId);
                    existingState.setHostUserId(userId);
                    existingState.setHostUsername(username);
                    if (isPublic != null) existingState.setPublic(isPublic);
                    if (maxParticipants != null) existingState.setMaxParticipants(maxParticipants);
                    roomStateService.saveRoomState(existingState);
                    return ResponseEntity.ok(existingState);
                }
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Watch party room '" + roomId + "' is already active. Choose a different ID or join it."));
        }

        ActiveRoomState state = roomStateService.createRoom(roomId, userId, username, isPublic, maxParticipants);
        return ResponseEntity.status(HttpStatus.CREATED).body(state);
    }

    @PostMapping("/{roomId}/settings")
    public ResponseEntity<?> updateRoomSettings(@PathVariable String roomId,
                                                @RequestParam(required = false) Boolean isPublic,
                                                @RequestParam(required = false) Integer maxParticipants,
                                                @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }
        try {
            ActiveRoomState state = roomStateService.updateRoomSettings(roomId, userId, isPublic, maxParticipants);
            messagingTemplate.convertAndSend("/topic/room/" + roomId, state);
            return ResponseEntity.ok(state);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // --- Room Invites Endpoints ---

    @GetMapping("/invites/pending")
    public ResponseEntity<List<InviteEvent>> getPendingInvites(@RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(roomInviteService.getPendingInvites(userId));
    }

    @PostMapping("/invites")
    public ResponseEntity<?> sendInvite(@RequestBody InviteEvent invite,
                                        @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }
        invite.setSenderId(userId);
        InviteEvent saved = roomInviteService.saveInvite(invite);
        messagingTemplate.convertAndSend("/topic/user/" + invite.getTargetUserId() + "/invites", saved);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/invites/{inviteId}/dismiss")
    public ResponseEntity<?> dismissInvite(@PathVariable String inviteId,
                                           @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }
        roomInviteService.dismissInvite(userId, inviteId);
        return ResponseEntity.ok(Map.of("message", "Invite dismissed"));
    }

    @GetMapping("/{roomId}/history")
    public ResponseEntity<WatchPartyHistory> getRoomHistory(@PathVariable String roomId) {
        log.info("REST request to fetch history for room: {}", roomId);
        return watchPartyHistoryRepository.findByRoomId(roomId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(
                        WatchPartyHistory.builder()
                                .roomId(roomId)
                                .build()
                ));
    }

    @PostMapping("/{roomId}/transfer-host")
    public ResponseEntity<?> transferHost(@PathVariable String roomId,
                                         @RequestParam Long newHostId,
                                         @RequestHeader("Authorization") String token) {
        Long currentUserId = extractUserId(token);
        if (currentUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
        }
        try {
            ActiveRoomState state = roomPermissionService.transferHost(roomId, currentUserId, newHostId);
            return ResponseEntity.ok(state);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{roomId}/permissions")
    public ResponseEntity<List<RoomPermission>> getPermissions(@PathVariable String roomId) {
        return ResponseEntity.ok(roomPermissionService.getRoomPermissions(roomId));
    }
}
