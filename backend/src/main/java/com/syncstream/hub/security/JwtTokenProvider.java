package com.syncstream.hub.security;

import com.syncstream.hub.service.TokenRedisService;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
@Slf4j
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long jwtExpirationInMs;
    private final TokenRedisService tokenRedisService;

    public JwtTokenProvider(
            @Value("${app.jwt.secret:SyncStreamHubSuperSecretKeyForJWTAuthTokenGeneration2026!}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long jwtExpirationInMs,
            TokenRedisService tokenRedisService) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.jwtExpirationInMs = jwtExpirationInMs; // Default 86,400,000 ms = 24 hours
        this.tokenRedisService = tokenRedisService;
    }

    public String generateToken(Long userId, String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        String token = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();

        // Register token in Upstash Redis with 24-hour expiration TTL
        if (tokenRedisService != null) {
            tokenRedisService.saveToken(token, userId);
        }

        return token;
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return Long.parseLong(claims.getSubject());
    }

    public Long getUserIdFromTokenSafely(String token) {
        if (!validateToken(token)) {
            return null;
        }
        try {
            return getUserIdFromToken(token);
        } catch (Exception ex) {
            log.error("Failed to parse user ID from token: {}", ex.getMessage());
            return null;
        }
    }

    public String getUsernameFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("username", String.class);
    }

    public boolean validateToken(String authToken) {
        if (authToken == null || authToken.trim().isEmpty()) {
            return false;
        }
        try {
            Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(authToken);

            // Check if active in Upstash Redis
            if (tokenRedisService != null && !tokenRedisService.isTokenActive(authToken)) {
                log.warn("Token signature valid but token is no longer active in Redis (expired or revoked)");
                return false;
            }

            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("JWT token has expired (24h limit reached): {}", ex.getMessage());
            if (tokenRedisService != null) {
                tokenRedisService.deleteToken(authToken);
            }
        } catch (JwtException ex) {
            log.error("Invalid JWT token signature/claims: {}", ex.getMessage());
        } catch (IllegalArgumentException ex) {
            log.error("JWT claims string is empty: {}", ex.getMessage());
        }
        return false;
    }

    public void invalidateToken(String token) {
        if (tokenRedisService != null && token != null) {
            tokenRedisService.deleteToken(token);
        }
    }
}

