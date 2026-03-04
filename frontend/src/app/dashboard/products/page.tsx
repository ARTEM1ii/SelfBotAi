'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Card, Form, Input, InputNumber, Modal,
  Popconfirm, Space, Table, Tag, Typography, Upload, Image,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Product } from '@/types';

const { Title } = Typography;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ProductsPage() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get<Product[]>('/products');
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreateModal = () => {
    setEditingProduct(null);
    form.resetFields();
    setFileList([]);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      name: product.name,
      description: product.description ?? '',
      length: product.length ?? '',
      price: product.price,
      quantity: product.quantity,
    });
    setFileList([]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const formData = new FormData();
      formData.append('name', values.name);
      if (values.description) formData.append('description', values.description);
      if (values.length) formData.append('length', values.length);
      formData.append('price', String(values.price));
      formData.append('quantity', String(values.quantity));

      if (fileList.length > 0 && fileList[0].originFileObj) {
        formData.append('image', fileList[0].originFileObj);
      }

      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (editingProduct) {
        await fetch(`${API_URL}/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers,
          body: formData,
        });
        message.success('Product updated');
      } else {
        await fetch(`${API_URL}/api/products`, {
          method: 'POST',
          headers,
          body: formData,
        });
        message.success('Product created');
      }

      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      message.success('Product deleted');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      message.error('Failed to delete product');
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'Image',
      dataIndex: 'imagePath',
      key: 'image',
      width: 80,
      render: (imagePath: string | null, record: Product) =>
        imagePath ? (
          <Image
            src={`${API_URL}/api/products/${record.id}/image`}
            alt={record.name}
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPjM9Ql1QAAAABJRU5ErkJggg=="
          />
        ) : (
          <div style={{
            width: 50, height: 50, background: '#f0f0f0',
            borderRadius: 4, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#bbb', fontSize: 12,
          }}>
            No img
          </div>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc || '—',
    },
    {
      title: 'Length',
      dataIndex: 'length',
      key: 'length',
      width: 120,
      render: (len: string | null) => len || '—',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => `${Number(price).toFixed(2)} ₽`,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (qty: number) => (
        <Tag color={qty > 0 ? 'green' : 'red'}>{qty}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Product) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this product?"
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
      <Title level={3} style={{ marginBottom: 24 }}>Products</Title>

      <Modal
        title={editingProduct ? `Edit: ${editingProduct.name}` : 'New Product'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editingProduct ? 'Save' : 'Create'}
        confirmLoading={saving}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="Product name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Product description" />
          </Form.Item>

          <Form.Item name="length" label="Dimensions / Length">
            <Input placeholder="e.g. 12mm x 6m" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item
              name="price"
              label="Price (₽)"
              rules={[{ required: true, message: 'Price is required' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>

            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Quantity is required' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Space>

          <Form.Item label="Image">
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: newFileList }) => setFileList(newFileList.slice(-1))}
              accept="image/*"
              maxCount={1}
            >
              {fileList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0 }}>
            Product catalog ({products.length})
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Add Product
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No products yet. Add your first product above.' }}
        />
      </Card>
    </div>
  );
}
