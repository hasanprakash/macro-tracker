1. Each user is having the rate limits:

- log-meal - 10 requests / minute, 30 requests / day
- scan-food - 3 requests / minute, 6 requests / day
- log-exercise - 3 requests / minute, 6 requests / day
- TODO: global limits, to prevent the sybil attack with multiple fake users.

2. Idempotency key will be used for each request to avoid duplicate requests.

3. Upstash Redis follows requests fail open rather than breaking the application.

4. What about Cache?

5. What about Database Indicing?

6. What about Circuit Breaker?

7. Anything else I am missing?

8. Validate request size/input early?

Right now I have rate limiting for gemini api calls on scan-food and log-exercise edge functions, but if we are making a call to DB before that, we are not rate limiting it. Is that a problem?

Should I give the user exact time when they can retry for hiting the rate limiting?
