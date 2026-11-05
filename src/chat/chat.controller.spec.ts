import 'reflect-metadata';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readRouteAccess } from '../common/auth/route-access';
import { RATE_LIMIT_GROUP_KEY } from '../common/rate-limit/rate-limited.decorator';
import {
	ConversationsController,
	ListingConversationsController,
	MeConversationsController,
} from './chat.controller';
import { ChatModule } from './chat.module';
import type { RateLimitGroup } from '../common/rate-limit/rate-limits';

type Controller = new (...args: never[]) => object;

interface Expected {
	controller: Controller;
	handler: string;
	permission: string;
	group: RateLimitGroup;
	freshAuth: boolean;
}

/** Bảy route chat của spec 0013. */
const ROUTES: Expected[] = [
	{
		controller: ListingConversationsController,
		handler: 'open',
		permission: 'conversation:create',
		group: 'conversationStart',
		freshAuth: true,
	},
	{
		controller: ConversationsController,
		handler: 'send',
		permission: 'message:create',
		group: 'messageWrite',
		freshAuth: true,
	},
	{
		controller: ConversationsController,
		handler: 'messages',
		permission: 'conversation:read',
		group: 'chatRead',
		freshAuth: false,
	},
	{
		controller: ConversationsController,
		handler: 'detail',
		permission: 'conversation:read',
		group: 'chatRead',
		freshAuth: false,
	},
	{
		controller: MeConversationsController,
		handler: 'inbox',
		permission: 'conversation:read',
		group: 'chatRead',
		freshAuth: false,
	},
	{
		controller: MeConversationsController,
		handler: 'unreadCount',
		permission: 'conversation:read',
		group: 'chatRead',
		freshAuth: false,
	},
	{
		controller: ConversationsController,
		handler: 'markRead',
		permission: 'conversation:update',
		group: 'chatRead',
		freshAuth: false,
	},
];

describe.each(ROUTES)(
	'$controller.name.$handler: khai báo route (spec 0013 AC-8, AC-12)',
	({ controller, handler: name, permission, group, freshAuth }) => {
		const handler = Reflect.get(
			controller.prototype,
			name,
		) as () => unknown;
		const access = readRouteAccess(new Reflector(), {
			getHandler: () => handler,
			getClass: () => controller,
		});

		it(`chỉ cần quyền ${permission}, đúng một kiểu khai báo`, () => {
			expect(access.declarationCount).toBe(1);
			expect(access.declaration).toEqual({
				kind: 'permissions',
				required: [permission],
			});
		});

		it(`thuộc nhóm giới hạn tần suất ${group}`, () => {
			expect(Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler)).toBe(
				group,
			);
		});

		it(`${freshAuth ? 'có' : 'không có'} @FreshAuth()`, () => {
			expect(access.freshAuth).toBe(freshAuth);
		});

		it('trả Cache-Control: private, no-store vì nội dung riêng và đổi liên tục', () => {
			expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
				{ name: 'Cache-Control', value: 'private, no-store' },
			]);
		});
	},
);

describe('ChatModule', () => {
	it('khai đủ ba controller', () => {
		const declared = Reflect.getMetadata(
			'controllers',
			ChatModule,
		) as unknown[];
		expect(declared).toEqual([
			ListingConversationsController,
			ConversationsController,
			MeConversationsController,
		]);
	});

	it('chỉ hai route gửi tin có @FreshAuth(); đánh dấu đã đọc không, để đọc luôn được kể cả khi tài khoản vừa bị khóa (AC-5)', () => {
		const fresh = ROUTES.filter((route) => route.freshAuth).map(
			(route) => route.handler,
		);
		expect(fresh.sort()).toEqual(['open', 'send']);
		expect(
			ROUTES.find((route) => route.handler === 'markRead')?.freshAuth,
		).toBe(false);
	});

	it('đủ bảy route, mỗi handler một lần', () => {
		expect(ROUTES.map((route) => route.handler).sort()).toEqual([
			'detail',
			'inbox',
			'markRead',
			'messages',
			'open',
			'send',
			'unreadCount',
		]);
	});
});

describe('đường dẫn route (spec 0013, "API surface")', () => {
	it.each([
		[ListingConversationsController, 'listings/:id/conversations'],
		[ConversationsController, 'conversations'],
		[MeConversationsController, 'me/conversations'],
	])('%p có tiền tố %s', (controller, path) => {
		expect(Reflect.getMetadata('path', controller)).toBe(path);
	});

	it('GET :id/messages và POST :id/messages cùng đường dẫn, khác method; GET :id đứng sau để không nuốt đường dẫn con', () => {
		const names = Object.getOwnPropertyNames(
			ConversationsController.prototype,
		).filter((name) => name !== 'constructor');
		expect(names.indexOf('messages')).toBeLessThan(names.indexOf('detail'));
		const pathOf = (name: string): unknown =>
			Reflect.getMetadata(
				'path',
				Reflect.get(ConversationsController.prototype, name) as object,
			);
		expect(pathOf('send')).toBe(':id/messages');
		expect(pathOf('messages')).toBe(':id/messages');
		expect(pathOf('detail')).toBe(':id');
	});

	it('POST :id/read là POST (đổi mốc đọc), trả 200 chứ không 201 vì không tạo tài nguyên', () => {
		const handler = Reflect.get(
			ConversationsController.prototype,
			'markRead',
		) as object;
		expect(Reflect.getMetadata('path', handler)).toBe(':id/read');
		// RequestMethod.POST = 1; HttpCode đặt trong metadata '__httpCode__'.
		expect(Reflect.getMetadata('method', handler)).toBe(1);
		expect(Reflect.getMetadata('__httpCode__', handler)).toBe(200);
	});

	it('GET me/conversations/unread-count là đường dẫn cố định, không thể bị :id nuốt vì nằm ở controller khác tiền tố', () => {
		const handler = Reflect.get(
			MeConversationsController.prototype,
			'unreadCount',
		) as object;
		expect(Reflect.getMetadata('path', handler)).toBe('unread-count');
		expect(Reflect.getMetadata('method', handler)).toBe(0);
	});
});
