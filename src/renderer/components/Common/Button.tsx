import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    border: 'none',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  primary: {
    background: '#fbbf24',
    color: '#1a1a1a',
  },
  secondary: {
    background: '#252525',
    color: '#e0e0e0',
    border: '1px solid #333',
  },
  danger: {
    background: '#dc2626',
    color: '#fff',
  },
  ghost: {
    background: 'transparent',
    color: '#aaa',
  },
  sm: {
    padding: '6px 12px',
    fontSize: '0.8rem',
  },
  md: {
    padding: '8px 16px',
    fontSize: '0.9rem',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

const Button: React.FC<Props> = ({ variant = 'primary', size = 'md', disabled, style, ...props }) => {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...styles.base,
        ...styles[variant],
        ...styles[size],
        ...(disabled ? styles.disabled : {}),
        ...style,
      }}
    />
  );
};

export default Button;
