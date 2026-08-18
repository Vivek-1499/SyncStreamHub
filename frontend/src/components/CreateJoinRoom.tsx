import React, { useState, useEffect, useCallback } from 'react';
import type { ActiveRoomState, AuthResponse } from '../types';
import { FriendsModal } from './FriendsModal';
import { Spinner } from './Spinner';
import { isTokenExpired, clearUserSession, authFetch } from '../utils/authUtils';

interface CreateJoinRoomProps {
  onJoin: (roomId: string, userId: number, username: string) => void;
}

export const CreateJoinRoom: React.FC<CreateJoinRoomProps> = ({ onJoin }) => {
  const [user, setUser] = useState<{ id: number; username: string; email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [createRoomId, setCreateRoomId] = useState('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [isCreateRoomLoading, setIsCreateRoomLoading] = useState(false);

  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomSuccess, setRoomSuccess] = useState('');
  const [isJoinRoomLoading, setIsJoinRoomLoading] = useState(false);

  const [publicRooms, setPublicRooms] = useState<ActiveRoomState[]>([]);
  const [isRefreshingDirectory, setIsRefreshingDirectory] = useState(false);
  const [joiningPublicRoomId, setJoiningPublicRoomId] = useState<string | null>(null);

  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

  useEffect(() => {
    const savedUserId = localStorage.getItem('syncstream_userId');
    const savedUsername = localStorage.getItem('syncstream_username');
    const savedEmail = localStorage.getItem('syncstream_email');
    const savedToken = localStorage.getItem('syncstream_token');

    if (!savedToken || isTokenExpired(savedToken)) {
      if (savedToken) {
        console.warn('[CreateJoinRoom] Saved token has expired. Clearing saved credentials.');
      }
      clearUserSession();
      setUser(null);
      setToken(null);
      return;
    }

    if (savedUserId && savedUsername) {
      setUser({
        id: parseInt(savedUserId, 10),
        username: savedUsername,
        email: savedEmail || '',
      });
      setToken(savedToken);
    }
  }, []);

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
      console.error('Error checking pending notifications', e);
    }
  }, [apiUrl]);

  const fetchPublicRooms = useCallback(async () => {
    setIsRefreshingDirectory(true);
    try {
      const res = await fetch(`${apiUrl}/rooms/public`);
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data);
      }
    } catch (err) {
      console.error('Failed to load public watch party directory', err);
    } finally {
      setIsRefreshingDirectory(false);
    }
  }, [apiUrl]);

  const userId = user?.id;

  useEffect(() => {
    if (userId) {
      fetchPublicRooms();
      checkNotifications();
    }
  }, [userId, fetchPublicRooms, checkNotifications]);

  const handleNotificationCountChange = useCallback((count: number) => {
    setNotificationCount(count);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authUsername.trim() || !authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill out all registration fields.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data: AuthResponse = await response.json();
      if (!response.ok) {
        throw new Error((data as any).message || 'Failed to register account.');
      }
      handleAuthSuccess(data);
    } catch (err: any) {
      setAuthError(err.message || 'Server communication error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Please enter your username and password.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
        }),
      });

      const data: AuthResponse = await response.json();
      if (!response.ok) {
        throw new Error((data as any).message || 'Invalid credentials.');
      }
      handleAuthSuccess(data);
    } catch (err: any) {
      setAuthError(err.message || 'Server communication error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAuthSuccess = (data: AuthResponse) => {
    localStorage.setItem('syncstream_userId', data.user.id.toString());
    localStorage.setItem('syncstream_username', data.user.username);
    localStorage.setItem('syncstream_email', data.user.email);
    localStorage.setItem('syncstream_token', data.token);

    setUser({ id: data.user.id, username: data.user.username, email: data.user.email });
    setToken(data.token);
    setAuthPassword('');
    setAuthError('');
  };

  const handleLogout = () => {
    const currentToken = localStorage.getItem('syncstream_token');
    if (currentToken) {
      fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch((err) => console.error('Logout request error:', err));
    }
    clearUserSession();
    setUser(null);
    setToken(null);
  };


  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError('');
    setRoomSuccess('');

    if (!createRoomId.trim()) {
      setRoomError('Please specify a Room ID.');
      return;
    }

    const cleanRoomId = createRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanRoomId || !user) return;

    setIsCreateRoomLoading(true);
    try {
      const response = await authFetch(
        `${apiUrl}/rooms/create?roomId=${cleanRoomId}&userId=${user.id}&username=${user.username}&isPublic=${isPublic}&maxParticipants=${maxParticipants}`,
        { method: 'POST' }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create room.');
      }

      setRoomSuccess(`Room '${cleanRoomId}' created successfully! Redirecting...`);
      setTimeout(() => {
        onJoin(cleanRoomId, user.id, user.username);
      }, 800);
    } catch (err: any) {
      setRoomError(err.message || 'Failed to connect to the backend.');
      setIsCreateRoomLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError('');
    setRoomSuccess('');

    if (!joinRoomId.trim()) {
      setRoomError('Please enter a Room ID.');
      return;
    }

    const cleanRoomId = joinRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanRoomId || !user) return;

    setIsJoinRoomLoading(true);
    try {
      const response = await fetch(`${apiUrl}/rooms/${cleanRoomId}?userId=${user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'This room does not exist.');
      }

      setRoomSuccess(`Joining room '${cleanRoomId}'...`);
      setTimeout(() => {
        onJoin(cleanRoomId, user.id, user.username);
      }, 800);
    } catch (err: any) {
      setRoomError(err.message || 'This watch party is not active.');
      setIsJoinRoomLoading(false);
    }
  };

  const handleJoinPublicRoom = async (targetRoomId: string) => {
    if (!user) return;
    setJoiningPublicRoomId(targetRoomId);
    try {
      const res = await fetch(`${apiUrl}/rooms/${targetRoomId}?userId=${user.id}`);
      if (res.ok) {
        onJoin(targetRoomId, user.id, user.username);
      } else {
        const data = await res.json();
        setRoomError(data.message || 'Unable to join this room.');
        setJoiningPublicRoomId(null);
      }
    } catch (e) {
      setRoomError('Failed to join public watch party.');
      setJoiningPublicRoomId(null);
    }
  };

  return (
    <div className="lobby-container">
      {!user ? (
        <div className="lobby-card glass-card fade-in">
          <div className="lobby-brand">
            <span className="lobby-logo animate-bounce">🍿</span>
            <h1>SyncStream <span className="highlight-text">Hub</span></h1>
            <p className="lobby-subtitle">Watch movies & videos together with friends in real-time</p>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
              onClick={() => { if (!isAuthLoading) { setAuthTab('login'); setAuthError(''); } }}
              disabled={isAuthLoading}
            >
              Sign In
            </button>
            <button
              className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
              onClick={() => { if (!isAuthLoading) { setAuthTab('register'); setAuthError(''); } }}
              disabled={isAuthLoading}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={authTab === 'login' ? handleLogin : handleRegister} className="lobby-form">
            <div className="form-group">
              <label htmlFor="auth-username">Username</label>
              <input
                type="text"
                id="auth-username"
                placeholder="e.g. Vivek_1499"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="lobby-input"
                maxLength={25}
                disabled={isAuthLoading}
                required
              />
            </div>

            {authTab === 'register' && (
              <div className="form-group">
                <label htmlFor="auth-email">Email Address</label>
                <input
                  type="email"
                  id="auth-email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="lobby-input"
                  maxLength={50}
                  disabled={isAuthLoading}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="auth-password">Password</label>
              <input
                type="password"
                id="auth-password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="lobby-input"
                disabled={isAuthLoading}
                required
              />
            </div>

            {authError && <div className="lobby-error-message">⚠️ {authError}</div>}

            <button
              type="submit"
              className={`lobby-submit-btn btn-primary ${isAuthLoading ? 'btn-loading' : ''}`}
              disabled={isAuthLoading}
            >
              {isAuthLoading ? (
                <Spinner size="sm" label={authTab === 'login' ? 'Signing In...' : 'Creating Account...'} />
              ) : authTab === 'login' ? (
                'Log In'
              ) : (
                'Sign Up & Continue'
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="lobby-card glass-card fade-in dashboard-card">
          <div className="lobby-brand">
            <span className="lobby-logo">👑</span>
            <h1>Lobby <span className="highlight-text">Dashboard</span></h1>
            <p className="welcome-text">Logged in as: <strong className="user-handle">{user.username}</strong></p>
            <div className="dashboard-header-actions">
              <button className="btn-primary friends-btn relative-badge-btn" onClick={() => setShowFriendsModal(true)}>
                👥 Friends & Invites
                {notificationCount > 0 && <span className="notification-red-dot" title={`${notificationCount} pending notifications`}>{notificationCount}</span>}
              </button>
              <button className="btn-secondary logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-subcard">
              <h3>Create a Watch Party</h3>
              <p>Start a room as Host to control video playback and sync.</p>
              <form onSubmit={handleCreateRoom} className="lobby-form">
                <div className="form-group">
                  <label htmlFor="create-room-id">Room Name / ID</label>
                  <input
                    type="text"
                    id="create-room-id"
                    placeholder="e.g. movie-marathon"
                    value={createRoomId}
                    onChange={(e) => setCreateRoomId(e.target.value)}
                    className="lobby-input"
                    maxLength={30}
                    disabled={isCreateRoomLoading}
                    required
                  />
                </div>

                <div className="form-options-row">
                  <div className="form-group half-width">
                    <label htmlFor="room-visibility">Visibility</label>
                    <select
                      id="room-visibility"
                      value={isPublic ? 'public' : 'private'}
                      onChange={(e) => setIsPublic(e.target.value === 'public')}
                      className="lobby-input lobby-select"
                      disabled={isCreateRoomLoading}
                    >
                      <option value="public">🌐 Public Party</option>
                      <option value="private">🔒 Private Party</option>
                    </select>
                  </div>

                  <div className="form-group half-width">
                    <label htmlFor="max-participants">Max Viewers</label>
                    <select
                      id="max-participants"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
                      className="lobby-input lobby-select"
                      disabled={isCreateRoomLoading}
                    >
                      <option value={2}>2 Viewers</option>
                      <option value={5}>5 Viewers</option>
                      <option value={10}>10 Viewers</option>
                      <option value={20}>20 Viewers</option>
                      <option value={50}>50 Viewers</option>
                      <option value={0}>Unlimited</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn-primary ${isCreateRoomLoading ? 'btn-loading' : ''}`}
                  disabled={isCreateRoomLoading}
                >
                  {isCreateRoomLoading ? (
                    <Spinner size="sm" label="Creating Room..." />
                  ) : (
                    'Start Room (Host)'
                  )}
                </button>
              </form>
            </div>

            <div className="dashboard-subcard">
              <h3>Join a Watch Party</h3>
              <p>Enter an active Room ID. Sync and watch in unison.</p>
              <form onSubmit={handleJoinRoom} className="lobby-form">
                <div className="form-group">
                  <label htmlFor="join-room-id">Target Room ID</label>
                  <input
                    type="text"
                    id="join-room-id"
                    placeholder="e.g. movie-marathon"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="lobby-input"
                    maxLength={30}
                    disabled={isJoinRoomLoading}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className={`btn-secondary ${isJoinRoomLoading ? 'btn-loading' : ''}`}
                  disabled={isJoinRoomLoading}
                >
                  {isJoinRoomLoading ? (
                    <Spinner size="sm" label="Joining Room..." />
                  ) : (
                    'Join Active Room'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Public Watch Party Directory Card Grid */}
          <div className="public-directory-section">
            <div className="directory-header-row">
              <h3>🌐 Live Watch Parties Directory</h3>
              <button
                type="button"
                className={`btn-secondary refresh-directory-btn ${isRefreshingDirectory ? 'btn-loading' : ''}`}
                onClick={fetchPublicRooms}
                disabled={isRefreshingDirectory}
              >
                {isRefreshingDirectory ? (
                  <Spinner size="xs" label="Refreshing..." />
                ) : (
                  '🔄 Refresh Directory'
                )}
              </button>
            </div>
            {publicRooms.length === 0 ? (
              <p className="empty-text">No active public watch parties happening right now. Create one above!</p>
            ) : (
              <div className="public-rooms-grid">
                {publicRooms.map((room) => (
                  <div key={room.roomId} className="public-room-card glass-card">
                    <div className="room-card-header">
                      <span className="room-title">🎬 {room.roomId}</span>
                      <span className="viewer-count-badge">
                        👥 {room.participantCount}{room.maxParticipants ? `/${room.maxParticipants}` : ''} watching
                      </span>
                    </div>
                    <p className="room-host">👑 Host: {room.hostUsername || 'Unknown'}</p>
                    <button
                      className={`btn-primary join-public-btn ${joiningPublicRoomId === room.roomId ? 'btn-loading' : ''}`}
                      onClick={() => handleJoinPublicRoom(room.roomId)}
                      disabled={joiningPublicRoomId === room.roomId}
                    >
                      {joiningPublicRoomId === room.roomId ? (
                        <Spinner size="sm" label="Joining..." />
                      ) : (
                        'Join Watch Party'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {roomError && <div className="lobby-error-message error-box">⚠️ {roomError}</div>}
          {roomSuccess && <div className="lobby-success-message">🎉 {roomSuccess}</div>}
        </div>
      )}

      {showFriendsModal && (
        <FriendsModal
          token={token}
          onClose={() => {
            setShowFriendsModal(false);
            checkNotifications();
          }}
          onJoinRoom={(roomId) => {
            if (user) onJoin(roomId, user.id, user.username);
          }}

          onNotificationCountChange={handleNotificationCountChange}
        />
      )}
    </div>
  );
};
