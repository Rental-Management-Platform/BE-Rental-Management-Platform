import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateAccountTypePermissionsDto {
	/** Thay toàn bộ danh sách quyền của loại; khóa dạng `module:action`. */
	@IsArray()
	@ArrayMaxSize(300)
	@IsString({ each: true })
	@MaxLength(60, { each: true })
	permissions: string[];
}
