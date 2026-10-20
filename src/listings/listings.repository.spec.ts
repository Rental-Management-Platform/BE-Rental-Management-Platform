import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	ListingsRepository,
	publicListingCondition,
	publicListingFrom,
} from './listings.repository';

const NOW = new Date('2026-10-19T03:00:00.000Z');

/** Chữ SQL với tham số đánh số `$1`, `$2` (kiểu PostgreSQL), gom khoảng trắng để so không phụ thuộc xuống dòng. */
function flat(sql: Prisma.Sql): string {
	return sql.text.replace(/\s+/g, ' ');
}

describe('publicListingCondition (spec 0003 AC-8, AC-9; spec 0004 AC-9)', () => {
	it('giá trị `now` và hạn mức dùng thử đi vào bằng tham số, không nối chuỗi', () => {
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

	it('hạn mức dùng thử chỉ tính khi `trial_ends_at` lớn hơn `now` chặt (đúng lúc bằng là hết), ngược lại 0', () => {
		expect(flat(publicListingCondition(NOW, 2))).toContain(
			'CASE WHEN u.trial_ends_at > $1::timestamptz THEN $2::int ELSE 0 END',
		);
	});

	it('hạn mức hiệu lực là max_listings của kỳ gói đang chạy nếu có, không thì hạn mức dùng thử còn hiệu lực', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain(
			'COALESCE( plan.max_listings, CASE WHEN u.trial_ends_at > $1::timestamptz THEN $2::int ELSE 0 END )',
		);
	});

	it('không còn vế `trial_ends_at` đứng riêng: hết dùng thử mà có gói vẫn qua được', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).not.toMatch(/AND u\.trial_ends_at >/);
	});

	it('hạng của tin: đếm tin visible chưa xóa của cùng chủ trọ có (created_at, id) nhỏ hơn, phải nhỏ hơn hạn mức hiệu lực', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain('WHERE p2.landlord_id = u.id');
		expect(sql).toContain(
			"l2.status = 'visible' AND l2.deleted_at IS NULL",
		);
		expect(sql).toContain('(l2.created_at, l2.id) < (l.created_at, l.id)');
		expect(sql).toContain(') < COALESCE(');
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

describe('publicListingFrom (spec 0004 AC-9)', () => {
	it('nối tin, nhà trọ, chủ trọ rồi kỳ gói đang chạy của chủ trọ (LEFT JOIN LATERAL, không kỳ thì NULL)', () => {
		const sql = flat(publicListingFrom(NOW));
		expect(sql).toContain('FROM listings l');
		expect(sql).toContain('JOIN properties p ON p.id = l.property_id');
		expect(sql).toContain('JOIN users u ON u.id = p.landlord_id');
		expect(sql).toContain('LEFT JOIN LATERAL (');
		expect(sql).toContain(
			'SELECT o.max_listings FROM subscriptions s JOIN orders o ON o.id = s.order_id',
		);
		expect(sql).toContain(') plan ON true');
	});

	it('kỳ đang chạy là khoảng nửa mở chứa `now` (starts_at tính, ends_at không tính), của đúng chủ trọ đó', () => {
		const sql = flat(publicListingFrom(NOW));
		expect(sql).toContain(
			'WHERE s.user_id = u.id AND tstzrange(s.starts_at, s.ends_at) @> $1::timestamptz',
		);
	});

	it('`now` đi vào bằng tham số là chuỗi ISO có Z (cùng lý do múi giờ với điều kiện)', () => {
		const from = publicListingFrom(new Date('2030-01-01T00:00:00.123Z'));
		expect(from.values).toEqual(['2030-01-01T00:00:00.123Z']);
		expect(flat(from)).not.toContain('2030');
	});

	it('ghép với điều kiện: alias `plan` do phép nối cấp là thứ điều kiện đọc `plan.max_listings`', () => {
		expect(flat(publicListingFrom(NOW))).toContain(') plan ON true');
		expect(flat(publicListingCondition(NOW, 2))).toContain(
			'plan.max_listings',
		);
	});
});

describe('ListingsRepository.isPubliclyVisible (spec 0002 AC-8, spec 0004 AC-9)', () => {
	function build(rows: { id: string }[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('dùng đúng hai mảnh SQL công khai (phép nối kỳ gói và điều kiện hiển thị) cùng `now`, giới hạn đúng một tin', async () => {
		const { repository, queryRaw } = build([{ id: 'tin-1' }]);
		await repository.isPubliclyVisible(
			'0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03',
			{
				now: NOW,
				trialListingLimit: 2,
			},
		);
		// `$queryRaw` là thẻ mẫu: đối số đầu là các đoạn chữ tĩnh, các đối số sau là giá trị (mảnh `Prisma.Sql`, id).
		const call = (queryRaw.mock.calls as unknown as unknown[][])[0] ?? [];
		const strings = call[0] as readonly string[];
		const text = strings.join('?').replace(/\s+/g, ' ');
		expect(text).toContain('SELECT l.id');
		expect(text).toContain('WHERE l.id =');
		expect(text).toContain('::uuid');
		expect(text).toContain('LIMIT 1');
		const joined = call
			.slice(1)
			.filter((part): part is Prisma.Sql => typeof part === 'object')
			.map((part) => flat(part))
			.join(' ');
		expect(joined).toContain('LEFT JOIN LATERAL');
		expect(joined).toContain('plan.max_listings');
		expect(joined).toContain("l.status = 'visible'");
	});

	it('có dòng trả về thì true, không có thì false', async () => {
		const visibility = { now: NOW, trialListingLimit: 2 };
		await expect(
			build([{ id: 'a' }]).repository.isPubliclyVisible('x', visibility),
		).resolves.toBe(true);
		await expect(
			build([]).repository.isPubliclyVisible('x', visibility),
		).resolves.toBe(false);
	});
});

describe('ListingsRepository.findEarliestVisibleIds (spec 0003 AC-9, AC-11)', () => {
	it('hỏi N tin visible chưa xóa của chủ trọ, đăng sớm nhất trước, khóa phụ id (cùng thứ tự với luật hạng)', async () => {
		const findMany = jest.fn(() =>
			Promise.resolve([{ id: 'tin-a' }, { id: 'tin-b' }]),
		);
		const repository = new ListingsRepository({
			listing: { findMany },
		} as unknown as PrismaService);
		await expect(
			repository.findEarliestVisibleIds('chu-tro-1', 2),
		).resolves.toEqual(['tin-a', 'tin-b']);
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				status: 'visible',
				deletedAt: null,
				property: { landlordId: 'chu-tro-1' },
			},
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
			take: 2,
			select: { id: true },
		});
	});
});
