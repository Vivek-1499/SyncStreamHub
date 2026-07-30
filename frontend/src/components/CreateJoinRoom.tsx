import React, { useState, useEffect } from 'react';

interface CreateJoinRoomProps {
  onJoin: (roomId: string, userId: number, username: string) => void;
}

export const CreateJoinRoom: React.FC<CreateJoinRoomProps> = ({ onJoin }) => {
  // Authentication states
  const [user, setUser] = useState<{ id: number; username: string; email: string } | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Lobby room management states
  const [createRoomId, setCreateRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomSuccess, setRoomSuccess] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  // Check if user is already logged in
  useEffect(() => {
    const savedUserId = localStorage.getItem('syncstream_userId');
    const savedUsername = localStorage.getItem('syncstream_username');
    const savedEmail = localStorage.getItem('syncstream_email');

    if (savedUserId && savedUsername) {
      setUser({
        id: parseInt(savedUserId, 10),
        username: savedUsername,
        email: savedEmail || '',
      });
    }
  }, []);

  // Handle User Registration (PostgreSQL write)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!authUsername.trim() || !authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please fill out all registration fields.');
      return;
    }

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to register account.');
      }

      // Automatically log them in after registration
      handleAuthSuccess(data);
    } catch (err: any) {
      setAuthError(err.message || 'Server communication error.');
    }
  };

  // Handle User Login (PostgreSQL read & check)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Please enter your username and password.');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authUsername.trim(),
          password: authPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials.');
      }

      handleAuthSuccess(data);
    } catch (err: any) {
      setAuthError(err.message || 'Server communication error.');
    }
  };

  const handleAuthSuccess = (userData: { id: number; username: string; email: string }) => {
    localStorage.setItem('syncstream_userId', userData.id.toString());
    localStorage.setItem('syncstream_username', userData.username);
    localStorage.setItem('syncstream_email', userData.email);
    setUser(userData);
    setAuthPassword('');
    setAuthError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('syncstream_userId');
    localStorage.removeItem('syncstream_username');
    localStorage.removeItem('syncstream_email');
    localStorage.removeItem('syncstream_roomId');
    setUser(null);
  };

  // Handle Room Creation (Redis initialize)
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError('');
    setRoomSuccess('');

    if (!createRoomId.trim()) {
      setRoomError('Please specify a Room ID.');
      return;
    }

    const cleanRoomId = createRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanRoomId) {
      setRoomError('Room ID can only contain alphanumeric characters, dashes, or underscores.');
      return;
    }

    if (!user) return;

    try {
      const response = await fetch(
        `${apiUrl}/rooms/create?roomId=${cleanRoomId}&userId=${user.id}&username=${user.username}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create room.');
      }

      setRoomSuccess(`Room '${cleanRoomId}' created successfully! Redirecting...`);
      setTimeout(() => {
        onJoin(cleanRoomId, user.id, user.username);
      }, 1000);
    } catch (err: any) {
      setRoomError(err.message || 'Failed to connect to the backend.');
    }
  };

  // Handle Joining Room (Redis validation check)
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError('');
    setRoomSuccess('');

    if (!joinRoomId.trim()) {
      setRoomError('Please enter a Room ID.');
      return;
    }

    const cleanRoomId = joinRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanRoomId) {
      setRoomError('Invalid Room ID format.');
      return;
    }

    if (!user) return;

    try {
      const response = await fetch(`${apiUrl}/rooms/${cleanRoomId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'This room does not exist.');
      }

      // Room is active, let them join
      setRoomSuccess(`Joining room '${cleanRoomId}'...`);
      setTimeout(() => {
        onJoin(cleanRoomId, user.id, user.username);
      }, 1000);
    } catch (err: any) {
      setRoomError(err.message || 'This watch party is not active.');
    }
  };

  return (
    <div className="lobby-container">
      {/* 1. Auth Page: Login / Register Panel */}
      {!user ? (
        <div className="lobby-card glass-card fade-in">
          <div className="lobby-brand">
            <span className="lobby-logo animate-bounce">🍿</span>
            <h1>SyncStream <span className="highlight-text">Hub</span></h1>
            <p className="lobby-subtitle">Hashed Account Registration & Login (PostgreSQL)</p>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthTab('login'); setAuthError(''); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthTab('register'); setAuthError(''); }}
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
                required
              />
            </div>

            {authError && <div className="lobby-error-message">⚠️ {authError}</div>}

            <button type="submit" className="lobby-submit-btn btn-primary">
              {authTab === 'login' ? 'Log In' : 'Sign Up & Continue'}
            </button>
          </form>
        </div>
      ) : (
        /* 2. Room Lobby Dashboard: Create / Join Watch Party Rooms */
        <div className="lobby-card glass-card fade-in dashboard-card">
          <div className="lobby-brand">
            <span className="lobby-logo">👑</span>
            <h1>Lobby <span className="highlight-text">Dashboard</span></h1>
            <p className="welcome-text">Logged in as: <strong className="user-handle">{user.username}</strong></p>
            <button className="btn-secondary logout-btn" onClick={handleLogout}>
              Logout / Switch Account
            </button>
          </div>

          <div className="dashboard-grid">
            {/* Create Watch Party Card */}
            <div className="dashboard-subcard">
              <h3>Create a Watch Party</h3>
              <p>Initialize a room. You will be the **Host**, controlling URL & playback sync.</p>
              <form onSubmit={handleCreateRoom} className="lobby-form">
                <input
                  type="text"
                  placeholder="e.g. movie-marathon"
                  value={createRoomId}
                  onChange={(e) => setCreateRoomId(e.target.value)}
                  className="lobby-input"
                  maxLength={30}
                  required
                />
                <button type="submit" className="btn-primary">
                  Start Room (Host)
                </button>
              </form>
            </div>

            {/* Join Watch Party Card */}
            <div className="dashboard-subcard">
              <h3>Join a Watch Party</h3>
              <p>Enter an active Room ID. Sync and watch in unison.</p>
              <form onSubmit={handleJoinRoom} className="lobby-form">
                <input
                  type="text"
                  placeholder="e.g. movie-marathon"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="lobby-input"
                  maxLength={30}
                  required
                />
                <button type="submit" className="btn-secondary">
                  Join Active Room
                </button>
              </form>
            </div>
          </div>

          {roomError && <div className="lobby-error-message error-box">⚠️ {roomError}</div>}
          {roomSuccess && <div className="lobby-success-message">🎉 {roomSuccess}</div>}
        </div>
      )}
    </div>
  );
};
