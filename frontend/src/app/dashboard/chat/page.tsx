'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Card, Input, Typography, Spin, Tag } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { ChatMessage, ChatResponse } from '@/types';

const { Title, Text } = Typography;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post<ChatResponse>('/ai/chat', {
        message: text,
        conversationHistory: messages.slice(-10),
      });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Chat with AI</Title>

      <Card style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
        <div style={styles.messageList}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <Text type="secondary" style={{ marginTop: 12 }}>
                Ask anything — the AI will answer based on your uploaded files.
              </Text>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ ...styles.messageRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={styles.avatar}>
                  <RobotOutlined style={{ color: '#6366f1' }} />
                </div>
              )}
              <div style={{
                ...styles.bubble,
                background: msg.role === 'user' ? '#6366f1' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#000',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              }}>
                <Text style={{ color: 'inherit', whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
              </div>
              {msg.role === 'user' && (
                <div style={styles.avatar}>
                  <UserOutlined style={{ color: '#8c8c8c' }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
              <div style={styles.avatar}>
                <RobotOutlined style={{ color: '#6366f1' }} />
              </div>
              <div style={{ ...styles.bubble, background: '#fff' }}>
                <Spin size="small" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={styles.inputArea}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1, resize: 'none', borderRadius: 8 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={loading}
            disabled={!input.trim()}
            style={{ marginLeft: 8, height: 40 }}
          />
        </div>
      </Card>
    </div>
  );
}

const styles = {
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  inputArea: {
    padding: '12px 24px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'flex-end',
    background: '#fff',
  },
} as const;
