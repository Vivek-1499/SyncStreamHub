package com.syncstream.hub.service;

import com.syncstream.hub.model.websocket.InviteEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomInviteService {

    // TargetUserId -> List of pending InviteEvents
    private final Map<Long, List<InviteEvent>> userInvitesMap = new ConcurrentHashMap<>();

    public InviteEvent saveInvite(InviteEvent invite) {
        if (invite.getId() == null || invite.getId().trim().isEmpty()) {
            invite.setId(UUID.randomUUID().toString());
        }
        if (invite.getTimestamp() <= 0) {
            invite.setTimestamp(System.currentTimeMillis());
        }

        userInvitesMap.compute(invite.getTargetUserId(), (k, list) -> {
            if (list == null) list = new ArrayList<>();
            // Avoid duplicate invite from same sender to same room
            list.removeIf(inv -> inv.getRoomId().equalsIgnoreCase(invite.getRoomId()) 
                              && inv.getSenderId().equals(invite.getSenderId()));
            list.add(invite);
            return list;
        });

        log.info("Saved room invite ID {} from {} to target user {}", 
                 invite.getId(), invite.getSenderUsername(), invite.getTargetUserId());
        return invite;
    }

    public List<InviteEvent> getPendingInvites(Long targetUserId) {
        List<InviteEvent> list = userInvitesMap.getOrDefault(targetUserId, Collections.emptyList());
        return new ArrayList<>(list);
    }

    public void dismissInvite(Long targetUserId, String inviteId) {
        userInvitesMap.computeIfPresent(targetUserId, (k, list) -> {
            list.removeIf(inv -> inv.getId().equals(inviteId));
            return list.isEmpty() ? null : list;
        });
        log.info("Dismissed room invite ID {} for user {}", inviteId, targetUserId);
    }
}
