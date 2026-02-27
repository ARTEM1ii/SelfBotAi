'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App, Avatar, Badge, Button, Empty, Popconfirm,
  Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  BlockOutlined,
  DeleteOutlined,
  RobotOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { Text, Title } = Typography;

interface Peer {
  id: string;
  peerId: string;
  peerName: string | null;
  peerUsername: string | null;
  isBlocked: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function ConversationsPage() {
  const { message } = App.useApp();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [peersLoading, setPeersLoading] = useState(true);
  const [selected, setSelected] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchPeers = useCallback(async () => {
    try {
      const { data } = await api.get<Peer[]>('/telegram/peers');
      setPeers(data);
    } finally {
      setPeersLoading(false);
    }
  }, []);

  useEffect(() => { fetchPeers(); }, [fetchPeers]);

  const openConversation = async (peer: Peer) => {
    setSelected(peer);
    setMsgLoading(true);
    try {
      const { data } = await api.get<Message[]>(`/telegram/peers/${peer.peerId}/messages`);
      setMessages(data);
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDelete = async (peer: Peer) => {
    await api.delete(`/telegram/peers/${peer.peerId}`);
    message.success('Conversation deleted');
    setPeers((prev) => prev.filter((p) => p.peerId !== peer.peerId));
    if (selected?.peerId === peer.peerId) {
      setSelected(null);
      setMessages([]);
    }
  };

  const handleClearHistory = async (peer: Peer) => {
    await api.delete(`/telegram/peers/${peer.peerId}/messages`);
    message.success('History cleared');
    setMessages([]);
  };

  const handleBlock = async (peer: Peer) => {
    const { data } = await api.patch<Peer>(`/telegram/peers/${peer.peerId}/block`, {
      isBlocked: !peer.isBlocked,
    });
    const label = data.isBlocked ? 'Blocked' : 'Unblocked';
    message.success(`${label} ${data.peerName ?? data.peerId}`);
    setPeers((prev) => prev.map((p) => (p.peerId === peer.peerId ? data : p)));
    if (selected?.peerId === peer.peerId) setSelected(data);
  };

  const displayName = (peer: Peer) =>
    peer.peerName ?? (peer.peerUsername ? `@${peer.peerUsername}` : `ID: ${peer.peerId}`);

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Conversations</Title>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 160px)' }}>
        {/* Peers list */}
        <div style={{
          width: 300,
          flexShrink: 0,
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          overflowY: 'auto',
        }}>
          {peersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : peers.length === 0 ? (
            <Empty
              description="No conversations yet"
              style={{ padding: 40 }}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div>
              {peers.map((peer) => (
                <div
                  key={peer.peerId}
                  onClick={() => openConversation(peer)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selected?.peerId === peer.peerId ? '#f0f0ff' : undefined,
                    borderLeft: selected?.peerId === peer.peerId ? '3px solid #6366f1' : '3px solid transparent',
                    borderBottom: '1px solid #f5f5f5',
                    transition: 'background 0.15s',
                  }}
                >
                  <Badge dot color={peer.isBlocked ? 'red' : 'green'} offset={[-4, 28]}>
                    <Avatar icon={<UserOutlined />} style={{ background: '#6366f1', flexShrink: 0 }} />
                  </Badge>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text strong style={{ fontSize: 13 }} ellipsis>{displayName(peer)}</Text>
                      {peer.isBlocked && (
                        <Tag color="error" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>blocked</Tag>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {peer.lastMessagePreview ?? '—'}
                    </Text>
                  </div>

                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={peer.isBlocked ? 'Unblock' : 'Block'}>
                      <Button
                        type="text"
                        size="small"
                        icon={peer.isBlocked ? <BlockOutlined style={{ color: '#ff4d4f' }} /> : <StopOutlined />}
                        onClick={() => handleBlock(peer)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Delete this conversation?"
                      onConfirm={() => handleDelete(peer)}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat window */}
        <div style={{
          flex: 1,
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="Select a conversation" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#6366f1' }} />
                <div style={{ flex: 1 }}>
                  <Text strong>{displayName(selected)}</Text>
                  {selected.peerUsername && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      @{selected.peerUsername}
                    </Text>
                  )}
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Telegram ID: {selected.peerId}
                  </Text>
                </div>
                <Popconfirm
                  title="Clear all messages with this user?"
                  description="Bot will forget everything. Cannot be undone."
                  onConfirm={() => handleClearHistory(selected)}
                  okText="Clear"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />}>Clear history</Button>
                </Popconfirm>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {msgLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                    <Spin />
                  </div>
                ) : messages.length === 0 ? (
                  <Empty description="No messages" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                        alignItems: 'flex-end',
                        gap: 8,
                      }}
                    >
                      {msg.role === 'user' && (
                        <Avatar size="small" icon={<UserOutlined />} style={{ background: '#6366f1', flexShrink: 0 }} />
                      )}
                      <div style={{
                        maxWidth: '70%',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                        background: msg.role === 'user' ? '#f5f5f5' : '#6366f1',
                        color: msg.role === 'user' ? '#000' : '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}>
                        <Text style={{ color: 'inherit', whiteSpace: 'pre-wrap', fontSize: 14 }}>
                          {msg.content}
                        </Text>
                        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {msg.role === 'assistant' && (
                        <Avatar size="small" icon={<RobotOutlined />} style={{ background: '#d9d9d9', flexShrink: 0 }} />
                      )}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
