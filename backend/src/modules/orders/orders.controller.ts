import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders' })
  getOrders(
    @CurrentUser() user: User,
    @Query('peerId') peerId?: string,
  ) {
    return this.ordersService.getOrders(user.id, peerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order' })
  getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateOrderStatus(id, status);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update order item quantity' })
  updateItemQuantity(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.ordersService.updateOrderItemQuantity(id, itemId, quantity);
  }

  @Get('cart/:peerId')
  @ApiOperation({ summary: 'Get cart for a peer' })
  getCart(
    @CurrentUser() user: User,
    @Param('peerId') peerId: string,
  ) {
    return this.ordersService.getCart(user.id, peerId);
  }
}
