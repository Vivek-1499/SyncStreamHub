package com.syncstream.hub.model.redis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActiveRoomState implements Serializable {
    private static final long serialVersionUID = 1L;

    private String roomId;
    private String videoUrl;
    private boolean playing; // Renamed to align precisely with Jackson serialization outputs ("playing")
    private Double playbackPosition; // current video position in seconds
    private Long lastUpdated;         // timestamp in epoch milliseconds
    private Integer participantCount;
    private String playbackToken;     // unique token to authenticate sync command authority if needed
    
    // Host parameters for synchronized playback authority
    private Long hostUserId;
    private String hostUsername;

    @Builder.Default
    private boolean isPublic = true;

    @Builder.Default
    private Integer maxParticipants = 10; // 0 for unlimited
}
