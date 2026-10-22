import type { FeeKind, FeeUnit } from '../../properties/property-fee';

/**
 * Nội dung tĩnh của bộ dữ liệu demo (`npm run seed:demo`). Chỉ là dữ liệu mô tả, không chạm cơ sở dữ liệu:
 * `demo-build.ts` đổi nó thành các dòng bảng theo thời điểm chạy. Mọi mốc thời gian là "số ngày trước hôm
 * nay" nên dữ liệu luôn mới, và các kịch bản (còn dùng thử, hết dùng thử, gói hết hạn, vượt hạn mức, bị
 * khóa) đúng vào lúc chạy, không phụ thuộc ngày nào.
 *
 * Số điện thoại và email là giả: email nằm dưới tên miền dành riêng `example.com` nên không có thư thật nào
 * gửi đi; số điện thoại đúng dạng (`^0(3|5|7|8|9)\d{8}$`) nhưng chỉ là chuỗi mẫu.
 */

/** Mọi tài khoản demo có email kết thúc bằng tên miền này; lệnh `--reset` chỉ xóa đúng các tài khoản đó. */
export const DEMO_EMAIL_DOMAIN = 'demo.example.com';

/** Số ngày dùng thử lúc các chủ trọ demo "đăng ký" (bằng mặc định của `trial_days`). */
export const DEMO_TRIAL_DAYS = 30;

export type DemoPlanName = 'Cơ bản' | 'Nâng cao' | 'Chuyên nghiệp';

export interface DemoOrder {
	readonly plan: DemoPlanName;
	readonly status: 'paid' | 'pending' | 'cancelled';
	/** Số ngày trước hôm nay: lúc thanh toán (`paid`) hoặc lúc tạo đơn (`pending`, `cancelled`). */
	readonly daysAgo: number;
}

export interface DemoLock {
	readonly daysAgo: number;
	readonly reason: string;
}

export interface DemoLandlord {
	readonly key: string;
	readonly name: string;
	/** Phần trước dấu `@` của email. */
	readonly emailName: string;
	readonly phone: string;
	readonly registeredDaysAgo: number;
	/** Cảnh mà tài khoản này dựng, hiện ở bảng tóm tắt cuối lệnh seed và ở tài liệu FE. */
	readonly scenario: string;
	readonly lock?: DemoLock;
	readonly orders: readonly DemoOrder[];
}

export interface DemoTenant {
	readonly key: string;
	readonly name: string;
	readonly emailName: string;
	readonly phone?: string;
	readonly registeredDaysAgo: number;
	readonly scenario: string;
	/** Số tin được lưu yêu thích, chọn ngẫu nhiên có hạt giống (tin không hiện công khai cũng có thể nằm trong đó). */
	readonly favorites: number;
	/**
	 * Khóa các nhà trọ mà người này chắc chắn lưu một tin (tính trong `favorites`), để có sẵn cảnh "tin đã lưu nay
	 * không còn công khai" (chủ trọ hết dùng thử, gói hết hạn hay bị khóa) cho màn hình danh sách đã lưu.
	 */
	readonly savedFrom?: readonly string[];
	/** Khóa của các chủ trọ mà người này theo dõi. */
	readonly follows: readonly string[];
	readonly lock?: DemoLock;
}

export interface DemoFee {
	readonly kind: FeeKind;
	readonly price: number;
	readonly unit: FeeUnit;
	readonly note?: string;
}

export interface DemoProperty {
	readonly key: string;
	readonly landlord: string;
	readonly name: string;
	readonly addressText: string;
	readonly wardCode: string;
	readonly latitude: number;
	readonly longitude: number;
	/** Số ngày trước hôm nay nhà trọ được tạo. */
	readonly ageDays: number;
	readonly amenities: readonly string[];
	readonly fees: readonly DemoFee[];
	/** Một câu về vị trí, nối vào cuối mô tả của mọi tin thuộc nhà trọ. */
	readonly nearby: string;
}

export interface DemoListing {
	readonly property: string;
	readonly title: string;
	/** Đoạn mô tả riêng của tin; `demo-build.ts` nối thêm tiện ích, chi phí và vị trí từ nhà trọ. */
	readonly about: string;
	readonly price: number;
	readonly areaM2: number;
	readonly deposit: number | null;
	/** Số ngày từ hôm nay đến ngày vào ở (âm là đã trống từ trước); `null` là không ghi. */
	readonly availableInDays: number | null;
	/** Số ngày trước hôm nay tin được đăng. Thứ tự đăng quyết định tin nào nằm trong hạn mức. */
	readonly ageDays: number;
	readonly status: 'visible' | 'hidden_by_owner' | 'hidden_by_admin';
	/** Lý do admin ẩn và số ngày trước đó; chỉ có với `hidden_by_admin`. */
	readonly hiddenReason?: string;
	readonly hiddenDaysAgo?: number;
	/** Số ảnh (0 đến 5); không ghi thì 3 đến 5 ngẫu nhiên có hạt giống. */
	readonly images?: number;
	readonly look: 'room' | 'loft';
}

const kwh = (price: number, note?: string): DemoFee => ({
	kind: 'electricity',
	price,
	unit: 'per_kwh',
	note,
});
const waterM3 = (price: number): DemoFee => ({
	kind: 'water',
	price,
	unit: 'per_m3',
});
const waterPerson = (price: number): DemoFee => ({
	kind: 'water',
	price,
	unit: 'per_person_month',
});
const internet = (price: number, note?: string): DemoFee => ({
	kind: 'internet',
	price,
	unit: 'per_month',
	note,
});
const parking = (price: number, note?: string): DemoFee => ({
	kind: 'parking',
	price,
	unit: 'per_vehicle_month',
	note,
});
const service = (price: number, note: string): DemoFee => ({
	kind: 'service',
	price,
	unit: 'per_month',
	note,
});

export const DEMO_LANDLORDS: readonly DemoLandlord[] = [
	{
		key: 'khoa',
		name: 'Trần Minh Khoa',
		emailName: 'khoa.tran',
		phone: '0901234501',
		registeredDaysAgo: 205,
		scenario:
			'Gói Chuyên nghiệp đang chạy (50 tin) và đã gia hạn trước một kỳ nối tiếp; 3 nhà trọ, 16 tin hiện và 1 tin tự ẩn; nhiều người theo dõi, lịch sử 7 đơn đã trả',
		orders: [
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 170 },
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 140 },
			{ plan: 'Nâng cao', status: 'paid', daysAgo: 110 },
			{ plan: 'Nâng cao', status: 'paid', daysAgo: 80 },
			{ plan: 'Chuyên nghiệp', status: 'paid', daysAgo: 50 },
			{ plan: 'Chuyên nghiệp', status: 'paid', daysAgo: 20 },
			{ plan: 'Chuyên nghiệp', status: 'paid', daysAgo: 3 },
		],
	},
	{
		key: 'nhung',
		name: 'Lê Thị Hồng Nhung',
		emailName: 'nhung.le',
		phone: '0912345602',
		registeredDaysAgo: 130,
		scenario:
			'Gói Nâng cao đang chạy (15 tin); 3 nhà trọ, 10 tin hiện, 1 tin bị admin ẩn kèm lý do, 1 tin tự ẩn',
		orders: [
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 66 },
			{ plan: 'Nâng cao', status: 'paid', daysAgo: 35 },
			{ plan: 'Nâng cao', status: 'paid', daysAgo: 6 },
		],
	},
	{
		key: 'bao',
		name: 'Phạm Quốc Bảo',
		emailName: 'bao.pham',
		phone: '0933456703',
		registeredDaysAgo: 80,
		scenario:
			'Gói Cơ bản (5 tin) nhưng có 7 tin hiện: 2 tin đăng sau cùng vượt hạn mức nên không hiện công khai (isPublic false), có một tin không ảnh',
		orders: [
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 45 },
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 14 },
		],
	},
	{
		key: 'phat',
		name: 'Nguyễn Hữu Phát',
		emailName: 'phat.nguyen',
		phone: '0944567804',
		registeredDaysAgo: 50,
		scenario:
			'Gói Cơ bản vừa mua, còn nhiều chỗ (4 tin hiện trên hạn mức 5); có một tin chỉ một ảnh',
		orders: [{ plan: 'Cơ bản', status: 'paid', daysAgo: 18 }],
	},
	{
		key: 'tam',
		name: 'Võ Thanh Tâm',
		emailName: 'tam.vo',
		phone: '0965678905',
		registeredDaysAgo: 27,
		scenario:
			'Đang dùng thử, còn 3 ngày (hạn mức 2 tin); có đơn đang chờ thanh toán và một đơn đã hủy; 1 tin tự ẩn vì hết chỗ',
		orders: [
			{ plan: 'Nâng cao', status: 'pending', daysAgo: 1 },
			{ plan: 'Cơ bản', status: 'cancelled', daysAgo: 6 },
		],
	},
	{
		key: 'mai',
		name: 'Đặng Thị Mai',
		emailName: 'mai.dang',
		phone: '0976789006',
		registeredDaysAgo: 55,
		scenario:
			'Hết dùng thử 25 ngày trước và chưa mua gói: 3 tin vẫn "hiện" nhưng không ai thấy, đăng thêm bị 403 MEMBERSHIP_REQUIRED; có đơn đang chờ thanh toán',
		orders: [{ plan: 'Cơ bản', status: 'pending', daysAgo: 2 }],
	},
	{
		key: 'huy',
		name: 'Hoàng Gia Huy',
		emailName: 'huy.hoang',
		phone: '0987890107',
		registeredDaysAgo: 140,
		scenario:
			'Từng mua hai gói, kỳ gói cuối đã hết 22 ngày trước nên 4 tin biến khỏi công khai; có một đơn đã hủy',
		orders: [
			{ plan: 'Cơ bản', status: 'paid', daysAgo: 85 },
			{ plan: 'Nâng cao', status: 'paid', daysAgo: 52 },
			{ plan: 'Cơ bản', status: 'cancelled', daysAgo: 12 },
		],
	},
	{
		key: 'lan',
		name: 'Bùi Ngọc Lan',
		emailName: 'lan.bui',
		phone: '0398901208',
		registeredDaysAgo: 95,
		scenario:
			'Gói Nâng cao còn hạn nhưng tài khoản bị admin khóa 6 ngày trước: đăng nhập bị 403, tin và hồ sơ biến khỏi công khai',
		lock: {
			daysAgo: 6,
			reason: 'Nhiều người tìm trọ phản ánh ảnh và giá trong tin không đúng thực tế.',
		},
		orders: [{ plan: 'Nâng cao', status: 'paid', daysAgo: 15 }],
	},
	{
		key: 'ha',
		name: 'Ngô Thị Thu Hà',
		emailName: 'ha.ngo',
		phone: '0359012309',
		registeredDaysAgo: 2,
		scenario:
			'Vừa đăng ký 2 ngày trước: còn 28 ngày dùng thử, chưa có nhà trọ hay tin nào (màn hình trống để làm giao diện "bắt đầu")',
		orders: [],
	},
];

export const DEMO_TENANTS: readonly DemoTenant[] = [
	{
		key: 'lananh',
		name: 'Nguyễn Thị Lan Anh',
		emailName: 'lananh.nguyen',
		phone: '0869123401',
		registeredDaysAgo: 120,
		scenario:
			'Sinh viên tìm trọ: lưu 12 tin (một phần nay không còn công khai), theo dõi 3 chủ trọ; tài khoản nên dùng để thử nhiều nhất',
		favorites: 12,
		savedFrom: ['mai-lai-thieu', 'huy-vung-tau', 'lan-phu-nhuan'],
		follows: ['khoa', 'nhung', 'bao'],
	},
	{
		key: 'viet',
		name: 'Trần Quốc Việt',
		emailName: 'viet.tran',
		phone: '0869123402',
		registeredDaysAgo: 95,
		scenario: 'Nhân viên văn phòng: lưu 6 tin, theo dõi 2 chủ trọ',
		favorites: 6,
		follows: ['khoa', 'nhung'],
	},
	{
		key: 'yen',
		name: 'Lê Hoàng Yến',
		emailName: 'yen.le',
		registeredDaysAgo: 80,
		scenario: 'Lưu 5 tin, theo dõi 2 chủ trọ',
		favorites: 5,
		follows: ['nhung', 'phat'],
	},
	{
		key: 'thinh',
		name: 'Phạm Đức Thịnh',
		emailName: 'thinh.pham',
		phone: '0869123404',
		registeredDaysAgo: 70,
		scenario: 'Lưu 4 tin, theo dõi 1 chủ trọ',
		favorites: 4,
		follows: ['khoa'],
	},
	{
		key: 'diep',
		name: 'Võ Ngọc Diệp',
		emailName: 'diep.vo',
		registeredDaysAgo: 60,
		scenario: 'Lưu 7 tin, theo dõi 2 chủ trọ',
		favorites: 7,
		follows: ['khoa', 'tam'],
	},
	{
		key: 'quan',
		name: 'Đặng Minh Quân',
		emailName: 'quan.dang',
		phone: '0869123406',
		registeredDaysAgo: 45,
		scenario: 'Lưu 3 tin, theo dõi 2 chủ trọ',
		favorites: 3,
		follows: ['bao', 'khoa'],
	},
	{
		key: 'truc',
		name: 'Huỳnh Thanh Trúc',
		emailName: 'truc.huynh',
		registeredDaysAgo: 30,
		scenario:
			'Lưu 5 tin, theo dõi 3 chủ trọ (trong đó có chủ trọ đang bị khóa)',
		favorites: 5,
		follows: ['nhung', 'khoa', 'lan'],
	},
	{
		key: 'tuan',
		name: 'Bùi Anh Tuấn',
		emailName: 'tuan.bui',
		phone: '0869123408',
		registeredDaysAgo: 20,
		scenario: 'Lưu 2 tin, theo dõi 1 chủ trọ',
		favorites: 2,
		follows: ['phat'],
	},
	{
		key: 'linh',
		name: 'Ngô Khánh Linh',
		emailName: 'linh.ngo',
		registeredDaysAgo: 3,
		scenario:
			'Mới đăng ký 3 ngày: chưa lưu tin nào, chưa theo dõi ai (màn hình trống)',
		favorites: 0,
		follows: [],
	},
	{
		key: 'son',
		name: 'Dương Văn Sơn',
		emailName: 'son.duong',
		registeredDaysAgo: 40,
		scenario: 'Người tìm trọ bị admin khóa 8 ngày trước: đăng nhập bị 403',
		favorites: 1,
		follows: [],
		lock: {
			daysAgo: 8,
			reason: 'Gửi tin nhắn quấy rối nhiều chủ trọ.',
		},
	},
];

export const DEMO_PROPERTIES: readonly DemoProperty[] = [
	{
		key: 'khoa-quang-trung',
		landlord: 'khoa',
		name: 'Dãy trọ Minh Khoa',
		addressText: '128/5 Quang Trung',
		wardCode: '26890',
		latitude: 10.8213,
		longitude: 106.6862,
		ageDays: 190,
		amenities: [
			'wifi',
			'water_heater',
			'parking',
			'security_camera',
			'free_hours',
		],
		fees: [
			kwh(3500, 'Theo công tơ riêng của phòng'),
			waterPerson(100000),
			internet(80000),
			parking(100000),
			service(30000, 'Phí rác và vệ sinh khu chung'),
		],
		nearby: 'Cách Đại học Công nghiệp khoảng 600 m, gần chợ Hạnh Thông Tây và các tuyến xe buýt đi trung tâm.',
	},
	{
		key: 'khoa-thu-duc',
		landlord: 'khoa',
		name: 'Căn hộ mini Sunrise',
		addressText: '45 Võ Văn Ngân',
		wardCode: '26824',
		latitude: 10.8497,
		longitude: 106.7634,
		ageDays: 150,
		amenities: [
			'wifi',
			'air_conditioner',
			'water_heater',
			'private_bathroom',
			'elevator',
			'security_camera',
			'parking',
			'furnished',
			'balcony',
		],
		fees: [
			kwh(3800),
			waterM3(22000),
			internet(100000),
			parking(120000),
			service(200000, 'Thang máy, bảo vệ và vệ sinh khu chung'),
		],
		nearby: 'Đi bộ tới Đại học Sư phạm Kỹ thuật khoảng 7 phút, gần Vincom Thủ Đức và ga metro số 1.',
	},
	{
		key: 'khoa-binh-thanh',
		landlord: 'khoa',
		name: 'Chung cư mini Bình Thạnh Home',
		addressText: '27/3 Xô Viết Nghệ Tĩnh',
		wardCode: '26929',
		latitude: 10.8019,
		longitude: 106.7108,
		ageDays: 100,
		amenities: [
			'wifi',
			'air_conditioner',
			'water_heater',
			'private_bathroom',
			'kitchen',
			'washing_machine',
			'elevator',
			'security_camera',
			'parking',
			'furnished',
		],
		fees: [
			kwh(3800),
			waterPerson(100000),
			internet(0),
			parking(150000),
			service(250000, 'Quản lý tòa nhà và vệ sinh hành lang'),
		],
		nearby: 'Gần Đại học Hutech, chợ Bà Chiểu và các tuyến đi Quận 1 chỉ mất khoảng 15 phút.',
	},
	{
		key: 'nhung-pasteur',
		landlord: 'nhung',
		name: 'Căn hộ dịch vụ Pasteur',
		addressText: '62 Pasteur',
		wardCode: '26743',
		latitude: 10.7718,
		longitude: 106.699,
		ageDays: 120,
		amenities: [
			'wifi',
			'air_conditioner',
			'water_heater',
			'private_bathroom',
			'kitchen',
			'washing_machine',
			'elevator',
			'security_camera',
			'furnished',
			'balcony',
		],
		fees: [
			kwh(4000),
			waterM3(25000),
			internet(0, 'Đã gồm trong giá thuê'),
			parking(200000),
			service(300000, 'Dọn phòng và giặt khăn ga hai lần mỗi tuần'),
		],
		nearby: 'Đi bộ ra chợ Bến Thành, Nhà thờ Đức Bà và phố đi bộ Nguyễn Huệ chỉ vài phút.',
	},
	{
		key: 'nhung-phu-nhuan',
		landlord: 'nhung',
		name: 'Dãy trọ Hồng Nhung',
		addressText: '15/2 Nguyễn Kiệm',
		wardCode: '27043',
		latitude: 10.801,
		longitude: 106.679,
		ageDays: 90,
		amenities: [
			'wifi',
			'water_heater',
			'private_bathroom',
			'loft',
			'parking',
			'security_camera',
			'free_hours',
		],
		fees: [kwh(3500), waterPerson(80000), internet(70000), parking(0)],
		nearby: 'Gần ngã tư Phú Nhuận, chợ Nguyễn Văn Trỗi, cách sân bay Tân Sơn Nhất khoảng 10 phút.',
	},
	{
		key: 'nhung-tan-binh',
		landlord: 'nhung',
		name: 'Studio Phạm Văn Bạch',
		addressText: '56 Phạm Văn Bạch',
		wardCode: '27004',
		latitude: 10.8142,
		longitude: 106.642,
		ageDays: 60,
		amenities: [
			'wifi',
			'air_conditioner',
			'water_heater',
			'private_bathroom',
			'kitchen',
			'balcony',
			'furnished',
			'parking',
		],
		fees: [
			kwh(3800),
			waterM3(20000),
			internet(100000),
			parking(100000),
			{
				kind: 'other',
				price: 50000,
				unit: 'per_month',
				note: 'Phí giữ vệ sinh chung',
			},
		],
		nearby: 'Cách sân bay Tân Sơn Nhất khoảng 5 phút, gần công viên Hoàng Văn Thụ và chợ Phạm Văn Hai.',
	},
	{
		key: 'bao-ten-lua',
		landlord: 'bao',
		name: 'Nhà trọ Quốc Bảo',
		addressText: '88 Tên Lửa',
		wardCode: '27448',
		latitude: 10.7451,
		longitude: 106.6107,
		ageDays: 70,
		amenities: [
			'wifi',
			'water_heater',
			'parking',
			'security_camera',
			'free_hours',
		],
		fees: [kwh(3500), waterPerson(70000), internet(50000), parking(0)],
		nearby: 'Gần Aeon Mall Bình Tân, chợ Bình Trị Đông và nhiều xưởng may, khu công nghiệp lân cận.',
	},
	{
		key: 'phat-quan-7',
		landlord: 'phat',
		name: 'Phòng trọ Phát Lộc',
		addressText: '34 Lâm Văn Bền',
		wardCode: '27475',
		latitude: 10.7456,
		longitude: 106.7125,
		ageDays: 40,
		amenities: [
			'wifi',
			'air_conditioner',
			'parking',
			'security_camera',
			'free_hours',
		],
		fees: [kwh(3800), waterM3(20000), internet(100000), parking(100000)],
		nearby: 'Gần Đại học Tôn Đức Thắng, Lotte Mart Quận 7 và khu Phú Mỹ Hưng.',
	},
	{
		key: 'tam-di-an',
		landlord: 'tam',
		name: 'Trọ Tâm An',
		addressText: '17 Nguyễn An Ninh',
		wardCode: '25951',
		latitude: 10.8782,
		longitude: 106.8053,
		ageDays: 24,
		amenities: [
			'wifi',
			'water_heater',
			'parking',
			'security_camera',
			'free_hours',
		],
		fees: [kwh(3500), waterPerson(60000), internet(70000), parking(0)],
		nearby: 'Cách ký túc xá khu B Đại học Quốc gia khoảng 800 m, gần chợ Đông Hòa và ga metro Suối Tiên.',
	},
	{
		key: 'mai-lai-thieu',
		landlord: 'mai',
		name: 'Nhà trọ Thu Mai',
		addressText: '203 Nguyễn Văn Tiết',
		wardCode: '25966',
		latitude: 10.9026,
		longitude: 106.7005,
		ageDays: 52,
		amenities: ['wifi', 'water_heater', 'parking', 'free_hours'],
		fees: [kwh(3500), waterPerson(50000), parking(0)],
		nearby: 'Gần chợ Lái Thiêu, cách khu công nghiệp VSIP 1 khoảng 10 phút chạy xe máy.',
	},
	{
		key: 'huy-vung-tau',
		landlord: 'huy',
		name: 'Phòng trọ Gia Huy',
		addressText: '123 Thùy Vân',
		wardCode: '26526',
		latitude: 10.3534,
		longitude: 107.0969,
		ageDays: 130,
		amenities: [
			'wifi',
			'air_conditioner',
			'parking',
			'balcony',
			'furnished',
		],
		fees: [kwh(3800), waterPerson(100000), internet(100000), parking(0)],
		nearby: 'Cách biển Bãi Sau khoảng 300 m, gần chợ Xóm Lưới và nhiều quán hải sản.',
	},
	{
		key: 'lan-phu-nhuan',
		landlord: 'lan',
		name: 'Căn hộ Ngọc Lan',
		addressText: '75 Phan Xích Long',
		wardCode: '27073',
		latitude: 10.7993,
		longitude: 106.6869,
		ageDays: 85,
		amenities: [
			'wifi',
			'air_conditioner',
			'water_heater',
			'private_bathroom',
			'kitchen',
			'elevator',
			'security_camera',
			'furnished',
		],
		fees: [
			kwh(3800),
			waterPerson(100000),
			internet(120000),
			parking(150000),
			service(200000, 'Thang máy và vệ sinh khu chung'),
		],
		nearby: 'Ngay phố ẩm thực Phan Xích Long, đi bộ ra ngã tư Phú Nhuận và siêu thị chỉ vài phút.',
	},
];

interface ListingExtra {
	readonly deposit?: number | null;
	readonly availableInDays?: number | null;
	readonly status?: DemoListing['status'];
	readonly hiddenReason?: string;
	readonly hiddenDaysAgo?: number;
	readonly images?: number;
	readonly look?: DemoListing['look'];
}

/** Tin mới: cọc mặc định bằng một tháng tiền thuê, hiện công khai, ảnh ngẫu nhiên. `extra` ghi đè từng phần. */
function listing(
	property: string,
	ageDays: number,
	title: string,
	price: number,
	areaM2: number,
	about: string,
	extra: ListingExtra = {},
): DemoListing {
	return {
		property,
		title,
		about,
		price,
		areaM2,
		deposit: extra.deposit === undefined ? price : extra.deposit,
		availableInDays: extra.availableInDays ?? null,
		ageDays,
		status: extra.status ?? 'visible',
		hiddenReason: extra.hiddenReason,
		hiddenDaysAgo: extra.hiddenDaysAgo,
		images: extra.images,
		look: extra.look ?? 'room',
	};
}

export const DEMO_LISTINGS: readonly DemoListing[] = [
	// ----- Trần Minh Khoa: Dãy trọ Minh Khoa (Gò Vấp) -----
	listing(
		'khoa-quang-trung',
		182,
		'Phòng trọ sinh viên gần ĐH Công nghiệp, có gác, giờ giấc tự do',
		2800000,
		20,
		'Phòng có gác lửng 8 m², đủ chỗ cho hai bạn ở ghép. Cửa sổ thoáng, quạt trần và đèn đã lắp sẵn. Dãy trọ chỉ có sinh viên và người đi làm nên rất yên tĩnh, có sân thượng phơi đồ riêng.',
		{ look: 'loft', availableInDays: -10 },
	),
	listing(
		'khoa-quang-trung',
		160,
		'Phòng trọ 18m² mới xây, wifi tốc độ cao',
		2500000,
		18,
		'Phòng vừa sơn lại, nền gạch men sạch sẽ, có toilet riêng và bình nóng lạnh. Wifi cáp quang phủ toàn dãy, tốc độ đủ để học online và làm việc từ xa.',
		{ availableInDays: 5 },
	),
	listing(
		'khoa-quang-trung',
		131,
		'Phòng trọ có toilet riêng, hẻm xe hơi, an ninh tốt',
		3200000,
		24,
		'Phòng rộng 24 m² có sẵn tủ quần áo và kệ bếp. Hẻm rộng, xe hơi vào được, ban đêm có camera quan sát. Người về trễ được cấp chìa khóa cổng riêng nên không lo bị khóa ngoài.',
		{ availableInDays: 14 },
	),
	listing(
		'khoa-quang-trung',
		120,
		'Giường tầng ký túc xá nữ, sạch sẽ, an ninh',
		850000,
		24,
		'Phòng ở ghép bốn bạn nữ, mỗi người một giường tầng kèm tủ khóa riêng. Có máy giặt dùng chung và góc nấu ăn. Giá thuê tính cho mỗi giường, chưa gồm điện nước và wifi chia đều theo đầu người.',
		{ deposit: 500000, availableInDays: 0, images: 4 },
	),
	listing(
		'khoa-quang-trung',
		96,
		'Phòng có ban công thoáng mát, cửa sổ lớn, gần Quang Trung',
		3000000,
		22,
		'Phòng có ban công riêng nhìn ra sân trong, nhiều nắng và gió, phơi đồ thoải mái. Phù hợp người đi làm cần chỗ ở yên tĩnh, đi xe buýt ra đường Quang Trung chỉ năm phút.',
		{ availableInDays: 30 },
	),
	listing(
		'khoa-quang-trung',
		70,
		'Phòng trọ giá rẻ cho hai người ở, gần chợ Hạnh Thông Tây',
		2300000,
		16,
		'Phòng nhỏ gọn 16 m², nấu ăn ở bếp chung cuối hành lang. Không tính thêm tiền người thứ hai, phù hợp hai bạn ở ghép hoặc cặp vợ chồng trẻ mới đi làm.',
		{ deposit: 2000000 },
	),
	listing(
		'khoa-quang-trung',
		110,
		'Phòng tầng trệt tiện cho người lớn tuổi',
		2600000,
		20,
		'Phòng ngay tầng trệt, không phải leo cầu thang, gần cổng chính. Hiện đã có người thuê nên chủ trọ tạm ẩn tin, sẽ hiện lại khi phòng trống.',
		{ status: 'hidden_by_owner', images: 2 },
	),

	// ----- Trần Minh Khoa: Căn hộ mini Sunrise (Thủ Đức) -----
	listing(
		'khoa-thu-duc',
		140,
		'Căn hộ mini full nội thất gần ĐH Sư phạm Kỹ thuật, có thang máy',
		5200000,
		30,
		'Căn hộ 30 m² đầy đủ giường, tủ, máy lạnh, bếp từ và máy nước nóng, chỉ cần xách vali vào ở. Tòa nhà có thang máy, bảo vệ và camera 24/7.',
		{ availableInDays: 7, images: 5 },
	),
	listing(
		'khoa-thu-duc',
		118,
		'Studio ban công riêng, view thoáng, đường Võ Văn Ngân',
		5800000,
		32,
		'Studio có ban công riêng nhìn ra đường, sáng cả ngày, không bị nóng nhờ cửa kính hai lớp. Bếp và khu giặt phơi tách riêng khỏi chỗ ngủ.',
		{ availableInDays: 21 },
	),
	listing(
		'khoa-thu-duc',
		95,
		'Phòng cho thuê 25m² máy lạnh, nội thất cơ bản',
		4300000,
		25,
		'Phòng 25 m² đã có máy lạnh, giường và tủ quần áo. Ai cần thêm bàn làm việc thì chủ nhà hỗ trợ lắp. Hợp đồng tối thiểu sáu tháng.',
		{ deposit: 4300000 },
	),
	listing(
		'khoa-thu-duc',
		52,
		'Căn hộ một phòng ngủ tách bếp, phù hợp cặp đôi',
		6500000,
		38,
		'Phòng ngủ tách riêng khỏi khu bếp và phòng khách nhỏ, có cửa sổ lớn đón nắng buổi sáng. Cho phép hai người ở, đăng ký tạm trú dễ dàng.',
		{ deposit: 6500000, availableInDays: 10 },
	),
	listing(
		'khoa-thu-duc',
		21,
		'Phòng master rộng 35m², cửa sổ lớn, cho nuôi mèo',
		6000000,
		35,
		'Phòng rộng nhất tòa nhà, có chỗ đặt bàn làm việc và sofa nhỏ. Chủ nhà cho nuôi mèo nhỏ với điều kiện giữ vệ sinh khu chung.',
		{ availableInDays: 3, images: 5 },
	),

	// ----- Trần Minh Khoa: Chung cư mini Bình Thạnh Home -----
	listing(
		'khoa-binh-thanh',
		94,
		'Căn hộ dịch vụ Bình Thạnh gần Hutech, đầy đủ tiện nghi',
		6800000,
		30,
		'Căn hộ có máy lạnh, bếp, tủ lạnh và máy giặt chung tầng. Tòa nhà có hầm giữ xe rộng, thang máy và camera khắp hành lang. Wifi miễn phí cho cả tòa.',
		{ availableInDays: 15 },
	),
	listing(
		'khoa-binh-thanh',
		80,
		'Studio 28m² mới 100%, có máy giặt riêng',
		7200000,
		28,
		'Studio vừa bàn giao, nội thất mới hoàn toàn, có máy giặt riêng trong căn. Bếp từ, hút mùi và tủ lạnh lắp sẵn.',
		{ images: 5 },
	),
	listing(
		'khoa-binh-thanh',
		66,
		'Phòng một phòng ngủ có bếp, cách Landmark 81 mười phút',
		8500000,
		40,
		'Căn hộ 40 m² có phòng ngủ riêng và bếp lớn, nấu ăn thoải mái. Từ tòa nhà đi xe máy tới Landmark 81 và công viên bờ sông khoảng mười phút.',
		{ deposit: 8500000, availableInDays: 20 },
	),
	listing(
		'khoa-binh-thanh',
		40,
		'Phòng trọ cao cấp cho nhân viên văn phòng',
		5500000,
		24,
		'Phòng 24 m² sạch đẹp, có máy lạnh và nóng lạnh, hợp nhân viên văn phòng cần chỗ ở gọn gàng gần nơi làm việc. Có dịch vụ dọn vệ sinh theo yêu cầu.',
	),
	listing(
		'khoa-binh-thanh',
		9,
		'Căn hộ mini hai người ở, thang máy, hầm xe rộng',
		7800000,
		36,
		'Căn hộ 36 m² dành cho hai người ở, có thang máy và chỗ gửi xe trong hầm, không lo mưa nắng. Đăng ký tạm trú nhanh, hợp đồng linh hoạt từ sáu tháng.',
		{ deposit: 7800000, availableInDays: 0 },
	),

	// ----- Lê Thị Hồng Nhung: Căn hộ dịch vụ Pasteur (Quận 1) -----
	listing(
		'nhung-pasteur',
		112,
		'Căn hộ dịch vụ trung tâm Quận 1, đi bộ ra chợ Bến Thành',
		12000000,
		35,
		'Căn hộ 35 m² ngay trung tâm, đầy đủ nội thất cao cấp, có dịch vụ dọn phòng và thay khăn ga hai lần mỗi tuần. Hợp chuyên gia nước ngoài hoặc nhân viên công tác dài ngày.',
		{ deposit: 24000000, availableInDays: 7, images: 5 },
	),
	listing(
		'nhung-pasteur',
		85,
		'Studio Pasteur cửa sổ lớn, dọn phòng hai lần mỗi tuần',
		10500000,
		30,
		'Studio sáng sủa với cửa sổ lớn nhìn ra phố, bếp nhỏ và máy giặt riêng. Giá đã gồm internet, chỉ tính thêm điện nước theo công tơ.',
		{ deposit: 21000000 },
	),
	listing(
		'nhung-pasteur',
		49,
		'Căn hộ một phòng ngủ tách bếp, có ban công',
		14500000,
		40,
		'Căn hộ 40 m² có ban công nhìn xuống phố Pasteur, phòng ngủ tách riêng khỏi bếp và phòng khách. Tòa nhà có thang máy, lễ tân và camera 24/7.',
		{ deposit: 29000000, availableInDays: 30, images: 5 },
	),
	listing(
		'nhung-pasteur',
		12,
		'Phòng nhỏ gọn cho một người, ngay trung tâm',
		8500000,
		20,
		'Phòng 20 m² dành cho một người, đủ giường, tủ, bàn làm việc và bếp mini. Đi bộ ra phố đi bộ Nguyễn Huệ chỉ mất năm phút.',
		{ deposit: 17000000, availableInDays: 0 },
	),

	// ----- Lê Thị Hồng Nhung: Dãy trọ Hồng Nhung (Phú Nhuận) -----
	listing(
		'nhung-phu-nhuan',
		82,
		'Phòng có gác lửng rộng, gần chợ Nguyễn Văn Trỗi',
		4200000,
		24,
		'Phòng có gác lửng rộng 10 m², chỗ ngủ và chỗ sinh hoạt tách biệt. Toilet riêng, bình nóng lạnh, cửa sổ lớn thoáng gió. Đi chợ Nguyễn Văn Trỗi chỉ ba phút.',
		{ look: 'loft', availableInDays: 12 },
	),
	listing(
		'nhung-phu-nhuan',
		58,
		'Phòng trọ 20m² sạch sẽ, gần sân bay Tân Sơn Nhất',
		3500000,
		20,
		'Phòng 20 m² sạch sẽ, nền gạch men, có toilet riêng và chỗ phơi đồ. Phù hợp nhân viên sân bay hoặc người đi làm khu vực Tân Bình, Phú Nhuận.',
		{ availableInDays: 0 },
	),
	listing(
		'nhung-phu-nhuan',
		31,
		'Phòng trọ yên tĩnh, ưu tiên nữ làm văn phòng',
		3300000,
		18,
		'Dãy trọ chỉ cho nữ ở, yên tĩnh và sạch sẽ, có camera khu vực cổng và hành lang. Chủ nhà ở cùng khu nên hỗ trợ nhanh khi cần.',
		{ availableInDays: 18 },
	),
	listing(
		'nhung-phu-nhuan',
		44,
		'Phòng giá rẻ nhất khu vực, liên hệ ngay!!!',
		1200000,
		15,
		'Phòng giá rẻ nhất khu vực, ai nhanh tay thì được. Liên hệ ngay kẻo hết.',
		{
			status: 'hidden_by_admin',
			hiddenReason:
				'Tiêu đề quảng cáo quá đà và mức giá không đúng với phòng thực tế sau khi kiểm tra. Vui lòng sửa tiêu đề, mô tả rồi liên hệ admin để được mở lại.',
			hiddenDaysAgo: 8,
			images: 2,
		},
	),
	listing(
		'nhung-phu-nhuan',
		70,
		'Phòng tầng 2 đã cho thuê, tạm ẩn tin',
		3800000,
		22,
		'Phòng tầng hai có cửa sổ hướng đông, đã có người thuê. Chủ trọ tạm ẩn tin và sẽ hiện lại khi phòng trống.',
		{ status: 'hidden_by_owner', images: 3 },
	),

	// ----- Lê Thị Hồng Nhung: Studio Phạm Văn Bạch (Tân Bình) -----
	listing(
		'nhung-tan-binh',
		55,
		'Studio gần sân bay Tân Sơn Nhất, đủ nội thất',
		6200000,
		30,
		'Studio 30 m² đủ giường, tủ, máy lạnh, bếp và máy nước nóng. Đi bộ ra công viên Hoàng Văn Thụ, từ nhà tới sân bay chỉ khoảng năm phút.',
		{ availableInDays: 9, images: 5 },
	),
	listing(
		'nhung-tan-binh',
		28,
		'Phòng trọ ban công, bếp riêng, đường Phạm Văn Bạch',
		4800000,
		26,
		'Phòng có ban công riêng và bếp riêng, nấu ăn không phải dùng chung. Phòng ở tầng ba, thoáng gió và ít ồn nhờ nằm sâu trong hẻm.',
	),
	listing(
		'nhung-tan-binh',
		5,
		'Căn hộ mini cho gia đình nhỏ, hai phòng ngủ',
		9000000,
		50,
		'Căn hộ 50 m² hai phòng ngủ, bếp và phòng khách riêng. Phù hợp gia đình nhỏ có một em bé, gần trường mầm non và chợ.',
		{ deposit: 18000000, availableInDays: 25, images: 5 },
	),

	// ----- Phạm Quốc Bảo: Nhà trọ Quốc Bảo (Bình Tân), 7 tin hiện trên hạn mức 5 -----
	listing(
		'bao-ten-lua',
		66,
		'Phòng trọ công nhân khu Tên Lửa, giá rẻ',
		1900000,
		16,
		'Phòng 16 m² giá mềm cho công nhân và người mới đi làm. Có chỗ để xe trong nhà, khóa cổng lúc 23 giờ nhưng có chìa phụ cho người tăng ca.',
	),
	listing(
		'bao-ten-lua',
		58,
		'Phòng 20m² có gác, gần Aeon Mall Bình Tân',
		2600000,
		20,
		'Phòng 20 m² có gác lửng, đủ chỗ cho hai người ở. Đi bộ ra Aeon Mall Bình Tân khoảng mười phút, gần nhiều quán ăn và siêu thị.',
		{ look: 'loft', availableInDays: 6 },
	),
	listing(
		'bao-ten-lua',
		47,
		'Phòng mới xây, toilet riêng, wifi miễn phí',
		2400000,
		18,
		'Phòng mới xây, sơn sạch, có toilet riêng và bình nóng lạnh. Wifi chủ nhà lắp sẵn, thuê phòng là dùng được ngay.',
	),
	listing(
		'bao-ten-lua',
		36,
		'Phòng rộng 25m² cho ba người ở, hẻm xe tải',
		3000000,
		25,
		'Phòng rộng 25 m² hợp ba bạn ở chung, chia tiền thuê rất nhẹ. Hẻm xe tải vào được nên chuyển nhà dễ dàng.',
		{ availableInDays: 0 },
	),
	listing(
		'bao-ten-lua',
		25,
		'Phòng trọ gần bệnh viện Bình Tân',
		2200000,
		17,
		'Phòng 17 m² cách bệnh viện Bình Tân khoảng 500 m, thuận tiện cho nhân viên y tế và người nhà bệnh nhân thuê ngắn hạn.',
		{ availableInDays: 4 },
	),
	listing(
		'bao-ten-lua',
		11,
		'Phòng có máy lạnh, bếp riêng, yên tĩnh',
		3100000,
		22,
		'Phòng có sẵn máy lạnh và bếp riêng, nằm cuối dãy nên rất yên tĩnh. Hợp người làm việc ca đêm cần chỗ nghỉ ngày.',
	),
	listing(
		'bao-ten-lua',
		4,
		'Phòng góc hai mặt thoáng, có ban công nhỏ',
		2900000,
		21,
		'Phòng góc có hai mặt cửa sổ và ban công nhỏ, luôn có gió. Tin này chưa kịp chụp ảnh nên chưa có hình.',
		{ images: 0, availableInDays: 15 },
	),

	// ----- Nguyễn Hữu Phát: Phòng trọ Phát Lộc (Quận 7) -----
	listing(
		'phat-quan-7',
		36,
		'Phòng trọ Quận 7 gần ĐH Tôn Đức Thắng, có máy lạnh',
		3600000,
		20,
		'Phòng 20 m² có máy lạnh, cách Đại học Tôn Đức Thắng khoảng 1 km. Dãy trọ yên tĩnh, có camera và chỗ để xe trong sân.',
		{ availableInDays: 5 },
	),
	listing(
		'phat-quan-7',
		27,
		'Phòng có gác gần Lotte Mart Quận 7',
		3400000,
		22,
		'Phòng có gác lửng, đi bộ ra Lotte Mart khoảng năm phút. Giờ giấc tự do, khu vực nhiều quán ăn và tiệm cà phê.',
		{ look: 'loft' },
	),
	listing(
		'phat-quan-7',
		16,
		'Phòng sạch sẽ gần cầu Phú Mỹ, đi Quận 2 rất tiện',
		3900000,
		24,
		'Phòng 24 m² sạch sẽ, thoáng mát, đi qua cầu Phú Mỹ sang Quận 2 chỉ mất mười lăm phút. Phù hợp người làm việc ở Thủ Thiêm hoặc Quận 7.',
		{ availableInDays: 12, images: 4 },
	),
	listing(
		'phat-quan-7',
		7,
		'Phòng đơn 15m² giá tốt cho sinh viên',
		2800000,
		15,
		'Phòng đơn 15 m² giá mềm dành cho sinh viên, đủ chỗ cho một giường và bàn học. Chủ trọ dễ tính, cho đóng tiền theo tháng.',
		{ deposit: 1400000, images: 1 },
	),

	// ----- Võ Thanh Tâm: Trọ Tâm An (Dĩ An), đang dùng thử -----
	listing(
		'tam-di-an',
		22,
		'Phòng trọ gần KTX khu B ĐHQG, giá sinh viên',
		1800000,
		18,
		'Phòng 18 m² giá sinh viên, cách ký túc xá khu B Đại học Quốc gia khoảng 800 m. Có camera, chỗ để xe miễn phí và giờ giấc tự do.',
		{ availableInDays: 0 },
	),
	listing(
		'tam-di-an',
		14,
		'Phòng 25m² có gác, wifi mạnh, Dĩ An',
		2300000,
		25,
		'Phòng rộng 25 m² có gác lửng, hợp ba bạn sinh viên ở chung. Wifi phủ sóng mạnh, dãy trọ mới xây nên còn sạch sẽ.',
		{ look: 'loft', availableInDays: 8 },
	),
	listing(
		'tam-di-an',
		5,
		'Phòng mới xây, sắp bàn giao',
		1900000,
		18,
		'Dãy phòng đang hoàn thiện phần sơn, dự kiến bàn giao sau hai tuần. Chủ trọ tạm ẩn tin vì hạn mức dùng thử chỉ cho hiện hai tin cùng lúc.',
		{ status: 'hidden_by_owner', images: 2 },
	),

	// ----- Đặng Thị Mai: Nhà trọ Thu Mai (Thuận An), đã hết dùng thử -----
	listing(
		'mai-lai-thieu',
		48,
		'Phòng trọ Lái Thiêu gần chợ, yên tĩnh',
		1700000,
		18,
		'Phòng 18 m² gần chợ Lái Thiêu, yên tĩnh và sạch sẽ. Chủ trọ ở cùng khu, hỗ trợ khi cần sửa điện nước.',
	),
	listing(
		'mai-lai-thieu',
		33,
		'Phòng rộng 24m² có gác, ở được ba người',
		2200000,
		24,
		'Phòng rộng 24 m² có gác lửng, ở được ba người thoải mái. Có sân phơi đồ và chỗ để xe ngay trong nhà.',
		{ look: 'loft' },
	),
	listing(
		'mai-lai-thieu',
		20,
		'Phòng trọ giá rẻ cho công nhân KCN VSIP 1',
		1600000,
		16,
		'Phòng 16 m² giá rẻ cho công nhân khu công nghiệp VSIP 1, cách chỗ làm khoảng mười phút chạy xe máy.',
		{ availableInDays: 3 },
	),

	// ----- Hoàng Gia Huy: Phòng trọ Gia Huy (Vũng Tàu), gói đã hết hạn -----
	listing(
		'huy-vung-tau',
		120,
		'Phòng trọ gần biển Bãi Sau, có máy lạnh',
		2800000,
		22,
		'Phòng 22 m² có máy lạnh, cách biển Bãi Sau khoảng 300 m. Hợp người làm việc ở khu du lịch hoặc thuê dài hạn để học.',
	),
	listing(
		'huy-vung-tau',
		95,
		'Căn hộ mini Thùy Vân một phòng ngủ, nội thất đầy đủ',
		4500000,
		32,
		'Căn hộ mini 32 m² một phòng ngủ, nội thất đầy đủ, có ban công nhìn ra phố. Phù hợp cặp đôi hoặc người cần chỗ ở lâu dài.',
		{ images: 5 },
	),
	listing(
		'huy-vung-tau',
		70,
		'Phòng cho thuê dài hạn gần chợ Xóm Lưới',
		2200000,
		18,
		'Phòng 18 m² thuê dài hạn, gần chợ Xóm Lưới nên mua sắm tiện lợi. Giữ xe miễn phí, chủ nhà thân thiện.',
	),
	listing(
		'huy-vung-tau',
		50,
		'Phòng ban công hướng biển, thuê dài hạn giá tốt',
		3400000,
		26,
		'Phòng 26 m² có ban công hướng biển, buổi sáng đón gió mát. Thuê dài hạn từ sáu tháng được giảm giá.',
		{ images: 4 },
	),

	// ----- Bùi Ngọc Lan: Căn hộ Ngọc Lan (Phú Nhuận), tài khoản bị khóa -----
	listing(
		'lan-phu-nhuan',
		78,
		'Căn hộ mini Phan Xích Long, gần khu ăn uống sầm uất',
		6500000,
		30,
		'Căn hộ 30 m² ngay phố ẩm thực Phan Xích Long, đầy đủ nội thất, có thang máy và camera. Hơi ồn buổi tối nhưng đổi lại ăn uống và đi lại rất tiện.',
		{ images: 5 },
	),
	listing(
		'lan-phu-nhuan',
		50,
		'Studio cao cấp cho chuyên gia, nội thất mới',
		7500000,
		32,
		'Studio nội thất mới, bếp từ, máy giặt và tủ lạnh lắp sẵn. Phù hợp chuyên gia cần chỗ ở gần khu trung tâm.',
		{ availableInDays: 20 },
	),
	listing(
		'lan-phu-nhuan',
		22,
		'Phòng đẹp gần ngã tư Phú Nhuận, có thang máy',
		5200000,
		24,
		'Phòng 24 m² gần ngã tư Phú Nhuận, có thang máy và camera ở cổng. Giờ giấc tự do, có chỗ để xe cho hai người.',
	),
];
