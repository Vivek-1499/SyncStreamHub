export interface SyncEvent {
  action: 'PLAY' | 'PAUSE' | 'SEEK' | 'JOIN' | 'LEAVE' | 'CHANGE_VIDEO';
  playbackPosition: number;
  userId: number;
  username: string;
  videoUrl?: string;
  timestamp: number;
}

export interface ChatEvent {
  id?: string;
  userId: number;
  username: string;
  message: string; // Used for text chat messages or flying emoji characters
  timestamp?: number;
}

export interface ActiveRoomState {
  roomId: string;
  videoUrl: string;
  playing: boolean;
  playbackPosition: number;
  lastUpdated: number;
  participantCount: number;
  hostUserId?: number | null;
  hostUsername?: string | null;
}

export interface SessionLogEntry {
  action: string;
  timestamp: string;
  playbackPosition: number;
  userId: number;
  username: string;
}

export interface ChatMessageEntry {
  id: string;
  userId: number;
  username: string;
  message: string;
  timestamp: string;
}

export interface WatchPartyHistory {
  roomId: string;
  sessionLogs: SessionLogEntry[];
  chatMessages: ChatMessageEntry[];
}
