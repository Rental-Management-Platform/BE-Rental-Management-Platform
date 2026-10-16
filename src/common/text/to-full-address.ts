/** Phần của phường, xã, đặc khu mà địa chỉ đầy đủ cần: tên đơn vị và tên tỉnh hoặc thành phố đi kèm. */
export interface AddressWard {
	readonly name: string;
	readonly provinceName: string;
}

/**
 * Địa chỉ đầy đủ theo đơn vị hành chính hai cấp sau sáp nhập (spec 0002 AC-16): số nhà và đường, phường
 * hoặc xã, tỉnh hoặc thành phố, nối bằng dấu phẩy theo đúng thứ tự đó. Không có quận huyện. Ghép lúc đọc
 * bằng đúng hàm này ở mọi nơi trả địa chỉ, không lưu cột, nên đổi tên phường là mọi địa chỉ đổi theo ngay.
 */
export function toFullAddress(addressText: string, ward: AddressWard): string {
	return [addressText, ward.name, ward.provinceName].join(', ');
}
