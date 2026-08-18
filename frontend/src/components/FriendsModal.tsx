import React, { useState, useEffect, useRef } from 'react';
import type { UserDto, PendingRequest, InviteEvent } from '../types';
import { authFetch } from '../utils/authUtils';
import { Spinner } from './Spinner';

interface FriendsModalProps {
  token: string | null;
  onClose: () => void;
  onInviteFriend?: (targetUserId: number) => void;
  onJoinRoom?: (roomId: string) => void;
  onNotificationCountChange?: (count: number) => void;
  currentRoomId?: string;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  token,
  onClose,
  onInviteFriend,
  onJoinRoom,
  onNotificationCountChange,
  currentRoomId,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'invites' | 'search'>('friends');
  const [friends, setFriends] = useState<UserDto[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingInvites, setPendingInvites] = useState<InviteEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

  const fetchFriends = async () => {
    try {
      const res = await authFetch(`${apiUrl}/friends`);
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (e) {
      console.error('Failed to fetch friends', e);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await authFetch(`${apiUrl}/friends/requests/pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (e) {
      console.error('Failed to fetch pending requests', e);
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const res = await authFetch(`${apiUrl}/rooms/invites/pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(data);
      }
    } catch (e) {
      console.error('Failed to fetch pending party invites', e);
    }
  };


  const onNotificationCountChangeRef = useRef(onNotificationCountChange);

  useEffect(() => {
    onNotificationCountChangeRef.current = onNotificationCountChange;
  });

  useEffect(() => {
    let isMounted = true;
    setLoadingData(true);
    Promise.all([fetchFriends(), fetchPendingRequests(), fetchPendingInvites()])
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });
    return () => { isMounted = false; };
  }, [token]);

  useEffect(() => {
    const totalCount = pendingRequests.length + pendingInvites.length;
    if (onNotificationCountChangeRef.current) {
      onNotificationCountChangeRef.current(totalCount);
    }
  }, [pendingRequests.length, pendingInvites.length]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await authFetch(`${apiUrl}/friends/search?query=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (e) {
      console.error('Failed to search users', e);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (username: string) => {
    setStatusMessage('');
    setActionLoadingId(`send-${username}`);
    try {
      const res = await authFetch(`${apiUrl}/friends/request?username=${username}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`🎉 Friend request sent to ${username}!`);
      } else {
        setStatusMessage(`⚠️ ${data.message || 'Failed to send request'}`);
      }
    } catch (e) {
      setStatusMessage('⚠️ Server error sending request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRespondRequest = async (friendshipId: number, accept: boolean) => {
    const endpoint = accept ? 'accept' : 'decline';
    setActionLoadingId(`${endpoint}-${friendshipId}`);
    try {
      const res = await authFetch(`${apiUrl}/friends/${endpoint}/${friendshipId}`, {
        method: 'POST',
      });
      if (res.ok) {
        await Promise.all([fetchFriends(), fetchPendingRequests()]);
      }
    } catch (e) {
      console.error('Failed to respond to request', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismissInvite = async (inviteId?: string) => {
    if (!inviteId) return;
    setActionLoadingId(`dismiss-${inviteId}`);
    try {
      await authFetch(`${apiUrl}/rooms/invites/${inviteId}/dismiss`, {
        method: 'POST',
      });
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (e) {
      console.error('Failed to dismiss invite', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptInvite = (invite: InviteEvent) => {
    if (invite.id) {
      handleDismissInvite(invite.id);
    }
    if (onJoinRoom) {
      onJoinRoom(invite.roomId);
      onClose();
    }
  };

  const handleRemoveFriend = async (friendId: number, friendName: string) => {
    setActionLoadingId(`remove-${friendId}`);
    try {
      const res = await authFetch(`${apiUrl}/friends/${friendId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFriends(prev => prev.filter(f => f.id !== friendId));
        setStatusMessage(`🗑️ Removed ${friendName} from friends.`);
      }
    } catch (e) {
      console.error('Failed to remove friend', e);
    } finally {
      setActionLoadingId(null);
    }
  };



  return (
    <div className="friends-modal-overlay">
      <div className="friends-modal glass-card fade-in">
        <div className="modal-header">
          <h2>👥 Friends & Invites</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            My Friends ({friends.length})
          </button>

          <button
            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Requests {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
          </button>

          <button
            className={`tab-btn ${activeTab === 'invites' ? 'active' : ''}`}
            onClick={() => setActiveTab('invites')}
          >
            Party Invites {pendingInvites.length > 0 && <span className="tab-badge invite-badge">{pendingInvites.length}</span>}
          </button>

          <button
            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Find People
          </button>
        </div>

        {statusMessage && <div className="modal-status-msg">{statusMessage}</div>}

        <div className="modal-content">
          {loadingData && activeTab !== 'search' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="md" label="Loading friends data..." />
            </div>
          ) : (
            <>
              {activeTab === 'friends' && (
                <div className="friends-list">
                  {friends.length === 0 ? (
                    <p className="empty-text">No friends added yet. Use "Find People" to search!</p>
                  ) : (
                    friends.map((friend) => (
                      <div key={friend.id} className="friend-item-card">
                        <div className="friend-info">
                          <span className="friend-name">👤 {friend.username}</span>
                          <span className="friend-email">{friend.email}</span>
                        </div>
                        <div className="friend-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                          {currentRoomId && onInviteFriend && (
                            <button
                              className="btn-primary invite-btn"
                              onClick={() => {
                                onInviteFriend(friend.id);
                                setStatusMessage(`📩 Invited ${friend.username} to room '${currentRoomId}'!`);
                              }}
                            >
                              Invite to Party
                            </button>
                          )}
                          <button
                            className={`btn-secondary remove-friend-btn ${actionLoadingId === `remove-${friend.id}` ? 'btn-loading' : ''}`}
                            onClick={() => handleRemoveFriend(friend.id, friend.username)}
                            disabled={actionLoadingId === `remove-${friend.id}`}
                          >
                            {actionLoadingId === `remove-${friend.id}` ? (
                              <Spinner size="xs" label="Removing..." />
                            ) : (
                              'Remove'
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'pending' && (
                <div className="pending-list">
                  {pendingRequests.length === 0 ? (
                    <p className="empty-text">No pending friend requests.</p>
                  ) : (
                    pendingRequests.map((req) => (
                      <div key={req.id} className="friend-item-card">
                        <span className="friend-name">📩 Request from <strong>{req.senderUsername}</strong></span>
                        <div className="action-btns">
                          <button
                            className="btn-primary"
                            onClick={() => handleRespondRequest(req.id, true)}
                            disabled={actionLoadingId === `accept-${req.id}` || actionLoadingId === `decline-${req.id}`}
                          >
                            {actionLoadingId === `accept-${req.id}` ? (
                              <Spinner size="xs" label="Accepting..." />
                            ) : (
                              'Accept'
                            )}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleRespondRequest(req.id, false)}
                            disabled={actionLoadingId === `accept-${req.id}` || actionLoadingId === `decline-${req.id}`}
                          >
                            {actionLoadingId === `decline-${req.id}` ? (
                              <Spinner size="xs" label="Declining..." />
                            ) : (
                              'Decline'
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'invites' && (
                <div className="pending-list">
                  {pendingInvites.length === 0 ? (
                    <p className="empty-text">No pending watch party invites.</p>
                  ) : (
                    pendingInvites.map((inv) => (
                      <div key={inv.id || inv.roomId} className="friend-item-card invite-item-card">
                        <div className="friend-info">
                          <span className="friend-name">🍿 Party Room: <strong>{inv.roomId}</strong></span>
                          <span className="friend-email">Invited by <strong>{inv.senderUsername}</strong></span>
                        </div>
                        <div className="action-btns">
                          <button className="btn-primary" onClick={() => handleAcceptInvite(inv)}>Join Watch Party</button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleDismissInvite(inv.id)}
                            disabled={actionLoadingId === `dismiss-${inv.id}`}
                          >
                            {actionLoadingId === `dismiss-${inv.id}` ? (
                              <Spinner size="xs" label="Dismissing..." />
                            ) : (
                              'Dismiss'
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'search' && (
                <div className="search-section">
                  <form onSubmit={handleSearch} className="search-form">
                    <input
                      type="text"
                      placeholder="Search username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="lobby-input"
                      disabled={searchLoading}
                    />
                    <button type="submit" className={`btn-primary ${searchLoading ? 'btn-loading' : ''}`} disabled={searchLoading}>
                      {searchLoading ? <Spinner size="xs" label="Searching..." /> : 'Search'}
                    </button>
                  </form>

                  <div className="search-results">
                    {searchLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                        <Spinner size="sm" label="Searching users..." />
                      </div>
                    ) : (
                      searchResults.map((user) => (
                        <div key={user.id} className="friend-item-card">
                          <span>👤 {user.username} ({user.email})</span>
                          <button
                            className="btn-secondary"
                            onClick={() => handleSendRequest(user.username)}
                            disabled={actionLoadingId === `send-${user.username}`}
                          >
                            {actionLoadingId === `send-${user.username}` ? (
                              <Spinner size="xs" label="Sending..." />
                            ) : (
                              'Add Friend'
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
