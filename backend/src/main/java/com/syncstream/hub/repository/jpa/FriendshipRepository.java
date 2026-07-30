package com.syncstream.hub.repository.jpa;

import com.syncstream.hub.model.jpa.Friendship;
import com.syncstream.hub.model.jpa.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    List<Friendship> findByUser_IdOrFriend_Id(Long userId, Long friendId);
    List<Friendship> findByUser_IdAndStatus(Long userId, FriendshipStatus status);
    Optional<Friendship> findByUser_IdAndFriend_Id(Long userId, Long friendId);
}
