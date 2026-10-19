import type { Prisma } from '../generated/prisma/client';
import { publicListingCondition } from './listings.repository';

const NOW = new Date('2026-10-19T03:00:00.000Z');

/** Chữ SQL với tham số đánh số `$1`, `$2` (kiểu PostgreSQL), gom khoảng trắng để so không phụ thuộc xuống dòng. */
function flat(sql: Prisma.Sql): string {
	return sql.text.replace(/\s+/g, ' ');
}

describe('publicListingCondition (spec 0003 AC-8, AC-9)', () => {
	it('giá trị `now` và hạn mức đi vào bằng tham số, không nối chuỗi', () => {
		const condition = publicListingCondition(NOW, 2);
		expect(condition.values).toEqual([NOW.toISOString(), 2]);
		expect(flat(condition)).not.toContain('2026');
	});

	it('`now` là chuỗi ISO có Z (không phải Date) để phép ép timestamptz không phụ thuộc múi giờ của phiên', () => {
		const [now] = publicListingCondition(
			new Date('2030-01-01T00:00:00.123Z'),
			2,
		).values;
		expect(now).toBe('2030-01-01T00:00:00.123Z');
	});

	it('so `trial_ends_at` chặt với `now` (đúng lúc bằng là hết) và ép kiểu timestamptz', () => {
		expect(flat(publicListingCondition(NOW, 2))).toContain(
			'u.trial_ends_at > $1::timestamptz',
		);
	});

	it('hạng của tin: đếm tin visible chưa xóa của cùng chủ trọ có (created_at, id) nhỏ hơn, phải nhỏ hơn hạn mức', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain('WHERE p2.landlord_id = u.id');
		expect(sql).toContain(
			"l2.status = 'visible' AND l2.deleted_at IS NULL",
		);
		expect(sql).toContain('(l2.created_at, l2.id) < (l.created_at, l.id)');
		expect(sql).toContain(') < $2');
	});

	it('giữ các vế hiển thị của spec 0002: tin visible, nhà trọ và chủ trọ chưa xóa, chủ trọ active', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain("l.status = 'visible' AND l.deleted_at IS NULL");
		expect(sql).toContain('p.deleted_at IS NULL');
		expect(sql).toContain("u.status = 'active' AND u.deleted_at IS NULL");
	});

	it('bọc trong ngoặc để ghép bằng AND với bộ lọc dù sau này có OR', () => {
		const sql = flat(publicListingCondition(NOW, 2)).trim();
		expect(sql.startsWith('(')).toBe(true);
		expect(sql.endsWith(')')).toBe(true);
	});
});
