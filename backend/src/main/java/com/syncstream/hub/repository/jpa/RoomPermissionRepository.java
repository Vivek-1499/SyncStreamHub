package com.syncstream.hub.repository.jpa;

import com.syncstream.hub.model.jpa.RoomPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomPermissionRepository extends JpaRepository<RoomPermission, Long> {
    List<RoomPermission> findByRoomId(String roomId);
    Optional<RoomPermission> findByRoomIdAndUser_Id(String roomId, Long userId);
}
