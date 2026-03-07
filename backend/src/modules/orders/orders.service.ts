import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async addToCart(
    userId: string,
    peerId: string,
    productId: string,
    quantity: number = 1,
  ): Promise<CartItem> {
    const existing = await this.cartItemRepo.findOne({
      where: { userId, peerId, productId },
    });

    if (existing) {
      existing.quantity += quantity;
      return this.cartItemRepo.save(existing);
    }

    return this.cartItemRepo.save(
      this.cartItemRepo.create({ userId, peerId, productId, quantity }),
    );
  }

  async removeFromCart(
    userId: string,
    peerId: string,
    productId: string,
  ): Promise<void> {
    await this.cartItemRepo.delete({ userId, peerId, productId });
  }

  async getCart(
    userId: string,
    peerId: string,
  ): Promise<(CartItem & { product: Product })[]> {
    return this.cartItemRepo.find({
      where: { userId, peerId },
      relations: ['product'],
      order: { createdAt: 'ASC' },
    }) as Promise<(CartItem & { product: Product })[]>;
  }

  async clearCart(userId: string, peerId: string): Promise<void> {
    await this.cartItemRepo.delete({ userId, peerId });
  }

  async confirmOrder(
    userId: string,
    peerId: string,
    peerName: string | null,
    peerUsername: string | null,
  ): Promise<Order> {
    const cartItems = await this.getCart(userId, peerId);

    if (cartItems.length === 0) {
      throw new NotFoundException('Cart is empty');
    }

    let totalPrice = 0;
    const orderItems: Partial<OrderItem>[] = cartItems.map((ci) => {
      const lineTotal = Number(ci.product.price) * ci.quantity;
      totalPrice += lineTotal;
      return {
        productId: ci.productId,
        productName: ci.product.name,
        price: ci.product.price,
        quantity: ci.quantity,
      };
    });

    const order = this.orderRepo.create({
      userId,
      peerId,
      peerName,
      peerUsername,
      status: OrderStatus.PENDING,
      totalPrice,
      items: orderItems as OrderItem[],
    });

    const saved = await this.orderRepo.save(order);
    await this.clearCart(userId, peerId);

    return this.orderRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ['items'],
    });
  }

  async getOrders(userId: string, peerId?: string): Promise<Order[]> {
    const where: any = { userId };
    if (peerId) where.peerId = peerId;

    return this.orderRepo.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.getOrder(id);
    const previousStatus = order.status;
    order.status = status;

    const saved = await this.orderRepo.save(order);

    // When order is marked as COMPLETED for the first time, decrement product stock
    if (previousStatus !== OrderStatus.COMPLETED && status === OrderStatus.COMPLETED) {
      for (const item of order.items) {
        const product = await this.productRepo.findOne({ where: { id: item.productId } });
        if (!product) continue;
        const nextQty = (product.quantity ?? 0) - item.quantity;
        product.quantity = nextQty < 0 ? 0 : nextQty;
        await this.productRepo.save(product);
      }
    }

    return saved;
  }

  async updateOrderItemQuantity(
    orderId: string,
    itemId: string,
    quantity: number,
  ): Promise<Order> {
    const item = await this.orderItemRepo.findOne({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException(`Order item ${itemId} not found`);

    item.quantity = quantity;
    await this.orderItemRepo.save(item);

    // Recalculate total
    const order = await this.getOrder(orderId);
    order.totalPrice = order.items.reduce(
      (sum, i) => sum + Number(i.price) * i.quantity,
      0,
    );
    return this.orderRepo.save(order);
  }

  async findProductByName(userId: string, name: string): Promise<Product | null> {
    // Exact match first
    let product = await this.productRepo.findOne({
      where: { userId, name },
    });
    if (product) return product;

    // Case-insensitive LIKE
    product = await this.productRepo
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .andWhere('LOWER(p.name) LIKE LOWER(:name)', { name: `%${name}%` })
      .getOne();

    return product;
  }
}
