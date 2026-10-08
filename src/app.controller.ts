import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	/** Route thử nghiệm công khai; mọi route đều phải khai báo quyền (spec 0003 AC-4). */
	@Public()
	@Get()
	getHello(): string {
		return this.appService.getHello();
	}
}
