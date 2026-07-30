package com.syncstream.hub.controller;

import com.syncstream.hub.model.mongo.WatchPartyHistory;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.repository.mongo.WatchPartyHistoryRepository;
import com.syncstream.hub.service.RoomStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class RoomController {

    private final RoomStateService roomStateService;
    private final WatchPartyHistoryRepository watchPartyHistoryRepository;

    /**
     * Retrieves the current room state cached in Redis. Returns 404 if not found.
     */
    @GetMapping("/{roomId}")
    public ResponseEntity<?> getRoomState(@PathVariable String roomId) {
        log.info("Checking room existence for: {}", roomId);
        if (!roomStateService.exists(roomId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "There is no watch party happening in room '" + roomId + "'. Please check the ID or create a room."));
        }
        ActiveRoomState state = roomStateService.getRoomState(roomId);
        return ResponseEntity.ok(state);
    }

    /**
     * Explicitly creates a new watch party room. Returns 400 if it already exists.
     */
    @PostMapping("/create")
    public ResponseEntity<?> createRoom(@RequestParam String roomId,
                                        @RequestParam Long userId,
                                        @RequestParam String username) {
        log.info("Request to create room '{}' by host user: {}", roomId, username);
        
        if (roomStateService.exists(roomId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Watch party room '" + roomId + "' is already active. Choose a different ID or join it."));
        }

        ActiveRoomState state = roomStateService.createRoom(roomId, userId, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(state);
    }

    /**
     * Retrieves the watch history (chat logs & playback events) from MongoDB.
     */
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
}
