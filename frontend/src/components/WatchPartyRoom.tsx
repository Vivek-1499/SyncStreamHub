import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { useWebSocket } from '../hooks/useWebSocket';
import type { ActiveRoomState, ChatEvent, WatchPartyHistory } from '../types';

interface WatchPartyRoomProps {
  roomId: string;
  userId: number;
  username: string;
  onExit: () => void;
  onLogout: () => void;
}

interface FloatingEmoji {
  id: number;
  emoji: string;
  offset: number; // random horizontal offset (percentage)
}

export const WatchPartyRoom: React.FC<WatchPartyRoomProps> = ({
  roomId,
  userId,
  username,
  onExit,
  onLogout,
}) => {
  const playerRef = useRef<React.ElementRef<typeof ReactPlayer> | null>(null);

  // Guard flag to prevent infinite STOMP sync loops
  const isProcessingIncomingEvent = useRef<boolean>(false);

  const [roomState, setRoomState] = useState<ActiveRoomState | null>(null);
  const [chats, setChats] = useState<ChatEvent[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [localPlaying, setLocalPlaying] = useState(false);
  type VideoSourceType = 'url' | 'device';

  const [sourceType, setSourceType] = useState<VideoSourceType>('url');
  const [localFileName, setLocalFileName] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isHost = roomState ? userId === roomState.hostUserId : false;

  // Safe seekTo helper that handles direct class instance methods, nested structures, and HTML5 video fallbacks
  const seekTo = (seconds: number) => {
    if (!playerRef.current) return;
    (playerRef.current as unknown as HTMLMediaElement).currentTime = seconds;
  };

  const getCurrentTime = (): number => {
    if (!playerRef.current) return 0;
    return (playerRef.current as unknown as HTMLMediaElement).currentTime || 0;
  };

  // 1. Fetch initial state & history on component load
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/rooms';

    // Fetch Room State
    fetch(`${apiUrl}/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch room state');
        return res.json();
      })
      .then((data: ActiveRoomState) => {
        setRoomState(data);
        setLocalPlaying(data.playing);
        // Note: The initial seek is triggered inside handlePlayerReady once ReactPlayer is loaded in the DOM
      })
      .catch((err) => console.error('Error fetching room state:', err));

    // Fetch Room Chat & Session History
    fetch(`${apiUrl}/${roomId}/history`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch room history');
        return res.json();
      })
      .then((data: WatchPartyHistory) => {
        if (data.chatMessages) {
          const loadedChats: ChatEvent[] = data.chatMessages.map(msg => ({
            id: msg.id,
            userId: msg.userId,
            username: msg.username,
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime()
          }));
          setChats(loadedChats);
        }
        if (data.sessionLogs) {
          const logs = data.sessionLogs.map(log =>
            `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.username} triggered ${log.action} at ${log.playbackPosition.toFixed(1)}s`
          );
          setSystemLogs(logs);
        }
      })
      .catch((err) => console.error('Error loading room history:', err));
  }, [roomId]);

  // Scroll chat list to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  // Player onReady Callback (Ensures media is active before seek actions are issued)
  const handlePlayerReady = () => {
    console.log('[ReactPlayer] Player loaded and ready');
    if (roomState) {
      // Suppress the player's own internal startup seek/pause events
      // for everyone, host included, not just viewers.
      isProcessingIncomingEvent.current = true;

      if (!isHost) {
        console.log(`[ReactPlayer] Initial position sync: seeking to ${roomState.playbackPosition}s`);
        seekTo(roomState.playbackPosition);
      }

      setLocalPlaying(roomState.playing);

      setTimeout(() => {
        isProcessingIncomingEvent.current = false;
      }, 1000); // give the player enough time to fully settle before trusting seek events
    }
  };

  // WebSocket Callbacks
  const handleRoomStateReceived = (newState: ActiveRoomState) => {
    setRoomState(newState);

    // Viewers stay strictly synchronized with the Host's position
    const viewerIsHost = userId === newState.hostUserId;
    if (!viewerIsHost) {
      setLocalPlaying(newState.playing);

      if (playerRef.current) {
        const currentPlayerTime = getCurrentTime();
        const timeDelta = Math.abs(currentPlayerTime - newState.playbackPosition);

        // If viewer drifts by more than 1.5 seconds, force a seek sync
        if (timeDelta > 1.5) {
          console.log(`[Sync Event] Drift of ${timeDelta.toFixed(1)}s detected. Syncing to ${newState.playbackPosition.toFixed(1)}s`);
          isProcessingIncomingEvent.current = true;
          seekTo(newState.playbackPosition);
          setTimeout(() => {
            isProcessingIncomingEvent.current = false;
          }, 200);
        }
      }
    } else {
      // If we are the Host, update localPlaying if the video URL changed
      if (roomState && roomState.videoUrl !== newState.videoUrl) {
        setLocalPlaying(newState.playing);
      }
    }
  };

  const handleChatMessageReceived = (newChat: ChatEvent) => {
    setChats((prev) => [...prev, newChat]);
  };

  const handleEmojiReceived = (emojiEvent: ChatEvent) => {
    const offset = Math.floor(Math.random() * 80) + 10;
    const newEmoji: FloatingEmoji = {
      id: Date.now() + Math.random(),
      emoji: emojiEvent.message,
      offset,
    };

    setFloatingEmojis((prev) => [...prev, newEmoji]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 3000);
  };

  // Connect STOMP socket hook
  const { connected, sendSyncEvent, sendChatMessage, sendEmoji } = useWebSocket({
    roomId,
    userId,
    username,
    onRoomStateReceived: handleRoomStateReceived,
    onChatMessageReceived: handleChatMessageReceived,
    onEmojiReceived: handleEmojiReceived,
  });

  // Local Player Action Hooks (Only the Host can broadcast these)
  const handleLocalPlay = () => {
    if (isProcessingIncomingEvent.current) return;
    if (isHost && playerRef.current) {
      console.log('[Play Sync] Broadcast PLAY');
      setLocalPlaying(true);
      sendSyncEvent('PLAY', getCurrentTime());
    }
  };

  const handleLocalPause = () => {
    if (isProcessingIncomingEvent.current) return;
    if (isHost && playerRef.current) {
      console.log('[Pause Sync] Broadcast PAUSE');
      setLocalPlaying(false);
      sendSyncEvent('PAUSE', getCurrentTime());
    }
  };

  const handleLocalSeek = (seconds: number) => {
    if (isProcessingIncomingEvent.current) return;
    if (isHost) {
      console.log(`[Seek Sync] Broadcast SEEK to ${seconds.toFixed(1)}s`);
      sendSyncEvent('SEEK', seconds);
    }
  };

  // Change Video URL (Host control only)
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLocalFileName(file.name);
  };

  const handleChangeVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) return;

    if (sourceType === 'url') {
      if (!newVideoUrl.trim()) return;
      sendSyncEvent('CHANGE_VIDEO', 0, newVideoUrl.trim());
      setNewVideoUrl('');
      return;
    }

    // Device mode: actually upload the bytes
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    try {
      const res = await fetch(`${apiUrl}/uploads/video`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data: { url: string } = await res.json();
      sendSyncEvent('CHANGE_VIDEO', 0, data.url); // now a real, shared URL
    } catch (err) {
      console.error('Video upload failed', err);
    }
  };
  // Chat send
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendChatMessage(chatMessage.trim());
    setChatMessage('');
  };

  const reactionEmojis = ['❤️', '😂', '😮', '🎉', '👍', '🔥'];

  return (
    <div className="room-container">
      {/* Header */}
      <header className="room-header glass-card">
        <div className="header-brand">
          <span className="brand-logo">🍿</span>
          <h2>Room: <span className="highlight-text">{roomId}</span></h2>
        </div>

        <div className="host-badge">
          👑 Host: <span className="highlight-text">{roomState?.hostUsername || 'Unknown'}</span>
          {isHost && <span className="host-badge-you">(You)</span>}
        </div>

        <div className="header-status">
          <div className="connection-badge">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
            {connected ? 'Connected' : 'Reconnecting...'}
          </div>
          <div className="participants-badge">
            👥 {roomState?.participantCount || 0} watching
          </div>
          <button className="btn-secondary exit-btn" onClick={onExit}>
            Leave Room
          </button>
          <button className="btn-primary exit-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="room-workspace">
        <div className="video-section glass-card">

          {/* React Player Wrapper */}
          <div className="player-wrapper">
            <ReactPlayer
              ref={playerRef}
              src={roomState?.videoUrl}
              playing={localPlaying}
              muted={!isHost}
              controls={isHost} // Only the Host has scrub/play buttons
              width="100%"
              height="100%"
              className="react-player"
              onReady={handlePlayerReady}
              onPlay={handleLocalPlay}
              onPause={handleLocalPause}
              onSeeked={() => handleLocalSeek(getCurrentTime())}
            />

            {/* Floating Emojis Fly Animation Overlay */}
            <div className="emoji-fly-container">
              {floatingEmojis.map((item) => (
                <span
                  key={item.id}
                  className="floating-emoji animate-float"
                  style={{ left: `${item.offset}%` }}
                >
                  {item.emoji}
                </span>
              ))}
            </div>

            {/* Viewer Block Overlay to prevent clicking raw video elements to pause */}
            {!isHost && (
              <div className="player-blocker-overlay" />
            )}
          </div>

          {/* Host Control Toolbar */}
          <div className="player-toolbar">
            <div className="video-info">
              <h3>Currently Playing:</h3>
              <code className="video-url">{roomState?.videoUrl}</code>
            </div>

            {isHost ? (
              <form onSubmit={handleChangeVideo} className="change-url-form">
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as VideoSourceType)}
                  className="lobby-input toolbar-input"
                >
                  <option value="url">Paste URL</option>
                  <option value="device">Choose from device</option>
                </select>

                {sourceType === 'url' ? (
                  <input
                    type="text"
                    placeholder="Paste YouTube/Vimeo/HLS/mp4 link..."
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    className="lobby-input toolbar-input"
                  />
                ) : (
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleLocalFileSelect}
                    className="lobby-input toolbar-input"
                  />
                )}

                <button type="submit" className="btn-primary toolbar-btn">
                  Update Stream
                </button>
              </form>
            ) : (
              <div className="viewer-locked-indicator">🔒 Playback controls synced to Host</div>
            )}
          </div>

          {/* Emojis Reactions Dock */}
          <div className="emoji-reactions-dock">
            <h4>Tap Reactions:</h4>
            <div className="reaction-buttons">
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn animate-hover"
                  onClick={() => sendEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Room event log feed */}
          <div className="system-logs-container">
            <h4>Room Event Log (MongoDB Audit Feed)</h4>
            <div className="system-logs-list">
              {systemLogs.length === 0 && <p className="empty-text">No events logged yet.</p>}
              {systemLogs.map((logStr, i) => (
                <div key={i} className="system-log-entry">{logStr}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat sidebar panel */}
        <aside className="chat-section glass-card">
          <div className="chat-header">
            <h3>Interactive Chat</h3>
          </div>
          <div className="chat-messages-container">
            {chats.length === 0 ? (
              <div className="empty-chat-message">
                <span className="chat-icon">💬</span>
                <p>Welcome to the watch party! Chat with the room here.</p>
              </div>
            ) : (
              chats.map((chat, idx) => (
                <div
                  key={chat.id || idx}
                  className={`chat-bubble-wrapper ${chat.userId === userId ? 'own-message' : ''}`}
                >
                  <div className="chat-meta">
                    <span className="chat-sender">{chat.username}</span>
                    {chat.timestamp && (
                      <span className="chat-time">
                        {new Date(chat.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="chat-bubble">{chat.message}</div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-form" onSubmit={handleSendChat}>
            <input
              type="text"
              placeholder="Chat with your group..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="chat-input"
              maxLength={250}
            />
            <button type="submit" className="chat-send-btn btn-primary">
              Send
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};
