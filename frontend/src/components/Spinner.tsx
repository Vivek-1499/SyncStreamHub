import React from 'react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'sm',
  label,
  className = '',
}) => {
  return (
    <span className={`spinner-wrapper size-${size} ${className}`}>
      <span className="spinner-ring" />
      {label && <span className="spinner-label">{label}</span>}
    </span>
  );
};

interface FullScreenLoaderProps {
  message?: string;
  subtext?: string;
}

export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message = 'Loading...',
  subtext = 'Connecting to SyncStream Hub, please wait...',
}) => {
  return (
    <div className="fullscreen-loader-overlay fade-in">
      <div className="loader-card glass-card">
        <div className="loader-logo-wrapper">
          <span className="loader-emoji animate-bounce">🍿</span>
          <span className="loader-ring-glow" />
        </div>
        <h3 className="loader-title">{message}</h3>
        <p className="loader-subtext">{subtext}</p>
        <div className="loader-bar-container">
          <div className="loader-bar-fill" />
        </div>
      </div>
    </div>
  );
};
