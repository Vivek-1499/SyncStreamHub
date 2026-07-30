package com.syncstream.hub.service;

import com.syncstream.hub.model.redis.ActiveRoomState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomStateService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String ROOM_KEY_PREFIX = "room:state:";
    private static final long CACHE_TTL_HOURS = 24;

    private String getRedisKey(String roomId) {
        return ROOM_KEY_PREFIX + roomId;
    }

    /**
     * Checks if a watch party room exists in Redis.
     */
    public boolean exists(String roomId) {
        String key = getRedisKey(roomId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Deletes a watch party room from Redis completely.
     */
    public void deleteRoom(String roomId) {
        String key = getRedisKey(roomId);
        redisTemplate.delete(key);
        log.info("Purged room state for '{}' from Redis cache", roomId);
    }

    /**
     * Creates and initializes a new watch party room state with an assigned host.
     */
    public ActiveRoomState createRoom(String roomId, Long hostUserId, String hostUsername) {
        log.info("Creating new Room: {} with Host: {} (ID: {})", roomId, hostUsername, hostUserId);
        
        ActiveRoomState state = ActiveRoomState.builder()
                .roomId(roomId)
                .videoUrl("https://vjs.zencdn.net/v/oceans.mp4") // Baseline video URL
                .playing(false) // Updated builder parameter to match the renamed field
                .playbackPosition(0.0)
                .participantCount(0)
                .lastUpdated(System.currentTimeMillis())
                .hostUserId(hostUserId)
                .hostUsername(hostUsername)
                .build();
                
        saveRoomState(state);
        return state;
    }

    /**
     * Retrieves the active room state from Redis. Returns null if the room does not exist.
     */
    public ActiveRoomState getRoomState(String roomId) {
        String key = getRedisKey(roomId);
        return (ActiveRoomState) redisTemplate.opsForValue().get(key);
    }

    /**
     * Saves or updates the room state in Redis with a 24-hour expiration.
     */
    public void saveRoomState(ActiveRoomState state) {
        String key = getRedisKey(state.getRoomId());
        state.setLastUpdated(System.currentTimeMillis());
        redisTemplate.opsForValue().set(key, state, CACHE_TTL_HOURS, TimeUnit.HOURS);
    }

    /**
     * Safely increments the active participant count for a room.
     */
    public ActiveRoomState incrementParticipantCount(String roomId) {
        ActiveRoomState state = getRoomState(roomId);
        if (state != null) {
            state.setParticipantCount(state.getParticipantCount() + 1);
            saveRoomState(state);
            log.info("Participant joined room {}. Count: {}", roomId, state.getParticipantCount());
        }
        return state;
    }

    /**
     * Safely decrements the active participant count for a room.
     */
    public ActiveRoomState decrementParticipantCount(String roomId) {
        ActiveRoomState state = getRoomState(roomId);
        if (state != null) {
            int currentCount = state.getParticipantCount();
            state.setParticipantCount(Math.max(0, currentCount - 1));
            saveRoomState(state);
            log.info("Participant left room {}. Count: {}", roomId, state.getParticipantCount());
        }
        return state;
    }
}
