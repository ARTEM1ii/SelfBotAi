'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Card, Input, Typography, Spin, Tooltip } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { ChatMessage, ChatResponse } from '@/types';

const { Title, Text } = Typography;

interface HistoryItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history from server on mount
  useEffect(() => {
    api.get<HistoryItem[]>('/ai/history')
      .then(({ data }) => {
        setMessages(data.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {
        // silently ignore — server may be unavailable
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const { data } = await api.post<ChatResponse>('/ai/chat', {
        message: text,
      });

      const assistantMessage: ChatMessage = { role: 'assistant', content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    await api.delete('/ai/history');
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Chat with AI</Title>
        {messages.length > 0 && (
          <Tooltip title="Clear chat history">
            <Button
              icon={<DeleteOutlined />}
              onClick={clearHistory}
              type="text"
              danger
            >
              Clear history
            </Button>
          </Tooltip>
        )}
      </div>

      <Card
        style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0 } }}
      >
        <div style={styles.messageList}>
          {historyLoading && (
            <div style={styles.emptyState}>
              <Spin size="large" />
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div style={styles.emptyState}>
              <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <Text type="secondary" style={{ marginTop: 12 }}>
                Ask anything — the AI will answer based on your uploaded files.
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Chat history is saved on the server across sessions.
              </Text>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{ ...styles.messageRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
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
            disabled={loading || historyLoading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={loading}
            disabled={!input.trim() || historyLoading}
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
    gap: 12,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  inputArea: {
    padding: '16px 24px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'flex-end',
  },
};
