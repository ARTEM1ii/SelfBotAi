'use client';

import { ConfigProvider, theme } from 'antd';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function AntdProvider({ children }: Props) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
          fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
