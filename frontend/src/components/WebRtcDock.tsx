import React from 'react';

interface WebRtcDockProps {
  micActive: boolean;
  camActive: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  remoteStreams: { peerId: number; stream: MediaStream }[];
}

export const WebRtcDock: React.FC<WebRtcDockProps> = ({
  micActive,
  camActive,
  onToggleMic,
  onToggleCam,
  remoteStreams,
}) => {
  return (
    <div className="webrtc-dock glass-card">
      <div className="webrtc-controls">
        <button
          type="button"
          className={`webrtc-btn ${micActive ? 'active' : ''}`}
          onClick={onToggleMic}
          title={micActive ? 'Mute Mic' : 'Unmute Mic'}
        >
          {micActive ? '🎙️ Mic On' : '🎙️ Mic Off'}
        </button>

        <button
          type="button"
          className={`webrtc-btn ${camActive ? 'active' : ''}`}
          onClick={onToggleCam}
          title={camActive ? 'Disable Cam' : 'Enable Cam'}
        >
          {camActive ? '📹 Cam On' : '📹 Cam Off'}
        </button>
      </div>

      {remoteStreams.length > 0 && (
        <div className="remote-streams-grid">
          {remoteStreams.map(({ peerId, stream }) => (
            <div key={peerId} className="peer-avatar-card">
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && el.srcObject !== stream) {
                    el.srcObject = stream;
                  }
                }}
                className="peer-video"
              />
              <span className="peer-label">Peer #{peerId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
