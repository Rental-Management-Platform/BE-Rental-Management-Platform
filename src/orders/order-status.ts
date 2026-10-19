/** Ba trạng thái của đơn (spec 0004): `CHECK` ở DB cũng chỉ nhận ba giá trị này. `paid` và `cancelled` là trạng thái cuối. */
export const ORDER_STATUSES = ['pending', 'paid', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Một ngày tính bằng mili giây: kỳ gói dài `durationDays` ngày chính xác đến mili giây, không làm tròn theo lịch. */
export const DAY_MS = 24 * 60 * 60 * 1000;
