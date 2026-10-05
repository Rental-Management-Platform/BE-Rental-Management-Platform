import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1791184866456 implements MigrationInterface {
  name = 'CreateUsers1791184866456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuidv7(), "email" text NOT NULL, "password_hash" text NOT NULL, "name" text, "roles" text array NOT NULL, "status" text NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "users_email_unique" UNIQUE ("email"), CONSTRAINT "users_status_check" CHECK ("status" IN ('active', 'locked')), CONSTRAINT "users_pkey" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
