import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import type { ActiveRoomState, ChatEvent, SyncEvent, InviteEvent, RtcSignalEvent } from '../types';

interface UseWebSocketProps {
  roomId: string;
  userId: number;
  username: string;
  token?: string | null;
  onRoomStateReceived: (state: ActiveRoomState) => void;
  onChatMessageReceived: (chat: ChatEvent) => void;
  onEmojiReceived: (emoji: ChatEvent) => void;
  onInviteReceived?: (invite: InviteEvent) => void;
  onFriendRequestReceived?: (data: any) => void;
  onRtcSignalReceived?: (signal: RtcSignalEvent) => void;
}

export const useWebSocket = ({
  roomId,
  userId,
  username,
  token,
  onRoomStateReceived,
  onChatMessageReceived,
  onEmojiReceived,
  onInviteReceived,
  onFriendRequestReceived,
  onRtcSignalReceived,
}: UseWebSocketProps) => {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  const onRoomStateReceivedRef = useRef(onRoomStateReceived);
  const onChatMessageReceivedRef = useRef(onChatMessageReceived);
  const onEmojiReceivedRef = useRef(onEmojiReceived);
  const onInviteReceivedRef = useRef(onInviteReceived);
  const onFriendRequestReceivedRef = useRef(onFriendRequestReceived);
  const onRtcSignalReceivedRef = useRef(onRtcSignalReceived);

  useEffect(() => {
    onRoomStateReceivedRef.current = onRoomStateReceived;
    onChatMessageReceivedRef.current = onChatMessageReceived;
    onEmojiReceivedRef.current = onEmojiReceived;
    onInviteReceivedRef.current = onInviteReceived;
    onFriendRequestReceivedRef.current = onFriendRequestReceived;
    onRtcSignalReceivedRef.current = onRtcSignalReceived;
  });

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    console.log(`Connecting to WebSocket server at: ${wsUrl}`);

    const connectHeaders: Record<string, string> = {};
    if (token) {
      connectHeaders['Authorization'] = `Bearer ${token}`;
    }

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        console.debug('[STOMP Debug] ' + str);
      },
    });

    client.onConnect = (frame) => {
      console.log('STOMP Connection established successfully', frame);
      setConnected(true);

      // 1. Playback sync channel
      client.subscribe(`/topic/room/${roomId}`, (message: IMessage) => {
        try {
          const state: ActiveRoomState = JSON.parse(message.body);
          onRoomStateReceivedRef.current(state);
        } catch (e) {
          console.error('Failed to parse active room state', e);
        }
      });

      // 2. Chat feed channel
      client.subscribe(`/topic/room/${roomId}/chat`, (message: IMessage) => {
        try {
          const chat: ChatEvent = JSON.parse(message.body);
          onChatMessageReceivedRef.current(chat);
        } catch (e) {
          console.error('Failed to parse chat message event', e);
        }
      });

      // 3. Emoji reactions channel
      client.subscribe(`/topic/room/${roomId}/emoji`, (message: IMessage) => {
        try {
          const emoji: ChatEvent = JSON.parse(message.body);
          onEmojiReceivedRef.current(emoji);
        } catch (e) {
          console.error('Failed to parse emoji event', e);
        }
      });

      // 4. WebRTC general signaling channel
      client.subscribe(`/topic/room/${roomId}/rtc`, (message: IMessage) => {
        try {
          const signal: RtcSignalEvent = JSON.parse(message.body);
          if (onRtcSignalReceivedRef.current) {
            onRtcSignalReceivedRef.current(signal);
          }
        } catch (e) {
          console.error('Failed to parse WebRTC signal', e);
        }
      });

      // 5. WebRTC direct peer signaling channel
      client.subscribe(`/topic/room/${roomId}/rtc/${userId}`, (message: IMessage) => {
        try {
          const signal: RtcSignalEvent = JSON.parse(message.body);
          if (onRtcSignalReceivedRef.current) {
            onRtcSignalReceivedRef.current(signal);
          }
        } catch (e) {
          console.error('Failed to parse direct WebRTC signal', e);
        }
      });

      // 6. Direct user invite channel
      if (userId) {
        client.subscribe(`/topic/user/${userId}/invites`, (message: IMessage) => {
          try {
            const invite: InviteEvent = JSON.parse(message.body);
            if (onInviteReceivedRef.current) {
              onInviteReceivedRef.current(invite);
            }
          } catch (e) {
            console.error('Failed to parse invite event', e);
          }
        });

        client.subscribe(`/topic/user/${userId}/friend-requests`, (message: IMessage) => {
          try {
            const reqData = JSON.parse(message.body);
            if (onFriendRequestReceivedRef.current) {
              onFriendRequestReceivedRef.current(reqData);
            }
          } catch (e) {
            console.error('Failed to parse friend request event', e);
          }
        });
      }

      // Send JOIN event
      const joinEvent: SyncEvent = {
        action: 'JOIN',
        playbackPosition: 0,
        userId,
        username,
        timestamp: Date.now()
      };

      client.publish({
        destination: `/app/room/${roomId}/sync`,
        body: JSON.stringify(joinEvent)
      });
    };

    client.onDisconnect = () => {
      console.log('STOMP Connection closed');
      setConnected(false);
    };

    client.onStompError = (frame) => {
      console.error('STOMP protocol error encountered', frame.headers['message']);
      console.error('STOMP error details: ', frame.body);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        if (clientRef.current.connected) {
          const leaveEvent: SyncEvent = {
            action: 'LEAVE',
            playbackPosition: 0,
            userId,
            username,
            timestamp: Date.now()
          };
          try {
            clientRef.current.publish({
              destination: `/app/room/${roomId}/sync`,
              body: JSON.stringify(leaveEvent)
            });
          } catch (e) {
            console.error('Error sending LEAVE event during unmount', e);
          }
        }
        clientRef.current.deactivate();
        console.log('Deactivated STOMP websocket connection');
      }
    };
  }, [roomId, userId, username, token]);

  const sendSyncEvent = useCallback((action: SyncEvent['action'], position: number, videoUrl?: string) => {
    if (clientRef.current && clientRef.current.connected) {
      const syncEvent: SyncEvent = {
        action,
        playbackPosition: position,
        userId,
        username,
        videoUrl,
        timestamp: Date.now()
      };
      clientRef.current.publish({
        destination: `/app/room/${roomId}/sync`,
        body: JSON.stringify(syncEvent)
      });
    }
  }, [roomId, userId, username]);

  const sendChatMessage = useCallback((message: string) => {
    if (clientRef.current && clientRef.current.connected) {
      const chatEvent: ChatEvent = {
        userId,
        username,
        message,
        timestamp: Date.now()
      };
      clientRef.current.publish({
        destination: `/app/room/${roomId}/chat`,
        body: JSON.stringify(chatEvent)
      });
    }
  }, [roomId, userId, username]);

  const sendEmoji = useCallback((emoji: string) => {
    if (clientRef.current && clientRef.current.connected) {
      const emojiEvent: ChatEvent = {
        userId,
        username,
        message: emoji,
        timestamp: Date.now()
      };
      clientRef.current.publish({
        destination: `/app/room/${roomId}/emoji`,
        body: JSON.stringify(emojiEvent)
      });
    }
  }, [roomId, userId, username]);

  const sendRtcSignal = useCallback((type: RtcSignalEvent['type'], data: any, targetId?: number) => {
    if (clientRef.current && clientRef.current.connected) {
      const signal: RtcSignalEvent = {
        senderId: userId,
        targetId,
        type,
        data
      };
      clientRef.current.publish({
        destination: `/app/room/${roomId}/rtc`,
        body: JSON.stringify(signal)
      });
    }
  }, [roomId, userId]);

  const sendPartyInvite = useCallback((targetUserId: number) => {
    if (clientRef.current && clientRef.current.connected) {
      const invite: InviteEvent = {
        roomId,
        senderId: userId,
        senderUsername: username,
        targetUserId,
        timestamp: Date.now()
      };
      clientRef.current.publish({
        destination: `/app/invite`,
        body: JSON.stringify(invite)
      });
    }
  }, [roomId, userId, username]);

  return { connected, sendSyncEvent, sendChatMessage, sendEmoji, sendRtcSignal, sendPartyInvite };
};
