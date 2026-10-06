import { createApp } from './app.factory';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(app.get(AppConfigService).port);
}
void bootstrap();
