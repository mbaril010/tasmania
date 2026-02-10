import React from 'react';

interface Props {
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<Props> = ({ children, title, style }) => {
  return (
    <div
      style={{
        background: '#1a1a1a',
        borderRadius: 12,
        border: '1px solid #2a2a2a',
        padding: '1.25rem',
        ...style,
      }}
    >
      {title && (
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e0e0e0' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

export default Card;
