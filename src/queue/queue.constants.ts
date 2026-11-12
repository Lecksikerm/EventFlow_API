export const WEBHOOK_QUEUE = 'webhook-events';

// Retry policy for webhook jobs: 4 attempts total, waiting 2s, 4s, then 8s between tries.
export const WEBHOOK_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: false,
};
