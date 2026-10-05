import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';

export type UserStatus = 'active' | 'locked';

@Entity('users')
@Check('users_status_check', `"status" IN ('active', 'locked')`)
export class User {
  // uuidv7() có sẵn từ PostgreSQL 18; id sắp theo thời gian nên chỉ mục không bị phân mảnh.
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  // Tạm thời: spec 0003 thay bằng bảng roles và user_roles. Không đặt giá trị mặc định ở DB:
  // TypeORM đọc sai mặc định kiểu mảng nên luôn báo lệch schema; UsersService luôn truyền vai trò.
  @Column({ type: 'text', array: true })
  roles: Role[];

  @Column({ type: 'text', default: 'active' })
  status: UserStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
