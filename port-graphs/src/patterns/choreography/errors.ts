import { Gadget } from "../../core";

/**
 * Error handling for choreographies
 *
 * Defines error effects and propagation mechanisms
 */

// Error effect types
export type ChoreographyError =
  | { participantError: { role: string; error: any } }
  | { participantTimeout: { role: string; operation: string } }
  | { participantDisconnected: { role: string } }
  | { invalidMessage: { from: string; message: any } }
  | { protocolViolation: { role: string; expected: string; received: string } }
  | { choreographyFailed: { reason: string; state: any } };

// Success effect types
export type ChoreographySuccess =
  | { participantReady: { role: string } }
  | { participantCompleted: { role: string; result: any } }
  | { protocolCompleted: { result: any } }
  | { phaseCompleted: { phase: string } };

// Combined lifecycle effects
export type ChoreographyEffect = ChoreographyError | ChoreographySuccess;

/**
 * Error handler gadget
 *
 * Receives error effects and decides on recovery strategy
 */
export function createErrorHandler() {
  return (state: {
    errors: ChoreographyError[];
    retries: Record<string, number>;
    maxRetries: number;
  }) => ({
    receive(error: ChoreographyError) {
      if ('participantError' in error) {
        const { role } = error.participantError;
        const retries = state.retries[role] || 0;

        if (retries < state.maxRetries) {
          // Retry the participant
          state.retries[role] = retries + 1;
          return { retry: { role, attempt: retries + 1 } };
        } else {
          // Give up and fail the choreography
          return { fail: { role, reason: 'max-retries-exceeded' } };
        }
      }

      if ('participantTimeout' in error) {
        // Handle timeout - maybe extend deadline or fail
        return { timeout: error.participantTimeout };
      }

      if ('participantDisconnected' in error) {
        // Try to reconnect or find replacement
        return { replace: { role: error.participantDisconnected.role } };
      }

      // Store error for analysis
      state.errors.push(error);
      return { logged: error };
    }
  });
}

/**
 * Timeout monitor
 *
 * Tracks participant operations and emits timeout errors
 */
export function createTimeoutMonitor(timeoutMs: number = 5000) {
  const timers: Record<string, NodeJS.Timeout> = {};

  return {
    startTimer(role: string, operation: string, onTimeout: () => void) {
      this.clearTimer(role);
      timers[role] = setTimeout(() => {
        onTimeout();
        delete timers[role];
      }, timeoutMs);
    },

    clearTimer(role: string) {
      if (timers[role]) {
        clearTimeout(timers[role]);
        delete timers[role];
      }
    },

    clearAll() {
      Object.values(timers).forEach(timer => clearTimeout(timer));
      Object.keys(timers).forEach(key => delete timers[key]);
    }
  };
}

/**
 * Health monitor
 *
 * Sends heartbeats and detects failures
 */
export function createHealthMonitor(
  participants: Record<string, Gadget>,
  intervalMs: number = 1000
) {
  const health: Record<string, {
    lastSeen: number;
    alive: boolean;
  }> = {};

  // Initialize health records
  Object.keys(participants).forEach(role => {
    health[role] = { lastSeen: Date.now(), alive: true };
  });

  const checkHealth = () => {
    const now = Date.now();
    const deadlineMs = intervalMs * 3; // Miss 3 heartbeats = dead

    const failures: string[] = [];

    Object.entries(health).forEach(([role, status]) => {
      if (status.alive && (now - status.lastSeen) > deadlineMs) {
        status.alive = false;
        failures.push(role);
      }
    });

    return failures;
  };

  const recordHeartbeat = (role: string) => {
    if (health[role]) {
      health[role].lastSeen = Date.now();
      health[role].alive = true;
    }
  };

  return {
    health,
    checkHealth,
    recordHeartbeat,

    start(onFailure: (role: string) => void) {
      const interval = setInterval(() => {
        const failures = checkHealth();
        failures.forEach(onFailure);
      }, intervalMs);

      return () => clearInterval(interval);
    }
  };
}