import { mock } from 'node:test';

// The acceptance fixtures use an explicit October 2026 accounting calendar.
// Example installers and service timestamps must see that same calendar when
// tests run on another day/laptop. Only Date is mocked; HTTP and timeout timers
// remain real. Runtime launchers never import this test-only bootstrap.
// https://nodejs.org/docs/latest-v24.x/api/test.html#dates
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T12:00:00.000Z') });
