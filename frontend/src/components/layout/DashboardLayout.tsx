'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Layout,
  Menu,
  Typography,
  Avatar,
  Dropdown,
  Button,
  Spin,
} from 'antd';
import {
  DashboardOutlined,
  FileOutlined,
  MessageOutlined,
  SendOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { authApi, removeToken, getToken } from '@/lib/auth';
import { User } from '@/types';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const NAV_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/dashboard/files', icon: <FileOutlined />, label: 'My Files' },
  { key: '/dashboard/chat', icon: <MessageOutlined />, label: 'Chat' },
  { key: '/dashboard/telegram', icon: <SendOutlined />, label: 'Telegram' },
];

interface Props {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    authApi.me()
      .then(setUser)
      .catch(() => {
        removeToken();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ''}`.trim()
    : user?.email ?? '';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={styles.sider}
        breakpoint="lg"
        collapsedWidth={0}
      >
        <div style={styles.logo}>
          <Text strong style={{ color: '#fff', fontSize: 16 }}>
            TelegramLLM
          </Text>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.key}>{item.label}</Link>,
          }))}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={styles.header}>
          <div style={{ flex: 1 }} />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" style={styles.userButton}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text style={{ marginLeft: 8 }}>{displayName}</Text>
            </Button>
          </Dropdown>
        </Header>

        <Content style={styles.content}>{children}</Content>
      </Layout>
    </Layout>
  );
}

const styles = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sider: {
    background: '#1a1a2e',
    position: 'fixed' as const,
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
  logo: {
    height: 64,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 24,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    background: '#fff',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #f0f0f0',
    marginLeft: 220,
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    height: 'auto',
  },
  content: {
    marginLeft: 220,
    padding: 24,
    background: '#f5f5f5',
    minHeight: 'calc(100vh - 64px)',
  },
} as const;
