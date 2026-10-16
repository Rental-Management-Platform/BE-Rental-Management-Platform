import {
	VIEW_MAX_ENTRIES,
	VIEW_WINDOW_MS,
	ViewDeduplicator,
} from './view-deduplicator';

const T0 = 1_000_000;

describe('ViewDeduplicator (spec 0002 AC-13)', () => {
	it('lượt đầu của một cặp thì đếm, tải lại trong 30 phút thì không', () => {
		const dedup = new ViewDeduplicator();
		expect(dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0)).toBe(true);
		expect(dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0 + 1)).toBe(false);
		expect(
			dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0 + VIEW_WINDOW_MS - 1),
		).toBe(false);
	});

	it('hết 30 phút thì đếm lại, và cửa sổ mới tính từ lượt đó', () => {
		const dedup = new ViewDeduplicator();
		dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0);
		expect(
			dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0 + VIEW_WINDOW_MS),
		).toBe(true);
		expect(
			dedup.shouldCount('ip:1.2.3.4', 'tin-1', T0 + VIEW_WINDOW_MS + 5),
		).toBe(false);
	});

	it('người xem khác hoặc tin khác thì đếm riêng', () => {
		const dedup = new ViewDeduplicator();
		expect(dedup.shouldCount('ip:1.1.1.1', 'tin-1', T0)).toBe(true);
		expect(dedup.shouldCount('ip:2.2.2.2', 'tin-1', T0)).toBe(true);
		expect(dedup.shouldCount('user:u-1', 'tin-1', T0)).toBe(true);
		expect(dedup.shouldCount('ip:1.1.1.1', 'tin-2', T0)).toBe(true);
	});

	it('đã đăng nhập và là khách cùng IP là hai người xem khác nhau', () => {
		const dedup = new ViewDeduplicator();
		expect(dedup.shouldCount('ip:1.1.1.1', 'tin-1', T0)).toBe(true);
		expect(dedup.shouldCount('user:u-1', 'tin-1', T0)).toBe(true);
	});

	describe('dọn dòng', () => {
		it('sweep bỏ dòng hết hạn và giữ dòng còn hạn', () => {
			const dedup = new ViewDeduplicator();
			dedup.shouldCount('ip:a', 'tin-1', T0);
			dedup.shouldCount('ip:b', 'tin-1', T0 + 10 * 60 * 1000);
			expect(dedup.size).toBe(2);
			dedup.sweep(T0 + VIEW_WINDOW_MS);
			expect(dedup.size).toBe(1);
			expect(
				dedup.shouldCount('ip:b', 'tin-1', T0 + VIEW_WINDOW_MS),
			).toBe(false);
		});

		it('đủ 100000 dòng còn hạn thì lượt kế tiếp xóa sạch rồi đếm (chấp nhận cộng dư)', () => {
			const dedup = new ViewDeduplicator();
			for (let i = 0; i < VIEW_MAX_ENTRIES; i += 1) {
				dedup.shouldCount(`ip:${i}`, 'tin-1', T0);
			}
			expect(dedup.size).toBe(VIEW_MAX_ENTRIES);
			expect(dedup.shouldCount('ip:moi', 'tin-1', T0)).toBe(true);
			expect(dedup.size).toBe(1);
			expect(dedup.shouldCount('ip:0', 'tin-1', T0)).toBe(true);
		});
	});

	describe('vòng đời', () => {
		beforeEach(() => jest.useFakeTimers());
		afterEach(() => jest.useRealTimers());

		it('dọn mỗi phút sau onModuleInit và dừng ở onModuleDestroy', () => {
			const dedup = new ViewDeduplicator();
			const now = Date.now();
			dedup.shouldCount('ip:a', 'tin-1', now - VIEW_WINDOW_MS - 1);
			expect(dedup.size).toBe(1);

			dedup.onModuleInit();
			jest.advanceTimersByTime(60_000);
			expect(dedup.size).toBe(0);

			dedup.shouldCount('ip:b', 'tin-1', Date.now() - VIEW_WINDOW_MS - 1);
			dedup.onModuleDestroy();
			jest.advanceTimersByTime(5 * 60_000);
			expect(dedup.size).toBe(1);
		});

		it('timer không giữ tiến trình sống (unref)', () => {
			const dedup = new ViewDeduplicator();
			const unref = jest.spyOn(
				global,
				'setInterval',
			) as unknown as jest.SpyInstance<NodeJS.Timeout>;
			dedup.onModuleInit();
			const timer = unref.mock.results[0]?.value as NodeJS.Timeout;
			expect(timer.hasRef()).toBe(false);
			dedup.onModuleDestroy();
			unref.mockRestore();
		});
	});
});
