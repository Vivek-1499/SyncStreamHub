package com.syncstream.hub.service;

import com.syncstream.hub.model.redis.ActiveRoomState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.RedisTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RoomStateServiceTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private SetOperations<String, Object> setOperations;

    @InjectMocks
    private RoomStateService roomStateService;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(redisTemplate.opsForSet()).thenReturn(setOperations);
    }

    @Test
    @DisplayName("Should create watch party room and add to active rooms set")
    void testCreateRoom() {
        ActiveRoomState created = roomStateService.createRoom("party-101", 1L, "hostuser");
        assertNotNull(created);
        assertEquals("party-101", created.getRoomId());
        assertEquals("hostuser", created.getHostUsername());
        assertTrue(created.isPublic());
        assertEquals(10, created.getMaxParticipants());
        verify(setOperations, times(1)).add("active_rooms", "party-101");
    }
}
