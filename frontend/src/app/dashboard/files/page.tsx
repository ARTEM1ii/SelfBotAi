'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Card, Table, Tag, Typography, Upload,
  Popconfirm, Space, Modal,
} from 'antd';
import {
  UploadOutlined, DeleteOutlined, InboxOutlined, EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { UploadedFile, FileStatus } from '@/types';

const { Title } = Typography;
const { Dragger } = Upload;

const STATUS_COLOR: Record<FileStatus, string> = {
  [FileStatus.PENDING]: 'default',
  [FileStatus.PROCESSING]: 'processing',
  [FileStatus.PROCESSED]: 'success',
  [FileStatus.FAILED]: 'error',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { message } = App.useApp();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editFile, setEditFile] = useState<UploadedFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await api.get<UploadedFile[]>('/files');
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Periodically refresh the list while the page is open
  useEffect(() => {
    const intervalId = setInterval(fetchFiles, 3000);
    return () => clearInterval(intervalId);
  }, [fetchFiles]);

  const handleEdit = async (file: UploadedFile) => {
    setEditFile(file);
    setEditLoading(true);
    try {
      const { data } = await api.get<string>(`/files/${file.id}/content`);
      setEditContent(data);
    } catch {
      message.error('Failed to load file content');
      setEditFile(null);
    } finally {
      setEditLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editFile) return;
    setSaving(true);
    try {
      await api.patch(`/files/${editFile.id}/content`, { content: editContent });
      message.success('Saved. Re-indexing started...');
      setEditFile(null);
      fetchFiles();
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/files/${id}`);
    message.success('File deleted');
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    action: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/files/upload`,
    headers: { Authorization: `Bearer ${getToken()}` },
    accept: '.txt,.pdf,.docx,.md',
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} uploaded`);
        fetchFiles();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} upload failed`);
      }
    },
    showUploadList: false,
  };

  const columns: ColumnsType<UploadedFile> = [
    {
      title: 'Name',
      dataIndex: 'originalName',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'fileType',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatBytes(size),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: FileStatus) => (
        <Tag color={STATUS_COLOR[status]}>{status}</Tag>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: UploadedFile) => (
        <Space>
          {(record.fileType === 'txt' || record.fileType === 'md') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          )}
          <Popconfirm
            title="Delete this file?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>My Files</Title>

      <Modal
        title={editFile ? `Edit: ${editFile.originalName}` : ''}
        open={!!editFile}
        onCancel={() => setEditFile(null)}
        onOk={handleSave}
        okText="Save"
        confirmLoading={saving}
        width={720}
        destroyOnHidden
      >
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          disabled={editLoading}
          style={{
            width: '100%',
            height: 420,
            fontFamily: 'monospace',
            fontSize: 13,
            padding: 8,
            resize: 'vertical',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            outline: 'none',
          }}
        />
      </Modal>

      <Card style={{ marginBottom: 16 }}>
        <Dragger {...uploadProps}>
          <p style={{ fontSize: 32 }}><InboxOutlined /></p>
          <p>Click or drag files here to upload</p>
          <p style={{ color: '#8c8c8c', fontSize: 13 }}>
            Supported: .txt, .pdf, .docx, .md — max 10MB
          </p>
        </Dragger>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0 }}>Uploaded files ({files.length})</Title>
          <Space>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Upload</Button>
            </Upload>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={files}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No files yet. Upload your first file above.' }}
        />
      </Card>
    </div>
  );
}
