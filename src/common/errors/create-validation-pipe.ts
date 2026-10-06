import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code';
import type { FieldError } from './error-code';

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field =
      parent === '' ? error.property : `${parent}.${error.property}`;
    const own = Object.entries(error.constraints ?? {}).map(
      ([code, message]): FieldError => ({ field, code, message }),
    );
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(
        ErrorCode.VALIDATION_FAILED,
        flattenValidationErrors(errors),
      ),
  });
}

/** Mọi tham số id dùng: `@Param('id', uuidParam()) id: string`. */
export function uuidParam(): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () => new AppException(ErrorCode.INVALID_ID),
  });
}
