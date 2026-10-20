import {
	imageRow,
	ownerDetailRow,
	ownerSummaryRow,
	publicDetailRow,
	publicSummaryRow,
	LANDLORD_ID,
	WARD,
} from './listings.fixtures';
import {
	toListingDetail,
	toListingImage,
	toListingSummary,
	toModerationItem,
	toOwnerDetail,
	toOwnerSummary,
	toPublicSummary,
} from './listings.mapper';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('toListingSummary (spec 0002, "Tin tóm tắt")', () => {
	it('trả đúng các trường, không lộ số điện thoại, trạng thái hay lượt xem', () => {
		const summary = toListingSummary(publicSummaryRow());
		expect(Object.keys(summary).sort()).toEqual([
			'addressText',
			'areaM2',
			'availableFrom',
			'code',
			'coverImageUrl',
			'createdAt',
			'deposit',
			'fullAddress',
			'id',
			'landlord',
			'price',
			'slug',
			'title',
			'ward',
		]);
		expect(summary.landlord).toEqual({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			name: 'Anh Nam',
		});
	});

	it('fullAddress hai cấp, không có quận huyện, và ward chỉ gồm code và name (AC-16)', () => {
		const summary = toListingSummary(publicSummaryRow());
		expect(summary.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
		expect(summary.fullAddress).not.toMatch(/quận|huyện/i);
		expect(summary.addressText).toBe('12 Lê Lợi');
		expect(summary.ward).toEqual({
			code: '26743',
			name: 'Phường Bến Thành',
		});
	});

	it('fullAddress theo tên phường hiện tại (ghép lúc đọc)', () => {
		const base = publicSummaryRow();
		const summary = toListingSummary({
			...base,
			property: {
				...base.property,
				ward: { ...WARD, name: 'Phường Sài Gòn' },
			},
		});
		expect(summary.fullAddress).toBe(
			'12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh',
		);
	});

	it('slug tính lúc đọc từ tiêu đề, bỏ dấu', () => {
		expect(toListingSummary(publicSummaryRow()).slug).toBe(
			'phong-dep-co-gac-gan-cho-ben-thanh',
		);
	});

	it('availableFrom là chuỗi YYYY-MM-DD theo UTC, không lệch ngày', () => {
		const base = publicSummaryRow();
		expect(
			toListingSummary({
				...base,
				availableFrom: new Date('2026-11-01T00:00:00.000Z'),
			}).availableFrom,
		).toBe('2026-11-01');
		expect(
			toListingSummary({ ...base, availableFrom: null }).availableFrom,
		).toBeNull();
	});

	describe('ảnh bìa', () => {
		it('toListingImage dựng { id, position, url } từ storage_key (kết quả tải ảnh lên)', () => {
			expect(
				toListingImage({
					id: 'anh-1',
					position: 2,
					storageKey: `public/${UUID_A}.png`,
				}),
			).toEqual({
				id: 'anh-1',
				position: 2,
				url: `/api/v1/media/public/${UUID_A}.png`,
			});
		});

		it('chưa có ảnh thì coverImageUrl là null', () => {
			expect(
				toListingSummary(publicSummaryRow()).coverImageUrl,
			).toBeNull();
		});

		it('là ảnh đầu tiên (Repository đã sắp theo position), dạng đường dẫn tương đối', () => {
			const summary = toListingSummary(
				publicSummaryRow({ images: [imageRow(0, UUID_A, 'webp')] }),
			);
			expect(summary.coverImageUrl).toBe(
				`/api/v1/media/public/${UUID_A}.webp`,
			);
		});
	});

	describe('giá trị trống trả null, không bao giờ chuỗi rỗng', () => {
		it.each([
			['tên chủ trọ rỗng', ''],
			['tên chủ trọ chỉ khoảng trắng', '   '],
			['tên chủ trọ null', null],
		])('%s', (_name, name) => {
			const base = publicSummaryRow();
			const summary = toListingSummary({
				...base,
				property: {
					...base.property,
					landlord: { ...base.property.landlord, name },
				},
			});
			expect(summary.landlord.name).toBeNull();
		});

		it('deposit null giữ null', () => {
			expect(
				toListingSummary({ ...publicSummaryRow(), deposit: null })
					.deposit,
			).toBeNull();
		});
	});
});

describe('toListingDetail (spec 0002 AC-11, AC-12)', () => {
	const row = () => publicDetailRow();

	it('khách thấy phone là null, người đăng nhập thấy số', () => {
		expect(
			toListingDetail(row(), {
				viewCount: 7,
				includePhone: false,
				isFavorite: null,
			}).landlord.phone,
		).toBeNull();
		expect(
			toListingDetail(row(), {
				viewCount: 7,
				includePhone: true,
				isFavorite: null,
			}).landlord.phone,
		).toBe('0912345678');
	});

	it('số điện thoại rỗng của chủ trọ vẫn trả null khi đã đăng nhập', () => {
		const base = row();
		const detail = toListingDetail(
			{
				...base,
				property: {
					...base.property,
					landlord: { ...base.property.landlord, phone: '' },
				},
			},
			{ viewCount: 0, includePhone: true, isFavorite: null },
		);
		expect(detail.landlord.phone).toBeNull();
	});

	it('số điện thoại không lọt vào bất cứ chỗ nào khác của phản hồi cho khách', () => {
		const text = JSON.stringify(
			toListingDetail(row(), {
				viewCount: 7,
				includePhone: false,
				isFavorite: null,
			}),
		);
		expect(text).not.toContain('0912345678');
	});

	it('viewCount lấy từ giá trị truyền vào (sau khi cộng), không phải giá trị cũ của dòng', () => {
		expect(
			toListingDetail(row(), {
				viewCount: 8,
				includePhone: false,
				isFavorite: null,
			}).viewCount,
		).toBe(8);
	});

	it('có mô tả, ảnh theo position, nhà trọ kèm tọa độ, phí và tiện ích', () => {
		const base = publicDetailRow({
			images: [imageRow(0, UUID_A), imageRow(1, UUID_B, 'png')],
		});
		const detail = toListingDetail(base, {
			viewCount: 7,
			includePhone: false,
			isFavorite: null,
		});
		expect(detail.description).toContain('Phòng sạch sẽ');
		expect(detail.images).toEqual([
			{
				id: 'image-0',
				position: 0,
				url: `/api/v1/media/public/${UUID_A}.jpg`,
			},
			{
				id: 'image-1',
				position: 1,
				url: `/api/v1/media/public/${UUID_B}.png`,
			},
		]);
		expect(detail.property).toMatchObject({
			name: 'Nhà trọ Hoa Hồng',
			addressText: '12 Lê Lợi',
			fullAddress: '12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
			latitude: 10.7721,
			longitude: 106.6983,
			fees: [],
			amenities: [],
		});
		expect(detail.property.ward).toEqual({
			code: '26743',
			name: 'Phường Bến Thành',
			provinceCode: '79',
			provinceName: 'Thành phố Hồ Chí Minh',
		});
		expect(detail.coverImageUrl).toBe(`/api/v1/media/public/${UUID_A}.jpg`);
	});

	it('không lộ cột nội bộ (searchKey, deletedAt, status, propertyId, landlordId)', () => {
		const text = JSON.stringify(
			toListingDetail(row(), {
				viewCount: 7,
				includePhone: true,
				isFavorite: null,
			}),
		);
		for (const secret of [
			'searchKey',
			'deletedAt',
			'landlordId',
			'propertyId',
			'"status"',
		]) {
			expect(text).not.toContain(secret);
		}
	});
});

describe('toOwnerSummary và toOwnerDetail (spec 0002 AC-14)', () => {
	it('dòng danh sách có status, moderationReason, viewCount và isPublic, không có landlord', () => {
		const summary = toOwnerSummary(ownerSummaryRow(), null, true);
		expect(summary).toMatchObject({
			status: 'visible',
			moderationReason: null,
			viewCount: 7,
			isPublic: true,
		});
		expect(summary).not.toHaveProperty('landlord');
		expect(summary.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
	});

	it('moderationReason chỉ có giá trị khi tin đang hidden_by_admin', () => {
		const hiddenByAdmin = ownerSummaryRow({ status: 'hidden_by_admin' });
		expect(
			toOwnerSummary(hiddenByAdmin, 'Nội dung sai sự thật', false)
				.moderationReason,
		).toBe('Nội dung sai sự thật');
		for (const status of ['visible', 'hidden_by_owner']) {
			expect(
				toOwnerSummary(ownerSummaryRow({ status }), 'lý do cũ', false)
					.moderationReason,
			).toBeNull();
		}
	});

	it('chi tiết của chủ trọ không có landlord, có status, moderationReason, viewCount và isPublic', () => {
		const detail = toOwnerDetail(
			ownerDetailRow({ status: 'hidden_by_admin', viewCount: 12 }),
			'Ảnh không đúng thực tế',
			false,
		);
		expect(detail).not.toHaveProperty('landlord');
		expect(detail).toMatchObject({
			status: 'hidden_by_admin',
			moderationReason: 'Ảnh không đúng thực tế',
			viewCount: 12,
			isPublic: false,
		});
		expect(detail.property.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
	});

	it('hidden_by_owner thì không có lý do dù có lý do cũ trong lịch sử', () => {
		expect(
			toOwnerDetail(
				ownerDetailRow({ status: 'hidden_by_owner' }),
				'lý do cũ',
				false,
			).moderationReason,
		).toBeNull();
	});

	it('isPublic đi nguyên từ nơi gọi, không tự suy ra từ status (hạn mức do Service tính)', () => {
		const row = ownerDetailRow({ status: 'visible' });
		expect(toOwnerDetail(row, null, true).isPublic).toBe(true);
		expect(toOwnerDetail(row, null, false).isPublic).toBe(false);
		const summary = ownerSummaryRow({ status: 'visible' });
		expect(toOwnerSummary(summary, null, true).isPublic).toBe(true);
		expect(toOwnerSummary(summary, null, false).isPublic).toBe(false);
	});

	it('tin công khai không có trường isPublic', () => {
		expect(toListingSummary(publicSummaryRow())).not.toHaveProperty(
			'isPublic',
		);
		expect(
			toListingDetail(publicDetailRow(), {
				viewCount: 1,
				includePhone: false,
				isFavorite: null,
			}),
		).not.toHaveProperty('isPublic');
	});
});

describe('toModerationItem (spec 0002 AC-9, "Mục kiểm duyệt")', () => {
	it('là tin tóm tắt có chủ trọ (không điện thoại) cộng status, moderationReason và viewCount', () => {
		const item = toModerationItem(
			publicSummaryRow({ status: 'hidden_by_admin', viewCount: 12 }),
			'Ảnh không thật',
		);
		expect(item).toMatchObject({
			status: 'hidden_by_admin',
			moderationReason: 'Ảnh không thật',
			viewCount: 12,
			landlord: { id: LANDLORD_ID, name: 'Anh Nam' },
			fullAddress: '12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		});
		expect(item.landlord).not.toHaveProperty('phone');
		expect(item).not.toHaveProperty('isPublic');
	});

	it('lý do chỉ có khi tin đang hidden_by_admin, kể cả khi người gọi lỡ truyền một lý do cũ', () => {
		for (const status of ['visible', 'hidden_by_owner']) {
			expect(
				toModerationItem(publicSummaryRow({ status }), 'Lý do cũ')
					.moderationReason,
			).toBeNull();
		}
	});
});

describe('toPublicSummary và isFavorite của chi tiết (spec 0006 AC-6)', () => {
	it.each([[null], [true], [false]])(
		'toPublicSummary: tin tóm tắt cộng isFavorite %j, các trường khác y nguyên',
		(isFavorite) => {
			const row = publicSummaryRow();
			expect(toPublicSummary(row, isFavorite)).toEqual({
				...toListingSummary(row),
				isFavorite,
			});
		},
	);

	it.each([[null], [true], [false]])(
		'toListingDetail: isFavorite %j đi qua nguyên vẹn',
		(isFavorite) => {
			expect(
				toListingDetail(publicDetailRow(), {
					viewCount: 7,
					includePhone: false,
					isFavorite,
				}).isFavorite,
			).toBe(isFavorite);
		},
	);

	it('chi tiết của chủ trọ không có isFavorite', () => {
		expect(
			Object.keys(toOwnerDetail(ownerDetailRow(), null, true)),
		).not.toContain('isFavorite');
		expect(
			Object.keys(toOwnerSummary(ownerSummaryRow(), null, true)),
		).not.toContain('isFavorite');
	});

	it('mục kiểm duyệt của admin không có isFavorite', () => {
		expect(
			Object.keys(toModerationItem(publicSummaryRow(), null)),
		).not.toContain('isFavorite');
	});
});
