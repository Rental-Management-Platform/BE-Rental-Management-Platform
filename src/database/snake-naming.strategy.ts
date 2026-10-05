import { createHash } from 'node:crypto';
import { DefaultNamingStrategy } from 'typeorm';
import type { NamingStrategyInterface, Table } from 'typeorm';

const POSTGRES_NAME_LIMIT = 63;

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function tableNameOf(tableOrName: Table | string): string {
  const name = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
  return name.split('.').pop() ?? name;
}

/** Postgres cắt tên dài hơn 63 ký tự; rút gọn có băm để tên ổn định và TypeORM không báo lệch. */
function fit(name: string): string {
  if (name.length <= POSTGRES_NAME_LIMIT) {
    return name;
  }
  const hash = createHash('sha1').update(name).digest('hex').slice(0, 8);
  return `${name.slice(0, POSTGRES_NAME_LIMIT - 9)}_${hash}`;
}

/**
 * Bảng và cột `snake_case` trong DB (camelCase trong TypeScript). Tên ràng buộc và chỉ mục
 * đặt theo `<bảng>_<cột>_<loại>` để spec 0004 đổi lỗi trùng giá trị đúng mã
 * (ví dụ `users_email_unique`).
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return (
      snakeCase(embeddedPrefixes.concat('').join('_')) +
      (customName ?? snakeCase(propertyName))
    );
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  primaryKeyName(tableOrName: Table | string): string {
    return fit(`${tableNameOf(tableOrName)}_pkey`);
  }

  uniqueConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return fit(`${tableNameOf(tableOrName)}_${columnNames.join('_')}_unique`);
  }

  relationConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    return fit(`${tableNameOf(tableOrName)}_${columnNames.join('_')}_unique`);
  }

  foreignKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return fit(`${tableNameOf(tableOrName)}_${columnNames.join('_')}_fk`);
  }

  indexName(tableOrName: Table | string, columnNames: string[]): string {
    return fit(`${tableNameOf(tableOrName)}_${columnNames.join('_')}_idx`);
  }
}
