import { registerDecorator, ValidateIf } from 'class-validator';
import type { ValidationArguments } from 'class-validator';

const LIMITS = { latitude: 90, longitude: 180 } as const;
const PARTNER = { latitude: 'longitude', longitude: 'latitude' } as const;
const MESSAGES = {
	latitude:
		'Vĩ độ phải là số từ -90 đến 90 và phải gửi cùng kinh độ (hoặc để cả hai là null để xóa tọa độ).',
	longitude:
		'Kinh độ phải là số từ -180 đến 180 và phải gửi cùng vĩ độ (hoặc để cả hai là null để xóa tọa độ).',
} as const;

type CoordinateName = keyof typeof LIMITS;

function isWithin(value: unknown, limit: number): boolean {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Math.abs(value) <= limit
	);
}

function isSent(object: Record<string, unknown>): boolean {
	return (
		object['latitude'] !== undefined || object['longitude'] !== undefined
	);
}

/**
 * Cặp tọa độ của nhà trọ (spec 0002, "Phí và tọa độ nhà trọ"): gửi cả hai là số trong biên, hoặc cả hai
 * là `null` (xóa tọa độ ở PATCH). Gửi chỉ một trong hai, hoặc một số một `null`, là sai ở cả hai trường.
 * Không gửi trường nào thì bỏ qua. Đặt trên cả `latitude` và `longitude`, mỗi nơi kiểm cặp của mình.
 */
export function IsCoordinate(name: CoordinateName): PropertyDecorator {
	return (target, propertyKey) => {
		ValidateIf(isSent)(target, propertyKey);
		registerDecorator({
			name: 'isCoordinate',
			target: target.constructor,
			propertyName: String(propertyKey),
			validator: {
				validate(value: unknown, args: ValidationArguments): boolean {
					const object = args.object as Record<string, unknown>;
					const partner = object[PARTNER[name]];
					if (value === null) return partner === null;
					return (
						isWithin(value, LIMITS[name]) &&
						isWithin(partner, LIMITS[PARTNER[name]])
					);
				},
				defaultMessage(): string {
					return MESSAGES[name];
				},
			},
		});
	};
}
