package com.syncstream.hub.controller;

import com.syncstream.hub.model.dto.UserDto;
import com.syncstream.hub.model.jpa.Friendship;
import com.syncstream.hub.security.JwtTokenProvider;
import com.syncstream.hub.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class FriendshipController {


    private final FriendshipService friendshipService;
    private final JwtTokenProvider tokenProvider;
    private final SimpMessagingTemplate messagingTemplate;

    private Long extractUserId(String bearerToken) {
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            String token = bearerToken.substring(7);
            if (tokenProvider.validateToken(token)) {
                Long userId = tokenProvider.getUserIdFromTokenSafely(token);
                if (userId != null) {
                    return userId;
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing, expired, or invalid Authorization token");
    }


    @GetMapping("/search")
    public ResponseEntity<List<UserDto>> searchUsers(@RequestParam String query,
                                                     @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        return ResponseEntity.ok(friendshipService.searchUsers(query, userId));
    }

    @PostMapping("/request")
    public ResponseEntity<?> sendRequest(@RequestParam String username,
                                         @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        try {
            Friendship friendship = friendshipService.sendFriendRequest(userId, username);
            Map<String, Object> reqData = Map.of(
                    "id", friendship.getId(),
                    "senderId", friendship.getUser().getId(),
                    "senderUsername", friendship.getUser().getUsername(),
                    "targetUserId", friendship.getFriend().getId(),
                    "targetUsername", friendship.getFriend().getUsername()
            );
            messagingTemplate.convertAndSend("/topic/user/" + friendship.getFriend().getId() + "/friend-requests", reqData);
            return ResponseEntity.ok(Map.of("message", "Friend request sent to " + username, "id", friendship.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/accept/{friendshipId}")
    public ResponseEntity<?> acceptRequest(@PathVariable Long friendshipId,
                                           @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        try {
            friendshipService.respondToRequest(friendshipId, userId, true);
            return ResponseEntity.ok(Map.of("message", "Friend request accepted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/decline/{friendshipId}")
    public ResponseEntity<?> declineRequest(@PathVariable Long friendshipId,
                                            @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        try {
            friendshipService.respondToRequest(friendshipId, userId, false);
            return ResponseEntity.ok(Map.of("message", "Friend request declined"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<?> removeFriend(@PathVariable Long friendId,
                                         @RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        try {
            friendshipService.removeFriend(userId, friendId);
            return ResponseEntity.ok(Map.of("message", "Friend removed successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> getFriends(@RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        return ResponseEntity.ok(friendshipService.getAcceptedFriends(userId));
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(@RequestHeader("Authorization") String token) {
        Long userId = extractUserId(token);
        List<Map<String, Object>> requests = friendshipService.getPendingRequests(userId).stream()
                .map(f -> Map.<String, Object>of(
                        "id", f.getId(),
                        "senderId", f.getUser().getId(),
                        "senderUsername", f.getUser().getUsername(),
                        "createdAt", f.getCreatedAt()
                )).toList();
        return ResponseEntity.ok(requests);
    }
}
