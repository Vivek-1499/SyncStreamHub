package com.syncstream.hub.model.mongo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "watch_party_histories")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WatchPartyHistory {

    @Id
    private String id;

    @Indexed(unique = true)
    private String roomId;

    @Builder.Default
    private List<SessionLogEntry> sessionLogs = new ArrayList<>();

    @Builder.Default
    private List<ChatMessageEntry> chatMessages = new ArrayList<>();
}
