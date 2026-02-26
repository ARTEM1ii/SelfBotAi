'use client';

import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Form, Input, Steps,
  Switch, Typography, message, Tag,
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { TelegramSession, TelegramSessionStatus } from '@/types';
import { AxiosError } from 'axios';

const { Title, Text, Paragraph } = Typography;

export default function TelegramPage() {
  const [session, setSession] = useState<TelegramSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    api.get<TelegramSession>('/telegram/status')
      .then((r) => {
        setSession(r.data);
        if (r.data?.status === TelegramSessionStatus.ACTIVE) setStep(3);
        else if (r.data?.status === TelegramSessionStatus.AWAITING_PASSWORD) setStep(2);
        else if (r.data?.status === TelegramSessionStatus.AWAITING_CODE) setStep(2);
        else if (r.data) setStep(1);
      })
      .catch(() => null);
  }, []);

  const post = async (url: string, data: object) => {
    setLoading(true);
    try {
      const res = await api.post<{ status: string }>(url, data);
      return res.data;
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      message.error(e.response?.data?.message ?? 'Request failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const onSaveCredentials = async (values: { apiId: string; apiHash: string }) => {
    const res = await post('/telegram/credentials', {
      apiId: parseInt(values.apiId, 10),
      apiHash: values.apiHash,
    });
    if (res) { message.success('Credentials saved'); setStep(1); }
  };

  const onSendCode = async (values: { phone: string }) => {
    const res = await post('/telegram/send-code', values);
    if (res) { message.success('Code sent to your phone'); setStep(2); }
  };

  const onVerifyCode = async (values: { code: string }) => {
    const res = await post('/telegram/verify-code', values);
    if (!res) return;
    if (res.status === 'password_required') { 
      message.info('2FA password required'); 
      setNeedsPassword(true);
      setStep(2); 
      return; 
    }
    message.success('Connected!');
    const updated = await api.get<TelegramSession>('/telegram/status');
    setSession(updated.data);
    setStep(3);
  };

  const onVerifyPassword = async (values: { password: string }) => {
    const res = await post('/telegram/verify-password', values);
    if (!res) return;
    message.success('Connected!');
    const updated = await api.get<TelegramSession>('/telegram/status');
    setSession(updated.data);
    setStep(3);
  };

  const onToggleAutoReply = async (enabled: boolean) => {
    await api.patch('/telegram/auto-reply', { enabled });
    setSession((prev) => prev ? { ...prev, isAutoReplyEnabled: enabled } : prev);
    message.success(enabled ? 'Auto-reply enabled' : 'Auto-reply disabled');
  };

  const onDisconnect = async () => {
    await api.delete('/telegram/disconnect');
    message.success('Disconnected');
    setSession(null);
    setStep(0);
  };

  const isConnected = session?.status === TelegramSessionStatus.ACTIVE;

  return (
    <div style={{ maxWidth: 640 }}>
      <Title level={3} style={{ marginBottom: 8 }}>Telegram Integration</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Connect your personal Telegram account. You need to get your own API credentials from{' '}
        <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a>.
      </Paragraph>

      {isConnected && (
        <Alert
          type="success"
          title="Telegram connected"
          description={`Phone: ${session?.phone ?? '—'}`}
          style={{ marginBottom: 24 }}
          showIcon
        />
      )}

      <Steps
        current={step}
        style={{ marginBottom: 32 }}
        items={[
          { title: 'API Keys' },
          { title: 'Phone' },
          { title: 'Verify' },
          { title: 'Done' },
        ]}
      />

      {step === 0 && (
        <Card title="Step 1 — Enter your Telegram API credentials">
          <Paragraph type="secondary">
            Go to <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a>,
            log in, create an app, and copy your <Text code>API ID</Text> and <Text code>API Hash</Text>.
          </Paragraph>
          <Form layout="vertical" onFinish={onSaveCredentials} requiredMark={false}>
            <Form.Item label="API ID" name="apiId" rules={[{ required: true }]}>
              <Input placeholder="12345678" size="large" />
            </Form.Item>
            <Form.Item label="API Hash" name="apiHash" rules={[{ required: true }]}>
              <Input placeholder="abc123def456..." size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              Save credentials
            </Button>
          </Form>
        </Card>
      )}

      {step === 1 && (
        <Card title="Step 2 — Enter your phone number">
          <Form layout="vertical" onFinish={onSendCode} requiredMark={false}>
            <Form.Item label="Phone number" name="phone" rules={[{ required: true }]}>
              <Input placeholder="+79001234567" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              Send code
            </Button>
            <Button type="link" onClick={() => setStep(0)}>Change credentials</Button>
          </Form>
        </Card>
      )}

      {step === 2 && !needsPassword && (
        <Card title="Step 3 — Enter the code from Telegram">
          <Form layout="vertical" onFinish={onVerifyCode} requiredMark={false}>
            <Form.Item label="Verification code" name="code" rules={[{ required: true }]}>
              <Input placeholder="12345" size="large" maxLength={6} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              Verify code
            </Button>
            <Button type="link" onClick={() => setStep(1)}>Resend code</Button>
          </Form>
        </Card>
      )}

      {step === 2 && needsPassword && (
        <Card title="Step 3 — Two-factor authentication">
          <Form layout="vertical" onFinish={onVerifyPassword} requiredMark={false}>
            <Form.Item label="2FA Password" name="password" rules={[{ required: true }]}>
              <Input.Password placeholder="Your Telegram 2FA password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              Verify password
            </Button>
          </Form>
        </Card>
      )}

      {step === 3 && (
        <Card title="Telegram Settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>AI Auto-reply</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  AI will automatically reply to incoming Telegram messages on your behalf
                </Text>
              </div>
              <Switch
                checked={session?.isAutoReplyEnabled ?? false}
                onChange={onToggleAutoReply}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>Status</Text>
                <br />
                <Tag color="success" icon={<SendOutlined />}>Active</Tag>
              </div>
              <Button danger onClick={onDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
