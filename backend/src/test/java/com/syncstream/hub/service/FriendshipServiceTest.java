package com.syncstream.hub.service;

import com.syncstream.hub.model.dto.UserDto;
import com.syncstream.hub.model.jpa.Friendship;
import com.syncstream.hub.model.jpa.FriendshipStatus;
import com.syncstream.hub.model.jpa.User;
import com.syncstream.hub.repository.jpa.FriendshipRepository;
import com.syncstream.hub.repository.jpa.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FriendshipServiceTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FriendshipService friendshipService;

    private User user1;
    private User user2;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).username("alice").email("alice@test.com").build();
        user2 = User.builder().id(2L).username("bob").email("bob@test.com").build();
    }

    @Test
    @DisplayName("Should successfully send friend request")
    void testSendFriendRequest_Success() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
        when(userRepository.findByUsername("bob")).thenReturn(Optional.of(user2));
        when(friendshipRepository.findRelationship(1L, 2L)).thenReturn(Optional.empty());

        Friendship mockFriendship = Friendship.builder().id(10L).user(user1).friend(user2).status(FriendshipStatus.PENDING).build();
        when(friendshipRepository.save(any(Friendship.class))).thenReturn(mockFriendship);

        Friendship result = friendshipService.sendFriendRequest(1L, "bob");
        assertNotNull(result);
        assertEquals(FriendshipStatus.PENDING, result.getStatus());
        assertEquals("bob", result.getFriend().getUsername());
    }

    @Test
    @DisplayName("Should return accepted friends list")
    void testGetAcceptedFriends() {
        Friendship friendship = Friendship.builder().id(10L).user(user1).friend(user2).status(FriendshipStatus.ACCEPTED).build();
        when(friendshipRepository.findAllByUserIdAndStatus(1L, FriendshipStatus.ACCEPTED)).thenReturn(List.of(friendship));

        List<UserDto> friends = friendshipService.getAcceptedFriends(1L);
        assertEquals(1, friends.size());
        assertEquals("bob", friends.get(0).getUsername());
    }
}
