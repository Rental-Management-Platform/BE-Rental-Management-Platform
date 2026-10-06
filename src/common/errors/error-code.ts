import { HttpStatus } from '@nestjs/common';

export enum ErrorCode {
	// Common
	VALIDATION_FAILED = 'VALIDATION_FAILED',
	INVALID_ID = 'INVALID_ID',
	PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
	BAD_REQUEST = 'BAD_REQUEST',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	HTTP_ERROR = 'HTTP_ERROR',
	DB_UNAVAILABLE = 'DB_UNAVAILABLE',
	INTERNAL_ERROR = 'INTERNAL_ERROR',

	//login and token
	TOKEN_MISSING = 'TOKEN_MISSING',
	TOKEN_INVALID = 'TOKEN_INVALID',
	TOKEN_EXPIRED = 'TOKEN_EXPIRED',
	INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
	REFRESH_TOKEN_MISSING = 'REFRESH_TOKEN_MISSING',
	SESSION_REVOKED = 'SESSION_REVOKED',
	SESSION_EXPIRED = 'SESSION_EXPIRED',
	ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
	ORIGIN_NOT_ALLOWED = 'ORIGIN_NOT_ALLOWED',
	EMAIL_TAKEN = 'EMAIL_TAKEN',
	ROLE_NOT_ASSIGNABLE = 'ROLE_NOT_ASSIGNABLE',

	//spec
	PERMISSION_DENIED = 'PERMISSION_DENIED',
	NOT_RESOURCE_OWNER = 'NOT_RESOURCE_OWNER',
}

export interface ErrorDefinition {
	readonly status: HttpStatus;
	readonly message: string;
}

export const ERRORS: Record<ErrorCode, ErrorDefinition> = {
	[ErrorCode.VALIDATION_FAILED]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'The provided data is invalid.',
	},
	[ErrorCode.INVALID_ID]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'The identifier is invalid.',
	},
	[ErrorCode.PAYLOAD_TOO_LARGE]: {
		status: HttpStatus.PAYLOAD_TOO_LARGE,
		message: 'The request payload is too large.',
	},
	[ErrorCode.BAD_REQUEST]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'The request is invalid.',
	},
	[ErrorCode.UNAUTHORIZED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'You are not authenticated.',
	},
	[ErrorCode.FORBIDDEN]: {
		status: HttpStatus.FORBIDDEN,
		message: 'You do not have permission to perform this action.',
	},
	[ErrorCode.NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'The requested resource was not found.',
	},
	// The actual status is taken from the original exception; this is only a fallback value.
	[ErrorCode.HTTP_ERROR]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'The request could not be processed.',
	},
	[ErrorCode.DB_UNAVAILABLE]: {
		status: HttpStatus.SERVICE_UNAVAILABLE,
		message: 'The system is currently unavailable. Please try again later.',
	},
	[ErrorCode.INTERNAL_ERROR]: {
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		message: 'An internal server error occurred.',
	},
	[ErrorCode.TOKEN_MISSING]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Authentication token is missing.',
	},
	[ErrorCode.TOKEN_INVALID]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'The authentication token is invalid.',
	},
	[ErrorCode.TOKEN_EXPIRED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'The authentication token has expired.',
	},
	[ErrorCode.INVALID_CREDENTIALS]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'The email or password is incorrect.',
	},
	[ErrorCode.REFRESH_TOKEN_MISSING]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Refresh token is missing.',
	},
	[ErrorCode.SESSION_REVOKED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Your session has been revoked. Please log in again.',
	},
	[ErrorCode.SESSION_EXPIRED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Your session has expired. Please log in again.',
	},
	[ErrorCode.ACCOUNT_LOCKED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Your account has been locked.',
	},
	[ErrorCode.ORIGIN_NOT_ALLOWED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'The request origin is not allowed.',
	},
	[ErrorCode.EMAIL_TAKEN]: {
		status: HttpStatus.CONFLICT,
		message: 'This email address is already in use.',
	},
	[ErrorCode.ROLE_NOT_ASSIGNABLE]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'This role cannot be assigned during registration.',
	},
	[ErrorCode.PERMISSION_DENIED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'You do not have permission to perform this action.',
	},
	[ErrorCode.NOT_RESOURCE_OWNER]: {
		status: HttpStatus.FORBIDDEN,
		message: 'You can only perform this action on your own data.',
	},
};

export interface FieldError {
	readonly field: string;
	readonly code: string;
	readonly message: string;
}
