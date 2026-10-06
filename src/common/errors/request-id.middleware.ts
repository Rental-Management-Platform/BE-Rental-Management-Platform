import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function requestIdMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const incoming = req.header(REQUEST_ID_HEADER);
	const requestId =
		incoming !== undefined && VALID_REQUEST_ID.test(incoming)
			? incoming
			: randomUUID();
	res.setHeader('X-Request-Id', requestId);
	next();
}

export function getRequestId(res: Response): string {
	const value = res.getHeader(REQUEST_ID_HEADER);
	return typeof value === 'string' ? value : randomUUID();
}
