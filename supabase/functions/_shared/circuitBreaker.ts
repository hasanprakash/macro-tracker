export interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold?: number;      // default: 3 consecutive failures
  cooldownPeriodSeconds?: number; // default: 30 seconds
  redis?: any;
}

export class CircuitBreaker {
  private serviceName: string;
  private failureThreshold: number;
  private cooldownPeriodMs: number;
  private redisKey: string;
  private redis: any;

  // In-memory state for sub-millisecond execution within the isolate
  private localState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private localOpenedAt: number = 0;
  private localFailures: number = 0;
  private probeInFlight: boolean = false;

  constructor(config: CircuitBreakerConfig) {
    this.serviceName = config.serviceName;
    this.failureThreshold = config.failureThreshold || 3;
    this.cooldownPeriodMs = (config.cooldownPeriodSeconds || 30) * 1000;
    this.redisKey = `circuit:${this.serviceName}:state`;
    this.redis = config.redis;
  }

  async check(): Promise<{ allowed: boolean; isProbe: boolean; errorResponse?: { error: string; circuit_open: boolean; retry_after_seconds: number } }> {
    const now = Date.now();

    // 1. Sync from Redis if available
    let remoteState: any = null;
    if (this.redis) {
      try {
        const val = await this.redis.get(this.redisKey);
        if (val) {
          remoteState = typeof val === 'string' ? JSON.parse(val) : val;
        }
      } catch (e) {
        console.warn(`[CircuitBreaker] Redis read failed for ${this.serviceName}:`, e);
      }
    }

    if (remoteState && remoteState.state === 'OPEN') {
      this.localState = 'OPEN';
      this.localOpenedAt = remoteState.opened_at || now;
    } else if (!remoteState && this.localState === 'OPEN') {
      // Remote expired or cleared -> transition to HALF_OPEN
      this.localState = 'HALF_OPEN';
    }

    // 2. Evaluate State
    if (this.localState === 'OPEN') {
      const elapsed = now - this.localOpenedAt;
      if (elapsed >= this.cooldownPeriodMs) {
        // Cooldown expired -> Transition to HALF_OPEN (Hybrid Probe State)
        this.localState = 'HALF_OPEN';
        this.probeInFlight = true;
        console.log(`[CircuitBreaker] [${this.serviceName}] Cooldown expired (${Math.round(elapsed/1000)}s). Entering HALF-OPEN probe state.`);
        return { allowed: true, isProbe: true };
      } else {
        // Still in cooldown -> Fail fast in 0ms!
        const retryAfter = Math.ceil((this.cooldownPeriodMs - elapsed) / 1000);
        return {
          allowed: false,
          isProbe: false,
          errorResponse: {
            error: "AI estimation is temporarily experiencing high demand. Please use Quick Add or retry in 30s.",
            circuit_open: true,
            retry_after_seconds: retryAfter,
          }
        };
      }
    }

    if (this.localState === 'HALF_OPEN') {
      if (!this.probeInFlight) {
        this.probeInFlight = true;
        console.log(`[CircuitBreaker] [${this.serviceName}] Dispatching HALF-OPEN probe request.`);
        return { allowed: true, isProbe: true };
      } else {
        // Probe is already in flight, fail-fast this request
        return {
          allowed: false,
          isProbe: false,
          errorResponse: {
            error: "AI estimation is temporarily experiencing high demand. Please use Quick Add or retry in 30s.",
            circuit_open: true,
            retry_after_seconds: 5,
          }
        };
      }
    }

    // CLOSED state: normal flow
    return { allowed: true, isProbe: false };
  }

  async recordSuccess() {
    this.probeInFlight = false;
    if (this.localState !== 'CLOSED' || this.localFailures > 0) {
      console.log(`[CircuitBreaker] [${this.serviceName}] Remote call succeeded. Circuit transitioned to CLOSED.`);
      this.localState = 'CLOSED';
      this.localFailures = 0;
      this.localOpenedAt = 0;
      if (this.redis) {
        try {
          await this.redis.del(this.redisKey);
        } catch (e) {}
      }
    }
  }

  async recordFailure(status?: number, errorMessage?: string) {
    this.probeInFlight = false;
    const now = Date.now();

    // Only upstream outages (500, 502, 503, 504, 429, timeouts) trip the breaker
    const isOutage = !status || status >= 500 || status === 429;
    if (!isOutage) return;

    if (this.localState === 'HALF_OPEN') {
      // Probe failed! Immediately trip back to OPEN
      console.warn(`[CircuitBreaker] [${this.serviceName}] Probe failed (${status || 'error'}). Tripping back to OPEN.`);
      this.localState = 'OPEN';
      this.localOpenedAt = now;
      if (this.redis) {
        try {
          await this.redis.set(this.redisKey, JSON.stringify({ state: 'OPEN', opened_at: now }), { ex: 35 });
        } catch (e) {}
      }
      return;
    }

    // CLOSED state
    this.localFailures += 1;
    console.warn(`[CircuitBreaker] [${this.serviceName}] Consecutive failure #${this.localFailures} (${status || 'error'}: ${errorMessage || ''})`);

    if (this.localFailures >= this.failureThreshold) {
      console.error(`[CircuitBreaker] [${this.serviceName}] Failure threshold (${this.failureThreshold}) reached. Tripping circuit to OPEN for 30s!`);
      this.localState = 'OPEN';
      this.localOpenedAt = now;
      if (this.redis) {
        try {
          await this.redis.set(this.redisKey, JSON.stringify({ state: 'OPEN', opened_at: now }), { ex: 35 });
        } catch (e) {}
      }
    }
  }
}
