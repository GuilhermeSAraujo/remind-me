import { User } from "../domain/users/user.model";
import { AIOperationType } from "../shared/types/ai.types";

// Token estimates per operation type
const TOKENS_PER_OPERATION: Record<AIOperationType, number> = {
    classify: 100,        // ~50-150 tokens
    extract: 300,         // ~200-400 tokens
    identify_delay: 50,   // ~50 tokens
};

// Rate limit configuration
const RATE_LIMITS = {
    // Free tier: 5 requests in 24 hours
    FREE_REQUESTS_PER_24H: 5,

    // Maximum tokens in 24h for free tier
    MAX_TOKENS_FREE_24H: 2500,   // Roughly ~5-10 requests

    // Sliding window
    WINDOW_HOURS: 24,
};

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    totalUsed: number;
    resetIn: number; // milliseconds until oldest entry expires
    isPremium: boolean;
    message?: string;
}

export async function checkRateLimit(
    phoneNumber: string,
    operation: AIOperationType
): Promise<RateLimitResult> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new Error("User not found");
    }

    // Premium users: unlimited access
    if (user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt > new Date()) {
        return {
            allowed: true,
            remaining: -1, // Unlimited
            totalUsed: 0,
            resetIn: 0,
            isPremium: true,
        };
    }

    // Calculate sliding window (last 24 hours)
    const now = new Date();
    const windowStart = new Date(now.getTime() - (RATE_LIMITS.WINDOW_HOURS * 60 * 60 * 1000));

    // Filter tokens within the sliding window
    const recentTokens = user.aiUsage.tokens.filter(
        token => new Date(token.timestamp) > windowStart
    );

    // Calculate total tokens used in last 24h
    const totalTokensUsed = recentTokens.reduce((sum, token) => sum + token.count, 0);
    const totalRequests = recentTokens.length;

    // Estimate tokens for this operation
    const estimatedTokens = TOKENS_PER_OPERATION[operation] || 1;

    // Check both request count and token limits
    const wouldExceedRequests = totalRequests >= RATE_LIMITS.FREE_REQUESTS_PER_24H;
    const wouldExceedTokens = (totalTokensUsed + estimatedTokens) > RATE_LIMITS.MAX_TOKENS_FREE_24H;

    // Find when the oldest entry will expire
    let resetIn = RATE_LIMITS.WINDOW_HOURS * 60 * 60 * 1000;
    if (recentTokens.length > 0) {
        const oldestTimestamp = Math.min(...recentTokens.map(t => new Date(t.timestamp).getTime()));
        resetIn = (oldestTimestamp + (RATE_LIMITS.WINDOW_HOURS * 60 * 60 * 1000)) - now.getTime();
    }

    if (wouldExceedRequests || wouldExceedTokens) {
        return {
            allowed: false,
            remaining: 0,
            totalUsed: totalTokensUsed,
            resetIn: Math.max(0, resetIn),
            isPremium: false,
            message: wouldExceedTokens
                ? 'Token limit exceeded'
                : 'Request limit exceeded',
        };
    }

    return {
        allowed: true,
        remaining: RATE_LIMITS.FREE_REQUESTS_PER_24H - totalRequests - 1,
        totalUsed: totalTokensUsed,
        resetIn: Math.max(0, resetIn),
        isPremium: false,
    };
}

/**
 * Record AI usage after successful request
 */
export async function recordAIUsage(
    phoneNumber: string,
    operation: AIOperationType,
    actualTokens?: number
): Promise<void> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new Error("User not found");
    }

    // Use actual tokens if provided, otherwise use estimate
    const tokenCount = actualTokens ?? TOKENS_PER_OPERATION[operation];

    // Add new usage record
    user.aiUsage.tokens.push({
        timestamp: new Date(),
        count: tokenCount,
        operation,
    });

    // Clean up old entries (older than 24h + 1h buffer for safety)
    const cleanupTime = new Date(Date.now() - ((RATE_LIMITS.WINDOW_HOURS + 1) * 60 * 60 * 1000));
    user.aiUsage.tokens = user.aiUsage.tokens.filter(
        token => new Date(token.timestamp) > cleanupTime
    );

    // Update cached total
    const windowStart = new Date(Date.now() - (RATE_LIMITS.WINDOW_HOURS * 60 * 60 * 1000));
    user.aiUsage.totalTokensLast24h = user.aiUsage.tokens
        .filter(token => new Date(token.timestamp) > windowStart)
        .reduce((sum, token) => sum + token.count, 0);

    await user.save();
}

/**
 * Get user's current usage statistics
 */
export async function getUserUsageStats(phoneNumber: string): Promise<{
    requestsLast24h: number;
    tokensLast24h: number;
    requestsRemaining: number;
    isPremium: boolean;
}> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
        throw new Error("User not found");
    }

    // Premium check
    const isPremium = user.isPremium &&
        user.premiumExpiresAt &&
        user.premiumExpiresAt > new Date();

    if (isPremium) {
        return {
            requestsLast24h: 0,
            tokensLast24h: 0,
            requestsRemaining: -1,
            isPremium: true,
        };
    }

    // Calculate sliding window
    const windowStart = new Date(Date.now() - (RATE_LIMITS.WINDOW_HOURS * 60 * 60 * 1000));
    const recentTokens = user.aiUsage.tokens.filter(
        token => new Date(token.timestamp) > windowStart
    );

    const requestsLast24h = recentTokens.length;
    const tokensLast24h = recentTokens.reduce((sum, token) => sum + token.count, 0);
    const requestsRemaining = Math.max(0, RATE_LIMITS.FREE_REQUESTS_PER_24H - requestsLast24h);

    return {
        requestsLast24h,
        tokensLast24h,
        requestsRemaining,
        isPremium: false,
    };
}

export { RATE_LIMITS };

