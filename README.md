# EventFlow API

A backend that receives webhook events reliably. It verifies signatures, prevents duplicate processing, processes events in the background, retries failures, and tracks the status of every event.

## The problem

Services like payment providers send events such as `payment.success` or `subscription.cancelled`. The same event can arrive more than once, processing can fail temporarily, and slow work shouldn't hold up the response. EventFlow handles all of these.

## Architecture

```
Webhook provider
      |
POST /webhooks/events
      |
Verify HMAC signature ──> 401 if invalid
      |
Save to PostgreSQL (unique event_id)
      |
Duplicate? ──> 202 with duplicate: true
      |
Add job to BullMQ (Redis)
      |
202 Accepted
      |
Background worker
      |
Success ──> completed
Failure ──> retry with exponential backoff ──> failed after all attempts
```

## Features

- **Signature verification:** HMAC-SHA256 over the raw request body, compared in constant time.
- **Idempotency:** A unique constraint on `event_id`, so duplicate deliveries never create a second record.
- **Background processing:** Events are saved and queued, so the response is fast.
- **Retries:** Four attempts with exponential backoff (2s, 4s, 8s). Only the final failure marks an event `failed`.
- **Status tracking:** Every event moves through `pending`, `processing`, `completed`, or `failed`.
- **Monitoring:** Stats by status, listing with filters, and a manual retry endpoint.
- **Auth:** Registration and login with bcrypt and JWT. Monitoring routes require a token.
- **Docs and validation:** Swagger at `/api/docs`, with DTO validation on every request.
- **Migrations:** TypeORM migrations, with `synchronize` turned off.

## Tech stack

NestJS, TypeScript, PostgreSQL, TypeORM, Redis, BullMQ, Passport JWT, class-validator, Swagger.

## Setup

Requirements: Node.js 20+, PostgreSQL 16+, Redis 7+.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_NAME=eventflow

   JWT_SECRET=your_long_random_secret
   JWT_EXPIRES_IN=1d

   WEBHOOK_SECRET=your_webhook_secret

   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

   Generate secrets with `openssl rand -hex 32`. Never commit `.env`.

3. Create the database, start Redis, and run migrations:

   ```bash
   sudo -u postgres psql -c "CREATE DATABASE eventflow;"
   sudo service redis-server start
   npm run migration:run
   ```

4. Start the server:

   ```bash
   npm run start:dev
   ```

The API runs at `http://localhost:3000` and the docs at `http://localhost:3000/api/docs`.

## Endpoints

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | No | Create an account |
| POST | `/auth/login` | No | Log in and get a JWT |
| GET | `/auth/profile` | JWT | Get the current user |
| POST | `/webhooks/events` | Signature | Receive an event |
| GET | `/events` | JWT | List events, optionally `?status=failed` |
| GET | `/events/stats` | JWT | Count events by status |
| GET | `/events/:id` | JWT | Get one event |
| POST | `/events/:id/retry` | JWT | Requeue a failed event |

## Sending a signed webhook

Sign the exact request body with HMAC-SHA256 using `WEBHOOK_SECRET`, and send the hex digest in the `x-webhook-signature` header:

```bash
body='{"eventId":"evt_001","type":"payment.success","data":{"customerId":"cus_123","amount":5000,"currency":"NGN"}}'
secret=$(grep '^WEBHOOK_SECRET=' .env | cut -d= -f2-)
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}')

curl -X POST http://localhost:3000/webhooks/events \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $sig" \
  -d "$body"
```

Sending the same event again returns `202` with `"duplicate": true` and creates no new record.

## Design decisions

- **Queue:** Processing inside the request would slow the response and could trigger provider retries that cause duplicate work. Saving and queuing keeps the endpoint fast.
- **Unique constraint:** Two identical deliveries can arrive at the same moment, and an application-level check can race. The database constraint is the final guarantee.
- **Retries with backoff:** Many failures are temporary. Backoff gives the failing service time to recover.
- **Raw body signing:** Re-serializing parsed JSON can change the bytes, which breaks the signature. Verifying the exact bytes avoids that.
- **Migrations:** Schema changes are explicit, reviewable files, applied the same way in every environment.

## Testing

Tested manually with `curl` and Swagger. Automated Jest tests are the next planned step.

## License

MIT