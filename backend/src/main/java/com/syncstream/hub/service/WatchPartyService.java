package com.syncstream.hub.service;

import com.syncstream.hub.model.mongo.ChatMessageEntry;
import com.syncstream.hub.model.mongo.SessionLogEntry;
import com.syncstream.hub.model.mongo.WatchPartyHistory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class WatchPartyService {

    private final MongoTemplate mongoTemplate;

    /**
     * Appends a session playback sync event to MongoDB asynchronously.
     */
    @Async("mongoAsyncExecutor")
    public void logSessionEventAsync(String roomId, SessionLogEntry entry) {
        log.info("Asynchronously logging event '{}' at {}s for room {} on thread {}", 
                 entry.getAction(), entry.getPlaybackPosition(), roomId, Thread.currentThread().getName());
        ensureHistoryDocumentExists(roomId);

        Query query = Query.query(Criteria.where("roomId").is(roomId));
        Update update = new Update().push("sessionLogs", entry);
        mongoTemplate.updateFirst(query, update, WatchPartyHistory.class);
    }

    /**
     * Appends a chat message to MongoDB asynchronously.
     */
    @Async("mongoAsyncExecutor")
    public void saveChatMessageAsync(String roomId, ChatMessageEntry entry) {
        log.info("Asynchronously saving chat message from user {} in room {} on thread {}", 
                 entry.getUsername(), roomId, Thread.currentThread().getName());
        ensureHistoryDocumentExists(roomId);

        Query query = Query.query(Criteria.where("roomId").is(roomId));
        Update update = new Update().push("chatMessages", entry);
        mongoTemplate.updateFirst(query, update, WatchPartyHistory.class);
    }

    /**
     * Safely ensures that a baseline document exists for the given room.
     */
    private synchronized void ensureHistoryDocumentExists(String roomId) {
        Query query = Query.query(Criteria.where("roomId").is(roomId));
        boolean exists = mongoTemplate.exists(query, WatchPartyHistory.class);
        
        if (!exists) {
            try {
                WatchPartyHistory history = WatchPartyHistory.builder()
                        .roomId(roomId)
                        .sessionLogs(new ArrayList<>())
                        .chatMessages(new ArrayList<>())
                        .build();
                mongoTemplate.insert(history);
                log.info("Created new Mongo WatchPartyHistory logger document for room: {}", roomId);
            } catch (Exception e) {
                // Catch duplicate key index errors in case of multi-threaded race condition
                log.warn("Mongo document for room {} was initialized concurrently: {}", roomId, e.getMessage());
            }
        }
    }
}
