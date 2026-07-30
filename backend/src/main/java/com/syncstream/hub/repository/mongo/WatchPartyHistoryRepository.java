package com.syncstream.hub.repository.mongo;

import com.syncstream.hub.model.mongo.WatchPartyHistory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WatchPartyHistoryRepository extends MongoRepository<WatchPartyHistory, String> {
    Optional<WatchPartyHistory> findByRoomId(String roomId);
}
