package com.syncstream.hub.service;

import com.syncstream.hub.model.dto.UserDto;
import com.syncstream.hub.model.jpa.Friendship;
import com.syncstream.hub.model.jpa.FriendshipStatus;
import com.syncstream.hub.model.jpa.User;
import com.syncstream.hub.repository.jpa.FriendshipRepository;
import com.syncstream.hub.repository.jpa.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    public List<UserDto> searchUsers(String query, Long currentUserId) {
        return userRepository.findByUsernameContainingIgnoreCase(query).stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .map(u -> UserDto.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .email(u.getEmail())
                        .createdAt(u.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional
    public Friendship sendFriendRequest(Long userId, String targetUsername) {
        User sender = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User target = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new IllegalArgumentException("Target user '" + targetUsername + "' not found"));

        if (sender.getId().equals(target.getId())) {
            throw new IllegalArgumentException("Cannot send friend request to yourself");
        }

        Optional<Friendship> existing = friendshipRepository.findRelationship(sender.getId(), target.getId());
        if (existing.isPresent()) {
            throw new IllegalStateException("Friendship or request already exists between users");
        }

        Friendship friendship = Friendship.builder()
                .user(sender)
                .friend(target)
                .status(FriendshipStatus.PENDING)
                .build();

        log.info("User {} sent friend request to {}", sender.getUsername(), target.getUsername());
        return friendshipRepository.save(friendship);
    }

    @Transactional
    public Friendship respondToRequest(Long friendshipId, Long userId, boolean accept) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (!friendship.getFriend().getId().equals(userId)) {
            throw new SecurityException("Unauthorized to accept/decline this request");
        }

        if (accept) {
            friendship.setStatus(FriendshipStatus.ACCEPTED);
            log.info("Friendship request {} ACCEPTED by user {}", friendshipId, userId);
            return friendshipRepository.save(friendship);
        } else {
            friendshipRepository.delete(friendship);
            log.info("Friendship request {} DECLINED and removed by user {}", friendshipId, userId);
            return null;
        }
    }

    public List<UserDto> getAcceptedFriends(Long userId) {
        List<Friendship> friendships = friendshipRepository.findAllByUserIdAndStatus(userId, FriendshipStatus.ACCEPTED);
        return friendships.stream().map(f -> {
            User friendUser = f.getUser().getId().equals(userId) ? f.getFriend() : f.getUser();
            return UserDto.builder()
                    .id(friendUser.getId())
                    .username(friendUser.getUsername())
                    .email(friendUser.getEmail())
                    .createdAt(friendUser.getCreatedAt())
                    .build();
        }).toList();
    }

    public List<Friendship> getPendingRequests(Long userId) {
        return friendshipRepository.findPendingRequestsForUser(userId);
    }

    @Transactional
    public void removeFriend(Long userId, Long friendId) {
        Optional<Friendship> friendship = friendshipRepository.findRelationship(userId, friendId);
        friendship.ifPresent(f -> {
            friendshipRepository.delete(f);
            log.info("Removed friendship between user {} and friend {}", userId, friendId);
        });
    }
}
