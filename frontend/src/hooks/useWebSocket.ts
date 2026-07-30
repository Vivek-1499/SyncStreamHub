import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, type IMessage } from '@stomp/stompjs';
import type { ActiveRoomState, ChatEvent, SyncEvent } from '../types';

interface UseWebSocketProps {
  roomId: string;
  userId: number;
  username: string;
  onRoomStateReceived: (state: ActiveRoomState) => void;
  onChatMessageReceived: (chat: ChatEvent) => void;
  onEmojiReceived: (emoji: ChatEvent) => void;
}

export const useWebSocket = ({
  roomId,
  userId,
  username,
  onRoomStateReceived,
  onChatMessageReceived,
  onEmojiReceived,
}: UseWebSocketProps) => {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);

  // Cache callbacks in refs to avoid rebuilding connections
  const onRoomStateReceivedRef = useRef(onRoomStateReceived);
  const onChatMessageReceivedRef = useRef(onChatMessageReceived);
  const onEmojiReceivedRef = useRef(onEmojiReceived);

  useEffect(() => {
    onRoomStateReceivedRef.current = onRoomStateReceived;
    onChatMessageReceivedRef.current = onChatMessageReceived;
    onEmojiReceivedRef.current = onEmojiReceived;
  });

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
    console.log(`Connecting to WebSocket server at: ${wsUrl}`);

    const client = new Client({
      brokerURL: wsUrl,
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

      // 1. Subscribe to the playback sync channel
      client.subscribe(`/topic/room/${roomId}`, (message: IMessage) => {
        try {
          const state: ActiveRoomState = JSON.parse(message.body);
          onRoomStateReceivedRef.current(state);
        } catch (e) {
          console.error('Failed to parse active room state', e);
        }
      });

      // 2. Subscribe to the chat feed channel
      client.subscribe(`/topic/room/${roomId}/chat`, (message: IMessage) => {
        try {
          const chat: ChatEvent = JSON.parse(message.body);
          onChatMessageReceivedRef.current(chat);
        } catch (e) {
          console.error('Failed to parse chat message event', e);
        }
      });

      // 3. Subscribe to the emoji reactions channel
      client.subscribe(`/topic/room/${roomId}/emoji`, (message: IMessage) => {
        try {
          const emoji: ChatEvent = JSON.parse(message.body);
          onEmojiReceivedRef.current(emoji);
        } catch (e) {
          console.error('Failed to parse emoji event', e);
        }
      });

      // 4. Send JOIN event to establish participant count
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
          // Send LEAVE event to decrement player counts and log
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
  }, [roomId, userId, username]);

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
    } else {
      console.warn('STOMP connection not active. SyncEvent postponed.');
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
    } else {
      console.warn('STOMP connection not active. Chat message not sent.');
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
    } else {
      console.warn('STOMP connection not active. Emoji reaction not sent.');
    }
  }, [roomId, userId, username]);

  return { connected, sendSyncEvent, sendChatMessage, sendEmoji };
};
