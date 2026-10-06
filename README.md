<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Cấu hình database (PostgreSQL cài sẵn trên máy)

Mọi thông tin kết nối và bí mật nằm trong file `.env` (đã bị git bỏ qua). Không đưa giá trị thật
vào mã nguồn hay vào `.env.example`.

1. Copy `.env.example` thành `.env`, rồi điền:
   - `DATABASE_PASSWORD`: mật khẩu cho role ứng dụng, từ 16 ký tự, tự đặt (không được để `CHANGE_ME`).
   - `JWT_ACCESS_SECRET`: chuỗi ngẫu nhiên từ 32 ký tự (không được để `CHANGE_ME`).
   - `ALLOWED_ORIGINS`: địa chỉ FE được gọi API và gửi cookie, ví dụ `http://localhost:5173` (không có dấu `/` cuối).
   - `DATABASE_ADMIN_PASSWORD`: mật khẩu tài khoản quản trị `postgres` bạn đã đặt lúc cài PostgreSQL.
     Chỉ `npm run db:create` đọc biến này.
   - Có thể sinh chuỗi ngẫu nhiên bằng: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
2. Tạo role ứng dụng (không phải superuser) và database mới (UTF8): `npm run db:create`.
   Chạy lại nhiều lần vẫn an toàn, không xóa gì.
3. Kiểm tra kết nối bằng chính tài khoản ứng dụng: `npm run db:check`.
4. Tạo bảng: `npm run migration:deploy` (áp mọi migration trong `prisma/migrations`). Muốn thêm
   hoặc sửa bảng: sửa `prisma/schema.prisma`, rồi `npm run migration:dev -- --name TenMigration`
   (thêm `--create-only` nếu cần sửa SQL tay, ví dụ `CHECK` hoặc chỉ mục một phần). Lệnh này cần một
   database phụ tên `<DATABASE_NAME>_shadow`: tạo bằng `DATABASE_NAME=<tên>_shadow npm run db:create`.
   Xem dữ liệu bằng tay: `npm run db:studio`.
5. Chạy ứng dụng: `npm run start:dev`.

Prisma client được sinh ra ở `src/generated/prisma` (git bỏ qua) bởi `npm install` và `npm run build`;
sinh lại bằng `npm run db:generate`. Dự án dùng Prisma 7, đừng nâng lên bản 8 khi chưa có quyết định riêng.
Database phải thuộc về role ứng dụng (`db:create` làm đúng điều này); nếu bạn tạo database bằng tay,
chạy `ALTER DATABASE <tên> OWNER TO rental_app;` bằng tài khoản `postgres`.

Thiếu biến hoặc còn giá trị `CHANGE_ME` thì ứng dụng không khởi động và in danh sách biến sai
(chỉ nêu tên biến, không in giá trị).

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
