import { useState, useEffect } from 'react';
import { CreateJoinRoom } from './components/CreateJoinRoom';
import { WatchPartyRoom } from './components/WatchPartyRoom';
import { isTokenExpired, clearUserSession } from './utils/authUtils';

function App() {
  const [screen, setScreen] = useState<'lobby' | 'room'>('lobby');
  const [session, setSession] = useState<{
    roomId: string;
    userId: number;
    username: string;
  } | null>(null);

  // Load user session from localStorage on startup to prevent kick-backs on refresh
  useEffect(() => {
    const savedToken = localStorage.getItem('syncstream_token');
    const savedRoomId = localStorage.getItem('syncstream_roomId');
    const savedUsername = localStorage.getItem('syncstream_username');
    const savedUserIdStr = localStorage.getItem('syncstream_userId');

    // If token is present but expired, purge local storage
    if (savedToken && isTokenExpired(savedToken)) {
      console.warn('[App] Stored token has expired. Purging session.');
      clearUserSession();
      setSession(null);
      setScreen('lobby');
      return;
    }

    if (savedRoomId && savedUsername && savedUserIdStr) {
      const parsedUserId = parseInt(savedUserIdStr, 10);
      if (!isNaN(parsedUserId)) {
        console.log(`Restoring persistent watch session for room: ${savedRoomId}`);
        setSession({
          roomId: savedRoomId,
          userId: parsedUserId,
          username: savedUsername,
        });
        setScreen('room');
      }
    }

    const handleSessionExpired = () => {
      clearUserSession();
      setSession(null);
      setScreen('lobby');
    };

    window.addEventListener('syncstream_session_expired', handleSessionExpired);
    return () => window.removeEventListener('syncstream_session_expired', handleSessionExpired);
  }, []);

  const handleJoinRoom = (roomId: string, userId: number, username: string) => {
    // Commit credentials to browser cache
    localStorage.setItem('syncstream_roomId', roomId);
    localStorage.setItem('syncstream_username', username);
    localStorage.setItem('syncstream_userId', userId.toString());

    setSession({ roomId, userId, username });
    setScreen('room');
  };

  const handleLeaveRoom = () => {
    // Clear only Room ID from cache, preserving username identity for quick logging
    localStorage.removeItem('syncstream_roomId');
    setSession(null);
    setScreen('lobby');
  };

  const handleLogout = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
    const token = localStorage.getItem('syncstream_token');
    if (token) {
      fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => console.error('Logout request error:', err));
    }
    clearUserSession();
    setSession(null);
    setScreen('lobby');
  };

  return (
    <>
      {screen === 'lobby' ? (
        <CreateJoinRoom onJoin={handleJoinRoom} />
      ) : (
        session && (
          <WatchPartyRoom
            roomId={session.roomId}
            userId={session.userId}
            username={session.username}
            onExit={handleLeaveRoom}
            onLogout={handleLogout}
          />
        )
      )}
    </>
  );
}

export default App;

