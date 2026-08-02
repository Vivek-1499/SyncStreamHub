package com.syncstream.hub.service;

import com.syncstream.hub.model.redis.ActiveRoomState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomStateService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String ROOM_KEY_PREFIX = "room:state:";
    private static final String ACTIVE_ROOMS_SET = "active_rooms";
    private static final long CACHE_TTL_HOURS = 24;

    private String getRedisKey(String roomId) {
        return ROOM_KEY_PREFIX + roomId;
    }

    public boolean exists(String roomId) {
        String key = getRedisKey(roomId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    public void deleteRoom(String roomId) {
        String key = getRedisKey(roomId);
        redisTemplate.delete(key);
        redisTemplate.opsForSet().remove(ACTIVE_ROOMS_SET, roomId);
        log.info("Purged room state for '{}' from Redis cache", roomId);
    }

    public ActiveRoomState createRoom(String roomId, Long hostUserId, String hostUsername) {
        return createRoom(roomId, hostUserId, hostUsername, true, 10);
    }

    public ActiveRoomState createRoom(String roomId, Long hostUserId, String hostUsername, Boolean isPublic, Integer maxParticipants) {
        log.info("Creating new Room: {} (isPublic: {}, maxParticipants: {}) with Host: {} (ID: {})", 
                 roomId, isPublic, maxParticipants, hostUsername, hostUserId);
        
        ActiveRoomState state = ActiveRoomState.builder()
                .roomId(roomId)
                .videoUrl("https://vjs.zencdn.net/v/oceans.mp4")
                .playing(false)
                .playbackPosition(0.0)
                .participantCount(0)
                .lastUpdated(System.currentTimeMillis())
                .hostUserId(hostUserId)
                .hostUsername(hostUsername)
                .isPublic(isPublic != null ? isPublic : true)
                .maxParticipants(maxParticipants != null ? maxParticipants : 10)
                .build();
                
        saveRoomState(state);
        return state;
    }

    public ActiveRoomState updateRoomSettings(String roomId, Long userId, Boolean isPublic, Integer maxParticipants) {
        ActiveRoomState state = getRoomState(roomId);
        if (state == null) {
            throw new IllegalArgumentException("Room '" + roomId + "' does not exist.");
        }
        if (state.getHostUserId() != null && !state.getHostUserId().equals(userId)) {
            throw new SecurityException("Only the room host can update settings.");
        }

        if (isPublic != null) {
            state.setPublic(isPublic);
        }
        if (maxParticipants != null) {
            state.setMaxParticipants(maxParticipants);
        }

        saveRoomState(state);
        log.info("Updated room '{}' settings: isPublic={}, maxParticipants={}", roomId, state.isPublic(), state.getMaxParticipants());
        return state;
    }

    public ActiveRoomState getRoomState(String roomId) {
        String key = getRedisKey(roomId);
        return (ActiveRoomState) redisTemplate.opsForValue().get(key);
    }

    public void saveRoomState(ActiveRoomState state) {
        String key = getRedisKey(state.getRoomId());
        state.setLastUpdated(System.currentTimeMillis());
        redisTemplate.opsForValue().set(key, state, CACHE_TTL_HOURS, TimeUnit.HOURS);
        redisTemplate.opsForSet().add(ACTIVE_ROOMS_SET, state.getRoomId());
    }

    public ActiveRoomState incrementParticipantCount(String roomId) {
        ActiveRoomState state = getRoomState(roomId);
        if (state != null) {
            state.setParticipantCount(state.getParticipantCount() + 1);
            saveRoomState(state);
            log.info("Participant joined room {}. Count: {}", roomId, state.getParticipantCount());
        }
        return state;
    }

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

    public List<ActiveRoomState> getPublicRooms() {
        Set<Object> roomIds = redisTemplate.opsForSet().members(ACTIVE_ROOMS_SET);
        List<ActiveRoomState> rooms = new ArrayList<>();
        if (roomIds != null) {
            for (Object idObj : roomIds) {
                String roomId = idObj.toString();
                ActiveRoomState state = getRoomState(roomId);
                if (state != null) {
                    if (state.isPublic()) {
                        rooms.add(state);
                    }
                } else {
                    redisTemplate.opsForSet().remove(ACTIVE_ROOMS_SET, roomId);
                }
            }
        }
        return rooms;
    }
}
