package com.syncstream.hub.model.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SyncEvent {
    private String action;          // PLAY, PAUSE, SEEK, JOIN, LEAVE
    private Double playbackPosition; // Current play position in seconds
    private Long userId;            // User sending the sync command
    private String username;        // Username of the sender
    private String videoUrl;        // URL of the video (optional, if room switches video)
    private Long timestamp;         // Epoch timestamp
}
