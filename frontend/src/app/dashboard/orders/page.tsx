'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Select,
  InputNumber,
  message,
  Typography,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api';
import { Order, OrderItem, OrderStatus } from '@/types';

const { Title } = Typography;
const { Search } = Input;

const STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'orange',
  [OrderStatus.CONFIRMED]: 'blue',
  [OrderStatus.COMPLETED]: 'green',
  [OrderStatus.CANCELLED]: 'red',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.COMPLETED]: 'Completed',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [peerFilter, setPeerFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (peerFilter) params.peerId = peerFilter;
      const { data } = await api.get<Order[]>('/orders', { params });
      setOrders(data);
    } catch {
      message.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [peerFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await api.patch(`/orders/${orderId}`, { status });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
      message.success('Status updated');
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleQuantityChange = async (
    orderId: string,
    itemId: string,
    quantity: number,
  ) => {
    try {
      const { data } = await api.patch<Order>(
        `/orders/${orderId}/items/${itemId}`,
        { quantity },
      );
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? data : o)),
      );
    } catch {
      message.error('Failed to update quantity');
    }
  };

  const expandedRowRender = (order: Order) => {
    const itemColumns: ColumnsType<OrderItem> = [
      { title: 'Product', dataIndex: 'productName', key: 'productName' },
      {
        title: 'Price',
        dataIndex: 'price',
        key: 'price',
        render: (p: number) => `${Number(p).toFixed(2)} ₽`,
      },
      {
        title: 'Qty',
        key: 'quantity',
        render: (_: any, item: OrderItem) => (
          <InputNumber
            min={1}
            value={item.quantity}
            onChange={(val) => {
              if (val && val > 0) handleQuantityChange(order.id, item.id, val);
            }}
            size="small"
          />
        ),
      },
      {
        title: 'Subtotal',
        key: 'subtotal',
        render: (_: any, item: OrderItem) =>
          `${(Number(item.price) * item.quantity).toFixed(2)} ₽`,
      },
    ];

    return (
      <Table
        columns={itemColumns}
        dataSource={order.items}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  const columns: ColumnsType<Order> = [
    {
      title: '#',
      key: 'num',
      width: 80,
      render: (_: any, record: Order) => record.id.slice(0, 8),
    },
    {
      title: 'Client',
      key: 'client',
      render: (_: any, record: Order) => {
        const name = record.peerName ?? '';
        const username = record.peerUsername ? `@${record.peerUsername}` : '';
        return `${name} ${username}`.trim() || record.peerId;
      },
    },
    {
      title: 'Items',
      key: 'items',
      render: (_: any, record: Order) =>
        record.items.map((i) => `${i.productName} x${i.quantity}`).join(', '),
    },
    {
      title: 'Total',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (p: number) => `${Number(p).toFixed(2)} ₽`,
      sorter: (a: Order, b: Order) => Number(a.totalPrice) - Number(b.totalPrice),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Order) => (
        <Select
          value={record.status}
          onChange={(val) => handleStatusChange(record.id, val)}
          size="small"
          style={{ width: 130 }}
        >
          {Object.values(OrderStatus).map((s) => (
            <Select.Option key={s} value={s}>
              <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
      sorter: (a: Order, b: Order) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Orders</Title>
        <Search
          placeholder="Filter by Peer ID"
          allowClear
          onSearch={setPeerFilter}
          style={{ width: 250 }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 20 }}
      />
    </DashboardLayout>
  );
}
