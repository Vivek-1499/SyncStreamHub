import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { useWebSocket } from '../hooks/useWebSocket';
import { FriendsModal } from './FriendsModal';
import type { ActiveRoomState, ChatEvent, WatchPartyHistory, InviteEvent } from '../types';
import { authFetch, isTokenExpired } from '../utils/authUtils';

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
  right: number;
  size: number;
  delay: number;
  driftX: number;
  duration: number;
}

interface InRoomFriendRequest {
  id: number;
  senderId: number;
  senderUsername: string;
}

export const WatchPartyRoom: React.FC<WatchPartyRoomProps> = ({
  roomId,
  userId,
  username,
  onExit,
  onLogout,
}) => {
  const playerRef = useRef<React.ElementRef<typeof ReactPlayer> | null>(null);
  const isProcessingIncomingEvent = useRef<boolean>(false);

  const [roomState, setRoomState] = useState<ActiveRoomState | null>(null);
  const [chats, setChats] = useState<ChatEvent[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [localPlaying, setLocalPlaying] = useState(false);
  
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  type VideoSourceType = 'url' | 'device';
  const [sourceType, setSourceType] = useState<VideoSourceType>('url');

  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [inviteNotification, setInviteNotification] = useState<InviteEvent | null>(null);
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const [editIsPublic, setEditIsPublic] = useState<boolean>(true);
  const [editMaxParticipants, setEditMaxParticipants] = useState<number>(10);

  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [chatUserStatus, setChatUserStatus] = useState<string>('');
  const [inRoomFriendRequest, setInRoomFriendRequest] = useState<InRoomFriendRequest | null>(null);

  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isHost = roomState ? userId === roomState.hostUserId : false;
  const token = localStorage.getItem('syncstream_token');
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

  const seekTo = (seconds: number) => {
    if (!playerRef.current) return;
    if (typeof (playerRef.current as any).seekTo === 'function') {
      (playerRef.current as any).seekTo(seconds, 'seconds');
    } else if ((playerRef.current as unknown as HTMLMediaElement).currentTime !== undefined) {
      (playerRef.current as unknown as HTMLMediaElement).currentTime = seconds;
    }
  };

  const getCurrentTime = (): number => {
    if (!playerRef.current) return 0;
    if (typeof (playerRef.current as any).getCurrentTime === 'function') {
      return (playerRef.current as any).getCurrentTime() || 0;
    }
    return (playerRef.current as unknown as HTMLMediaElement).currentTime || 0;
  };

  const checkNotifications = useCallback(async () => {
    const currentToken = localStorage.getItem('syncstream_token');
    if (!currentToken || isTokenExpired(currentToken)) return;
    try {
      const [reqRes, invRes] = await Promise.all([
        authFetch(`${apiUrl}/friends/requests/pending`),
        authFetch(`${apiUrl}/rooms/invites/pending`),
      ]);
      let count = 0;
      if (reqRes.ok) {
        const reqs = await reqRes.json();
        count += reqs.length;
      }
      if (invRes.ok) {
        const invs = await invRes.json();
        count += invs.length;
      }
      setNotificationCount(count);
    } catch (e) {
      console.error('Error checking notifications', e);
    }
  }, [apiUrl]);

  useEffect(() => {
    checkNotifications();
  }, [checkNotifications]);

  const handleNotificationCountChange = useCallback((count: number) => {
    setNotificationCount(count);
  }, []);


  const roomStateRef = useRef<ActiveRoomState | null>(null);
  const loadedVideoUrlRef = useRef<string | null>(null);

  const handleRoomStateReceived = useCallback((newState: ActiveRoomState) => {
    const prevUrl = roomStateRef.current?.videoUrl;
    roomStateRef.current = newState;
    setRoomState(newState);
    if (newState.isPublic !== undefined) setEditIsPublic(newState.isPublic);
    if (newState.maxParticipants !== undefined) setEditMaxParticipants(newState.maxParticipants);

    const viewerIsHost = userId === newState.hostUserId;
    if (!viewerIsHost) {
      setLocalPlaying(newState.playing);
      if (playerRef.current) {
        const currentPlayerTime = getCurrentTime();
        const timeDelta = Math.abs(currentPlayerTime - (newState.playbackPosition || 0));

        if (!newState.playing) {
          if (timeDelta > 0.5) {
            isProcessingIncomingEvent.current = true;
            seekTo(newState.playbackPosition || 0);
            setTimeout(() => {
              isProcessingIncomingEvent.current = false;
            }, 300);
          }
        } else {
          if (timeDelta > 2.0) {
            isProcessingIncomingEvent.current = true;
            seekTo(newState.playbackPosition || 0);
            setTimeout(() => {
              isProcessingIncomingEvent.current = false;
            }, 300);
          }
        }
      }
    } else {
      if (prevUrl && prevUrl !== newState.videoUrl) {
        loadedVideoUrlRef.current = null;
        setLocalPlaying(newState.playing);
      }
    }
  }, [userId]);

  const handleChatMessageReceived = useCallback((newChat: ChatEvent) => {
    setChats((prev) => [...prev, newChat]);
  }, []);

  const handleEmojiReceived = useCallback((emojiEvent: ChatEvent) => {
    const count = Math.floor(Math.random() * 2) + 4;
    const streamBatch: FloatingEmoji[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + Math.random() + i,
      emoji: emojiEvent.message,
      right: 5 + Math.random() * 18,
      size: 1.6 + Math.random() * 0.8,
      delay: i * 0.03,
      driftX: (Math.random() - 0.5) * 45,
      duration: 1.8,
    }));

    setFloatingEmojis((prev) => [...prev, ...streamBatch]);

    setTimeout(() => {
      const batchIds = new Set(streamBatch.map((item) => item.id));
      setFloatingEmojis((prev) => prev.filter((e) => !batchIds.has(e.id)));
    }, 2800);
  }, []);

  const handleInviteReceived = useCallback((invite: InviteEvent) => {
    setInviteNotification(invite);
    setNotificationCount(prev => prev + 1);
  }, []);

  const handleFriendRequestReceived = useCallback((data: any) => {
    setInRoomFriendRequest({
      id: data.id,
      senderId: data.senderId,
      senderUsername: data.senderUsername,
    });
    setNotificationCount(prev => prev + 1);
  }, []);

  const { connected, sendSyncEvent, sendChatMessage, sendEmoji, sendPartyInvite } = useWebSocket({
    roomId,
    userId,
    username,
    token,
    onRoomStateReceived: handleRoomStateReceived,
    onChatMessageReceived: handleChatMessageReceived,
    onEmojiReceived: handleEmojiReceived,
    onInviteReceived: handleInviteReceived,
    onFriendRequestReceived: handleFriendRequestReceived,
  });

  useEffect(() => {
    const roomApiUrl = `${apiUrl}/rooms`;

    const fetchState = () => {
      fetch(`${roomApiUrl}/${roomId}?userId=${userId}`)
        .then((res) => {
          if (res.status === 404) {
            localStorage.removeItem('syncstream_roomId');
            onExit();
            throw new Error('Room no longer exists');
          }
          if (!res.ok) throw new Error('Failed to fetch room state');
          return res.json();
        })
        .then((data: ActiveRoomState) => {
          roomStateRef.current = data;
          setRoomState(data);
          setLocalPlaying(data.playing);
          if (data.isPublic !== undefined) setEditIsPublic(data.isPublic);
          if (data.maxParticipants !== undefined) setEditMaxParticipants(data.maxParticipants);
        })
        .catch((err) => console.error('Error fetching room state:', err));
    };

    fetchState();

    fetch(`${roomApiUrl}/${roomId}/history`)
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

    const pollInterval = setInterval(() => {
      if (!connected) {
        fetchState();
      }
    }, 6000);

    return () => clearInterval(pollInterval);
  }, [roomId, userId, apiUrl, connected, onExit]);

  const handlePlayerReady = useCallback(() => {
    const currentRoomState = roomStateRef.current;
    if (!currentRoomState) return;

    const currentUrl = currentRoomState.videoUrl;
    if (loadedVideoUrlRef.current === currentUrl) {
      return;
    }
    loadedVideoUrlRef.current = currentUrl;
    console.log('[ReactPlayer] Player loaded and ready for URL:', currentUrl);

    isProcessingIncomingEvent.current = true;
    if (userId !== currentRoomState.hostUserId) {
      seekTo(currentRoomState.playbackPosition || 0);
    }
    setLocalPlaying(currentRoomState.playing);
    setTimeout(() => {
      isProcessingIncomingEvent.current = false;
    }, 300);
  }, [userId]);

  const handleLocalPlay = useCallback(() => {
    const currentRoomState = roomStateRef.current;
    const currentIsHost = currentRoomState ? userId === currentRoomState.hostUserId : false;

    if (currentIsHost) {
      isProcessingIncomingEvent.current = false;
      setLocalPlaying(true);
      sendSyncEvent('PLAY', getCurrentTime());
    } else {
      if (isProcessingIncomingEvent.current) return;
      if (currentRoomState && !currentRoomState.playing) {
        setLocalPlaying(false);
      }
    }
  }, [userId, sendSyncEvent]);

  const handleLocalPause = useCallback(() => {
    const currentRoomState = roomStateRef.current;
    const currentIsHost = currentRoomState ? userId === currentRoomState.hostUserId : false;

    if (currentIsHost) {
      isProcessingIncomingEvent.current = false;
      setLocalPlaying(false);
      sendSyncEvent('PAUSE', getCurrentTime());
    }
  }, [userId, sendSyncEvent]);

  const handleLocalSeek = useCallback((seconds: number) => {
    const currentRoomState = roomStateRef.current;
    const currentIsHost = currentRoomState ? userId === currentRoomState.hostUserId : false;

    if (currentIsHost && !isProcessingIncomingEvent.current) {
      sendSyncEvent('SEEK', seconds);
    }
  }, [userId, sendSyncEvent]);

  const handleLocalFileSelect = (_e: React.ChangeEvent<HTMLInputElement>) => {};

  const handleChangeVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) return;

    if (sourceType === 'url') {
      if (!newVideoUrl.trim()) return;
      loadedVideoUrlRef.current = null;
      isProcessingIncomingEvent.current = false;
      setLocalPlaying(false);
      sendSyncEvent('CHANGE_VIDEO', 0, newVideoUrl.trim());
      setNewVideoUrl('');
      return;
    }

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await authFetch(`${apiUrl}/uploads/video`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data: { url: string } = await res.json();
      sendSyncEvent('CHANGE_VIDEO', 0, data.url);
    } catch (err) {
      console.error('Video upload failed', err);
    }
  };

  const handleSaveRoomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) return;
    try {
      const res = await authFetch(
        `${apiUrl}/rooms/${roomId}/settings?isPublic=${editIsPublic}&maxParticipants=${editMaxParticipants}`,
        { method: 'POST' }
      );
      if (res.ok) {
        const updated: ActiveRoomState = await res.json();
        setRoomState(updated);
        setShowSettingsModal(false);
      }
    } catch (e) {
      console.error('Failed to update room settings', e);
    }
  };

  const handleSendChatFriendRequest = async (targetUsername: string) => {
    setChatUserStatus('');
    try {
      const res = await authFetch(`${apiUrl}/friends/request?username=${encodeURIComponent(targetUsername)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setChatUserStatus(`🎉 Friend request sent to ${targetUsername}!`);
      } else {
        setChatUserStatus(`⚠️ ${data.message || 'Failed to send request'}`);
      }
    } catch (e) {
      setChatUserStatus('⚠️ Server error sending friend request');
    }
  };


  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendChatMessage(chatMessage.trim());
    setChatMessage('');
  };

  const reactionEmojis = ['❤️', '😂', '😮', '🎉', '👍', '🔥'];

  return (
    <div className="room-container">
      {/* Invite Toast Notification */}
      {inviteNotification && (
        <div className="invite-toast glass-card fade-in">
          <span>📩 <strong>{inviteNotification.senderUsername}</strong> invited you to watch party <strong>'{inviteNotification.roomId}'</strong>!</span>
          <div className="invite-toast-actions">
            <button
              className="btn-primary"
              onClick={() => {
                const targetRoom = inviteNotification.roomId;
                setInviteNotification(null);
                localStorage.setItem('syncstream_roomId', targetRoom);
                window.location.reload();
              }}
            >
              Join Party
            </button>
            <button className="btn-secondary" onClick={() => setInviteNotification(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="room-header glass-card">
        <div className="header-brand">
          <span className="brand-logo">🍿</span>
          <h2>Room: <span className="highlight-text">{roomId}</span></h2>
          <span className={`room-visibility-badge ${roomState?.isPublic ? 'public' : 'private'}`}>
            {roomState?.isPublic ? '🌐 Public' : '🔒 Private'}
          </span>
        </div>

        <div className="host-badge">
          👑 Host: <span className="highlight-text">{roomState?.hostUsername || 'Unknown'}</span>
          {isHost && <span className="host-badge-you">(You)</span>}
          {isHost && (
            <button
              className="btn-secondary settings-cog-btn"
              onClick={() => setShowSettingsModal(true)}
              title="Room Control Settings"
            >
              ⚙️ Controls
            </button>
          )}
        </div>

        <div className="header-status">
          <button className="btn-primary friends-btn relative-badge-btn" onClick={() => setShowFriendsModal(true)}>
            👥 Friends & Invites
            {notificationCount > 0 && <span className="notification-red-dot">{notificationCount}</span>}
          </button>
          <div className="connection-badge">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
            {connected ? 'Connected' : 'Reconnecting...'}
          </div>
          <div className="participants-badge">
            👥 {roomState?.participantCount || 0}
            {roomState?.maxParticipants ? `/${roomState.maxParticipants}` : ''} watching
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
          <div className="player-wrapper">
            <ReactPlayer
              ref={playerRef}
              src={roomState?.videoUrl}
              playing={localPlaying}
              volume={volume}
              muted={isMuted}
              controls={isHost}
              width="100%"
              height="100%"
              className="react-player"
              onReady={handlePlayerReady}
              onPlay={handleLocalPlay}
              onPause={handleLocalPause}
              onSeeked={() => handleLocalSeek(getCurrentTime())}
            />

            <div className="emoji-fly-container">
              {floatingEmojis.map((item) => (
                <span
                  key={item.id}
                  className="floating-emoji hotstar-stream-emoji"
                  style={{
                    right: `${item.right}%`,
                    fontSize: `${item.size}rem`,
                    animationDelay: `${item.delay}s`,
                    animationDuration: `${item.duration}s`,
                    ['--drift-x' as string]: `${item.driftX}px`,
                  } as React.CSSProperties}
                >
                  {item.emoji}
                </span>
              ))}
            </div>

            {!isHost && <div className="player-blocker-overlay" />}
          </div>

          <div className="player-toolbar">
            <div className="video-info">
              <h3>Currently Playing:</h3>
              <code className="video-url">{roomState?.videoUrl || 'No video loaded'}</code>
            </div>

            <div className="volume-control-dock">
              <button
                type="button"
                className="volume-btn"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (val > 0 && isMuted) {
                    setIsMuted(false);
                  }
                }}
                className="volume-slider"
                title="Local Volume"
              />
              <span className="volume-percentage">
                {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
              </span>
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
              <div className="viewer-locked-indicator">🔒 Playback synced to Host</div>
            )}
          </div>

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

          <div className="system-logs-container">
            <h4>Room Activity Log</h4>
            <div className="system-logs-list">
              {systemLogs.length === 0 && <p className="empty-text">No events logged yet.</p>}
              {systemLogs.map((logStr, i) => (
                <div key={i} className="system-log-entry">{logStr}</div>
              ))}
            </div>
          </div>
        </div>

        <aside className="chat-section glass-card">
          <div className="chat-header">
            <h3>Interactive Chat</h3>
          </div>
          <div className="chat-messages-container" ref={chatMessagesContainerRef}>
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
                    <span
                      className="chat-sender clickable-sender"
                      onClick={() => {
                        if (chat.username !== username) {
                          setSelectedChatUser(chat.username);
                          setChatUserStatus('');
                        }
                      }}
                      title={chat.username !== username ? `Click to add ${chat.username} as friend` : undefined}
                    >
                      👤 {chat.username}
                    </span>
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

      {/* Selected Chat User Popover Modal */}
      {selectedChatUser && (
        <div className="friends-modal-overlay">
          <div className="friends-modal glass-card fade-in chat-user-modal">
            <div className="modal-header">
              <h2>👤 {selectedChatUser}</h2>
              <button className="close-btn" onClick={() => setSelectedChatUser(null)}>✕</button>
            </div>
            <div className="modal-content text-center">
              <p>Send a friend request to <strong>{selectedChatUser}</strong>?</p>
              {chatUserStatus && <div className="modal-status-msg">{chatUserStatus}</div>}
              <div className="action-btns" style={{ justifyContent: 'center', marginTop: '1rem', gap: '1rem' }}>
                <button className="btn-primary" onClick={() => handleSendChatFriendRequest(selectedChatUser)}>
                  ➕ Add Friend
                </button>
                <button className="btn-secondary" onClick={() => setSelectedChatUser(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time In-Room Friend Request Acceptance Modal */}
      {inRoomFriendRequest && (
        <div className="friends-modal-overlay">
          <div className="friends-modal glass-card fade-in friend-req-modal">
            <div className="modal-header">
              <h2>🎉 Friend Request Received!</h2>
              <button className="close-btn" onClick={() => setInRoomFriendRequest(null)}>✕</button>
            </div>
            <div className="modal-content text-center">
              <p>👤 <strong>{inRoomFriendRequest.senderUsername}</strong> sent you a friend request!</p>
              <div className="action-btns" style={{ justifyContent: 'center', marginTop: '1rem', gap: '1rem' }}>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await authFetch(`${apiUrl}/friends/accept/${inRoomFriendRequest.id}`, {
                        method: 'POST',
                      });
                      setInRoomFriendRequest(null);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  Accept Request
                </button>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      await authFetch(`${apiUrl}/friends/decline/${inRoomFriendRequest.id}`, {
                        method: 'POST',
                      });
                      setInRoomFriendRequest(null);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  Decline
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Room Control Settings Modal */}
      {showSettingsModal && (
        <div className="friends-modal-overlay">
          <div className="friends-modal glass-card fade-in settings-modal">
            <div className="modal-header">
              <h2>⚙️ Host Control Settings</h2>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveRoomSettings} className="lobby-form modal-content">
              <div className="form-group">
                <label htmlFor="modal-room-visibility">Room Visibility</label>
                <select
                  id="modal-room-visibility"
                  value={editIsPublic ? 'public' : 'private'}
                  onChange={(e) => setEditIsPublic(e.target.value === 'public')}
                  className="lobby-input lobby-select"
                >
                  <option value="public">🌐 Public Party (Visible in Directory)</option>
                  <option value="private">🔒 Private Party (Invite / Direct Link Only)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="modal-max-participants">Maximum Participant Limit</label>
                <select
                  id="modal-max-participants"
                  value={editMaxParticipants}
                  onChange={(e) => setEditMaxParticipants(parseInt(e.target.value, 10))}
                  className="lobby-input lobby-select"
                >
                  <option value={2}>2 Viewers</option>
                  <option value={5}>5 Viewers</option>
                  <option value={10}>10 Viewers</option>
                  <option value={20}>20 Viewers</option>
                  <option value={50}>50 Viewers</option>
                  <option value={0}>Unlimited</option>
                </select>
              </div>

              <div className="action-btns" style={{ marginTop: '1.5rem', gap: '1rem' }}>
                <button type="submit" className="btn-primary">Save Settings</button>
                <button type="button" className="btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFriendsModal && (
        <FriendsModal
          token={token}
          currentRoomId={roomId}
          onClose={() => {
            setShowFriendsModal(false);
            checkNotifications();
          }}
          onInviteFriend={(targetUserId) => sendPartyInvite(targetUserId)}
          onJoinRoom={(targetRoomId) => {
            localStorage.setItem('syncstream_roomId', targetRoomId);
            window.location.reload();
          }}
          onNotificationCountChange={handleNotificationCountChange}
        />
      )}
    </div>
  );
};
