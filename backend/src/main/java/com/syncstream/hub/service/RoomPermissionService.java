package com.syncstream.hub.service;

import com.syncstream.hub.model.jpa.RoomPermission;
import com.syncstream.hub.model.jpa.RoomRole;
import com.syncstream.hub.model.jpa.User;
import com.syncstream.hub.model.redis.ActiveRoomState;
import com.syncstream.hub.repository.jpa.RoomPermissionRepository;
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
public class RoomPermissionService {

    private final RoomPermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final RoomStateService roomStateService;

    @Transactional
    public RoomPermission assignRole(String roomId, Long userId, RoomRole role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Optional<RoomPermission> existing = permissionRepository.findByRoomIdAndUser_Id(roomId, userId);
        RoomPermission perm;
        if (existing.isPresent()) {
            perm = existing.get();
            perm.setRole(role);
        } else {
            perm = RoomPermission.builder()
                    .roomId(roomId)
                    .user(user)
                    .role(role)
                    .build();
        }
        log.info("Assigned role {} to user {} in room {}", role, user.getUsername(), roomId);
        return permissionRepository.save(perm);
    }

    public List<RoomPermission> getRoomPermissions(String roomId) {
        return permissionRepository.findByRoomId(roomId);
    }

    @Transactional
    public ActiveRoomState transferHost(String roomId, Long currentHostId, Long newHostId) {
        ActiveRoomState state = roomStateService.getRoomState(roomId);
        if (state == null) {
            throw new IllegalArgumentException("Room not found: " + roomId);
        }
        if (!state.getHostUserId().equals(currentHostId)) {
            throw new SecurityException("Only the current host can transfer host status");
        }

        User newHost = userRepository.findById(newHostId)
                .orElseThrow(() -> new IllegalArgumentException("Target new host not found: " + newHostId));

        assignRole(roomId, currentHostId, RoomRole.VIEWER);
        assignRole(roomId, newHostId, RoomRole.HOST);

        state.setHostUserId(newHost.getId());
        state.setHostUsername(newHost.getUsername());
        roomStateService.saveRoomState(state);

        log.info("Transferred host of room {} from user {} to user {}", roomId, currentHostId, newHost.getUsername());
        return state;
    }
}
