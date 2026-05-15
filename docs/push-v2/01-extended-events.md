# 01 · Extended Push Events

This document covers all push notification event types beyond basic token registration.

## Event inventory

| Event type | Trigger (BO side) | Deep link |
| --- | --- | --- |
| `order_confirmed` | Merchant confirms order | `khanhstore://orders/:orderId` |
| `order_shipped` | Merchant marks as shipped | `khanhstore://orders/:orderId` |
| `order_delivered` | Merchant marks as delivered | `khanhstore://orders/:orderId` |
| `order_cancelled` | Cancel auto-approved or manually approved | `khanhstore://orders/:orderId` |
| `cancel_status_update` | Cancel request reviewed | `khanhstore://orders/:orderId` |
| `return_status_update` | Return request reviewed or refund issued | `khanhstore://orders/:orderId` |
| `low_stock_alert` | Product in wishlist goes low stock | `khanhstore://products/:slug` |
| `promotion_started` | New promotion relevant to user's past purchases | `khanhstore://` (home) |

## Payload shapes

All payloads follow this envelope:

```ts
interface PushPayload {
  type: string;         // discriminant
  [key: string]: unknown;
}
```

### Order lifecycle

```ts
interface OrderLifecyclePush {
  type: 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled';
  orderId: string;
  orderNumber: string;  // e.g. "0012" — for display without a DB round-trip
}
```

### Cancel/return status

```ts
interface CancelStatusPush {
  type: 'cancel_status_update';
  orderId: string;
  cancelRequestId: string;
  status: 'approved' | 'rejected';
  loyaltyPointsRestored?: number;
}

interface ReturnStatusPush {
  type: 'return_status_update';
  orderId: string;
  returnRequestId: string;
  status: 'items_received' | 'inspected' | 'refund_issued' | 'rejected';
  refundAmount?: number;
  loyaltyPointsRestored?: number;
}
```

### Low stock / promotion (future)

```ts
interface LowStockPush {
  type: 'low_stock_alert';
  productId: string;
  productSlug: string;
  productName: string;
}

interface PromotionPush {
  type: 'promotion_started';
  promotionId: string;
  title: string;
}
```

## Vietnamese notification copy

| Event | Title (vi) | Body (vi) |
| --- | --- | --- |
| `order_confirmed` | Đơn hàng đã xác nhận | Đơn #{{number}} đã được xác nhận. Cảm ơn bạn! |
| `order_shipped` | Đơn hàng đang giao | Đơn #{{number}} đang trên đường giao đến bạn. |
| `order_delivered` | Đơn hàng đã giao | Đơn #{{number}} đã giao thành công. Đánh giá ngay! |
| `cancel_status_update` (approved) | Yêu cầu hủy được chấp nhận | Đơn #{{number}} đã được hủy. |
| `cancel_status_update` (rejected) | Yêu cầu hủy bị từ chối | Yêu cầu hủy đơn #{{number}} không được chấp nhận. |
| `return_status_update` (refund_issued) | Hoàn tiền đã được xử lý | Khoản hoàn tiền cho đơn #{{number}} đã được xử lý. |
| `low_stock_alert` | Sắp hết hàng | {{productName}} trong danh sách yêu thích của bạn sắp hết hàng. |

## NestJS implementation (send side)

NestJS uses the `PushNotificationService` (wraps Expo Push API) to send notifications. The service is called from the relevant service after each status transition:

```ts
// apps/api/src/modules/admin/orders/orders.service.ts
async markShipped(orderId: string, storeId: string, ...) {
  const order = await this.dbService.update(orderId, { status: 'shipped', ... });
  await this.auditService.log(...);
  await this.cacheService.revalidate(...);

  // Send push notification (fire-and-forget — never block the mutation)
  this.pushService
    .send(order.profileId, {
      type: 'order_shipped',
      orderId: order.id,
      orderNumber: String(order.number).padStart(4, '0'),
    }, {
      title: 'Đơn hàng đang giao',
      body: `Đơn #${String(order.number).padStart(4, '0')} đang trên đường giao đến bạn.`,
    })
    .catch((err) => logger.warn({ err, orderId }, 'Push failed'));
}
```

The `.catch()` is critical — a push failure must never cause a 500 on the mutation.
