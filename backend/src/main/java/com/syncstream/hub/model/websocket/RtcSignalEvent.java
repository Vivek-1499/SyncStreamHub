package com.syncstream.hub.model.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RtcSignalEvent {
    private Long senderId;
    private Long targetId;  // Target peer ID who should receive this signal
    private String type;    // "offer", "answer", or "candidate"
    private Object data;    // The actual SDP string or ICE Candidate object
}
