import { useState, useRef, useCallback } from 'react';
import type { RtcSignalEvent } from '../types';

interface UseWebRtcProps {
  userId: number;
  sendRtcSignal: (type: RtcSignalEvent['type'], data: any, targetId?: number) => void;
}

export const useWebRtc = ({ userId, sendRtcSignal }: UseWebRtcProps) => {
  const [micActive, setMicActive] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: number; stream: MediaStream }[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());

  const iceServers: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const getOrCreatePeerConnection = (peerId: number): RTCPeerConnection => {
    if (peerConnections.current.has(peerId)) {
      return peerConnections.current.get(peerId)!;
    }

    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal('candidate', event.candidate, peerId);
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from peer ${peerId}`);
      setRemoteStreams((prev) => {
        const existing = prev.find((p) => p.peerId === peerId);
        if (existing) return prev;
        return [...prev, { peerId, stream: event.streams[0] }];
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnections.current.set(peerId, pc);
    return pc;
  };

  const startLocalMedia = async (audio: boolean, video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
      localStreamRef.current = stream;
      setMicActive(audio);
      setCamActive(video);
      return stream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      return null;
    }
  };

  const toggleMic = async () => {
    if (!localStreamRef.current) {
      const stream = await startLocalMedia(true, false);
      if (stream) setMicActive(true);
      return;
    }
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicActive(audioTrack.enabled);
    } else {
      const newStream = await startLocalMedia(true, camActive);
      if (newStream) setMicActive(true);
    }
  };

  const toggleCam = async () => {
    if (!localStreamRef.current) {
      const stream = await startLocalMedia(micActive, true);
      if (stream) setCamActive(true);
      return;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamActive(videoTrack.enabled);
    } else {
      const newStream = await startLocalMedia(micActive, true);
      if (newStream) setCamActive(true);
    }
  };

  const handleIncomingSignal = useCallback(
    async (signal: RtcSignalEvent) => {
      if (signal.senderId === userId) return;

      const peerId = signal.senderId;
      const pc = getOrCreatePeerConnection(peerId);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendRtcSignal('answer', answer, peerId);
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
      } else if (signal.type === 'candidate') {
        if (signal.data) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.data));
        }
      }
    },
    [userId, sendRtcSignal]
  );

  return {
    micActive,
    camActive,
    remoteStreams,
    localStream: localStreamRef.current,
    toggleMic,
    toggleCam,
    handleIncomingSignal,
  };
};
