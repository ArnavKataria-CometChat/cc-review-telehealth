import { createApp } from './app';
import { config } from './config';
import { seed } from './db/seed';

const { accounts } = seed();
const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `telehealth-backend listening on http://localhost:${config.port} (${config.nodeEnv})`,
  );
  // eslint-disable-next-line no-console
  console.log(`Seeded ${accounts.length} demo accounts — password = SEED_PASSWORD`);
});
