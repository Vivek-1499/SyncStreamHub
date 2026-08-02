export interface UserDto {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: UserDto;
}

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
  message: string;
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
  isPublic?: boolean;
  maxParticipants?: number;
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

export interface InviteEvent {
  id?: string;
  roomId: string;
  senderId: number;
  senderUsername: string;
  targetUserId: number;
  timestamp: number;
}

export interface RtcSignalEvent {
  senderId: number;
  targetId?: number;
  type: 'offer' | 'answer' | 'candidate';
  data: any;
}

export interface PendingRequest {
  id: number;
  senderId: number;
  senderUsername: string;
  createdAt: string;
}
