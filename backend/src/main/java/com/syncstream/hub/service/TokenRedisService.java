package com.syncstream.hub.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class TokenRedisService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String TOKEN_KEY_PREFIX = "auth:token:";
    private static final long TOKEN_TTL_HOURS = 24;

    private String getRedisKey(String token) {
        return TOKEN_KEY_PREFIX + token;
    }

    /**
     * Stores an active user token in Upstash Redis with a 24-hour TTL.
     * When 24 hours elapse, Redis automatically purges/deletes the token key.
     */
    public void saveToken(String token, Long userId) {
        if (token == null || userId == null) return;
        try {
            String key = getRedisKey(token);
            redisTemplate.opsForValue().set(key, String.valueOf(userId), TOKEN_TTL_HOURS, TimeUnit.HOURS);
            log.info("Registered token in Upstash Redis for userId: {} (TTL: {}h)", userId, TOKEN_TTL_HOURS);
        } catch (Exception e) {
            log.error("Failed to store token in Redis: {}", e.getMessage());
        }
    }

    /**
     * Checks if a token is registered as active in Redis.
     * If Redis is unreachable, falls back to true (so JWT validation handles it).
     */
    public boolean isTokenActive(String token) {
        if (token == null) return false;
        try {
            String key = getRedisKey(token);
            Boolean hasKey = redisTemplate.hasKey(key);
            return Boolean.TRUE.equals(hasKey);
        } catch (Exception e) {
            log.warn("Redis check failed, falling back to JWT claims validation: {}", e.getMessage());
            return true;
        }
    }

    /**
     * Explicitly revokes and deletes a token from Upstash Redis (e.g. on logout).
     */
    public void deleteToken(String token) {
        if (token == null) return;
        try {
            String key = getRedisKey(token);
            redisTemplate.delete(key);
            log.info("Purged token from Upstash Redis on logout");
        } catch (Exception e) {
            log.error("Failed to delete token from Redis: {}", e.getMessage());
        }
    }
}
