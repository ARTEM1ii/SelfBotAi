'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App, Button, Card, Form, Input, InputNumber, Modal,
  Popconfirm, Space, Table, Tag, Typography, Upload, Image,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Product, ProductImage } from '@/types';

const { Title } = Typography;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ExistingImage {
  id: string;
  url: string;
}

export default function ProductsPage() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchProducts = useCallback(async (search?: string) => {
    try {
      const params = search ? { search } : {};
      const { data } = await api.get<Product[]>('/products', { params });
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      fetchProducts(value);
    }, 300);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    form.resetFields();
    setFileList([]);
    setExistingImages([]);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      name: product.name,
      description: product.description ?? '',
      width: product.width ?? '',
      height: product.height ?? '',
      depth: product.depth ?? '',
      weight: product.weight ?? '',
      price: product.price,
      quantity: product.quantity,
    });
    setFileList([]);

    const imgs: ExistingImage[] = (product.images ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({
        id: img.id,
        url: `${API_URL}/api/products/${product.id}/image?imageId=${img.id}`,
      }));

    // Fallback: if no images array but imagePath exists
    if (imgs.length === 0 && product.imagePath) {
      imgs.push({
        id: 'legacy',
        url: `${API_URL}/api/products/${product.id}/image`,
      });
    }

    setExistingImages(imgs);
    setModalOpen(true);
  };

  const handleRemoveExistingImage = async (imageId: string) => {
    if (!editingProduct) return;
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = imageId === 'legacy'
        ? `${API_URL}/api/products/${editingProduct.id}/image`
        : `${API_URL}/api/products/${editingProduct.id}/image?imageId=${imageId}`;

      await fetch(url, { method: 'DELETE', headers });
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {
      message.error('Failed to delete image');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const formData = new FormData();
      formData.append('name', values.name);
      if (values.description) formData.append('description', values.description);
      if (values.width) formData.append('width', values.width);
      if (values.height) formData.append('height', values.height);
      if (values.depth) formData.append('depth', values.depth);
      if (values.weight) formData.append('weight', values.weight);
      formData.append('price', String(values.price));
      formData.append('quantity', String(values.quantity));

      for (const file of fileList) {
        if (file.originFileObj) {
          formData.append('images', file.originFileObj);
        }
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
      fetchProducts(searchQuery);
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
      dataIndex: 'images',
      key: 'image',
      width: 100,
      render: (_: unknown, record: Product) => {
        const imgs = record.images ?? [];
        if (imgs.length > 0) {
          return (
            <Image.PreviewGroup
              items={imgs
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((img) => `${API_URL}/api/products/${record.id}/image?imageId=${img.id}`)}
            >
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Image
                  src={`${API_URL}/api/products/${record.id}/image?imageId=${imgs[0].id}`}
                  alt={record.name}
                  width={50}
                  height={50}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPjM9Ql1QAAAABJRU5ErkJggg=="
                />
                {imgs.length > 1 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 10, padding: '1px 4px', borderRadius: '0 4px 0 4px',
                  }}>
                    +{imgs.length - 1}
                  </span>
                )}
              </div>
            </Image.PreviewGroup>
          );
        }

        if (record.imagePath) {
          return (
            <Image
              src={`${API_URL}/api/products/${record.id}/image`}
              alt={record.name}
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPjM9Ql1QAAAABJRU5ErkJggg=="
            />
          );
        }

        return (
          <div style={{
            width: 50, height: 50, background: '#f0f0f0',
            borderRadius: 4, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#bbb', fontSize: 12,
          }}>
            No img
          </div>
        );
      },
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
      title: 'Dimensions',
      dataIndex: 'width',
      key: 'dimensions',
      width: 160,
      render: (_: unknown, record: Product) => {
        const parts = [record.width, record.height, record.depth].filter(Boolean);
        return parts.length > 0 ? parts.join(' x ') : '—';
      },
    },
    {
      title: 'Weight',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (w: string | null) => w || '—',
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
        forceRender
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

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="width" label="Width" style={{ flex: 1 }}>
              <Input placeholder="e.g. 12mm" />
            </Form.Item>
            <Form.Item name="height" label="Height" style={{ flex: 1 }}>
              <Input placeholder="e.g. 6mm" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="depth" label="Length / Depth" style={{ flex: 1 }}>
              <Input placeholder="e.g. 6m" />
            </Form.Item>
            <Form.Item name="weight" label="Weight" style={{ flex: 1 }}>
              <Input placeholder="e.g. 5kg" />
            </Form.Item>
          </Space>

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

          <Form.Item label="Images">
            {/* Show existing images */}
            {existingImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {existingImages.map((img) => (
                  <div key={img.id} style={{ display: 'inline-block', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt="Product"
                      style={{
                        width: 104,
                        height: 104,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid #d9d9d9',
                        display: 'block',
                      }}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        background: '#fff',
                        borderRadius: '50%',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      }}
                      onClick={() => handleRemoveExistingImage(img.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Upload new images */}
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              accept="image/*"
              multiple
            >
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>Upload</div>
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Product catalog ({products.length})
          </Title>
          <Input
            placeholder="Search products..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            allowClear
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
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
