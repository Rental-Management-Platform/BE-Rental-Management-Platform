/** Một gói trên bảng giá công khai (spec 0004 AC-1): chỉ những gì người mua cần thấy. */
export interface PlanResponse {
	readonly id: string;
	readonly name: string;
	/** Đồng Việt Nam. */
	readonly price: number;
	/** Số tin được hiện cùng lúc khi gói đang chạy. */
	readonly maxListings: number;
	readonly durationDays: number;
}

/** Một gói cho admin (spec 0004 AC-2): như bảng giá, cộng cờ bán và mốc thời gian. Cũng là kết quả của tạo và sửa. */
export interface AdminPlanResponse extends PlanResponse {
	readonly isActive: boolean;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
