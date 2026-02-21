import React, { useState } from 'react';

interface InfoTipProps {
  text: string;
}

const InfoTip: React.FC<InfoTipProps> = ({ text }) => {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        style={{
          cursor: 'help',
          fontSize: '0.75rem',
          color: '#666',
          userSelect: 'none',
        }}
      >
        &#9432;
      </span>
      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '8px 12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 8,
            color: '#ccc',
            fontSize: '0.78rem',
            lineHeight: 1.45,
            width: 260,
            whiteSpace: 'pre-wrap',
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

export default InfoTip;
