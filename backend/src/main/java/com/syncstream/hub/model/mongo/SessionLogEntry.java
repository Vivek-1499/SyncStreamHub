package com.syncstream.hub.model.mongo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionLogEntry {
    private String action;          // PLAY, PAUSE, SEEK, JOIN, LEAVE
    private Instant timestamp;      // When the event happened
    private Double playbackPosition; // Video playback position in seconds
    private Long userId;            // User who triggered it
    private String username;        // Name of user who triggered it
}
