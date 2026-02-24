'use client';

import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Badge } from 'antd';
import { FileOutlined, SendOutlined, RobotOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { UploadedFile, TelegramSession, TelegramSessionStatus, FileStatus } from '@/types';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [telegram, setTelegram] = useState<TelegramSession | null>(null);

  useEffect(() => {
    api.get<UploadedFile[]>('/files').then((r) => setFiles(r.data)).catch(() => null);
    api.get<TelegramSession>('/telegram/status').then((r) => setTelegram(r.data)).catch(() => null);
  }, []);

  const processedFiles = files.filter((f) => f.status === FileStatus.PROCESSED).length;
  const telegramActive = telegram?.status === TelegramSessionStatus.ACTIVE;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Overview</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Files"
              value={files.length}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Processed Files"
              value={processedFiles}
              prefix={<RobotOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Telegram"
              value={telegramActive ? 'Connected' : 'Disconnected'}
              prefix={<SendOutlined />}
              valueStyle={{ color: telegramActive ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Quick Start" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Step
                num={1}
                done={files.length > 0}
                text="Upload your files (txt, pdf, docx, md)"
              />
              <Step
                num={2}
                done={processedFiles > 0}
                text="Wait for AI to process your files"
              />
              <Step
                num={3}
                done={telegram?.status === TelegramSessionStatus.ACTIVE || false}
                text="Connect your Telegram account"
              />
              <Step
                num={4}
                done={telegram?.isAutoReplyEnabled ?? false}
                text="Enable AI auto-reply"
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Telegram Status" style={{ height: '100%' }}>
            {telegram ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <Text type="secondary">Status: </Text>
                  <Badge
                    status={telegramActive ? 'success' : 'default'}
                    text={telegram.status}
                  />
                </div>
                {telegram.phone && (
                  <div>
                    <Text type="secondary">Phone: </Text>
                    <Text>{telegram.phone}</Text>
                  </div>
                )}
                <div>
                  <Text type="secondary">Auto-reply: </Text>
                  <Badge
                    status={telegram.isAutoReplyEnabled ? 'success' : 'error'}
                    text={telegram.isAutoReplyEnabled ? 'Enabled' : 'Disabled'}
                  />
                </div>
              </div>
            ) : (
              <Text type="secondary">No Telegram account connected yet.</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function Step({ num, done, text }: { num: number; done: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: done ? '#52c41a' : '#d9d9d9',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {done ? '✓' : num}
      </div>
      <Text style={{ textDecoration: done ? 'line-through' : 'none', color: done ? '#8c8c8c' : undefined }}>
        {text}
      </Text>
    </div>
  );
}
