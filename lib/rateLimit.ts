// Simple in-memory rate limiter (resets on server restart)
// For production, consider Vercel KV or Edge Config

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 3600000 // 1 hour
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || now > entry.resetTime) {
    // New entry or expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    })
    return { allowed: true }
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    }
  }

  entry.count++
  return { allowed: true }
}

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean every minute
}

