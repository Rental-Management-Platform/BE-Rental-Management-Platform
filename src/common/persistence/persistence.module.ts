import { Global, Module } from '@nestjs/common';
import { TransactionRunner } from './transaction-runner';

/** Hạ tầng dùng chung, nên để toàn cục thay vì import lặp lại ở từng module. */
@Global()
@Module({
	providers: [TransactionRunner],
	exports: [TransactionRunner],
})
export class PersistenceModule {}
