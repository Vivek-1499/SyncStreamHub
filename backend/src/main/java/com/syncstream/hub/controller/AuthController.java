package com.syncstream.hub.controller;

import com.syncstream.hub.model.dto.AuthResponse;
import com.syncstream.hub.model.dto.LoginRequest;
import com.syncstream.hub.model.dto.RegisterRequest;
import com.syncstream.hub.model.dto.UserDto;
import com.syncstream.hub.model.jpa.User;
import com.syncstream.hub.repository.jpa.UserRepository;
import com.syncstream.hub.security.JwtTokenProvider;
import com.syncstream.hub.util.PasswordUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;

    /**
     * Registers a new user with BCrypt password hashing and returns JWT token.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest request) {
        log.info("Request to register user: {}", request.getUsername());

        if (userRepository.existsByUsername(request.getUsername())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Username '" + request.getUsername() + "' is already taken."));
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Email '" + request.getEmail() + "' is already registered."));
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(PasswordUtils.hashPassword(request.getPassword()))
                .build();

        User savedUser = userRepository.save(user);
        log.info("User registered successfully: {}", savedUser.getUsername());

        String token = tokenProvider.generateToken(savedUser.getId(), savedUser.getUsername());
        UserDto userDto = UserDto.builder()
                .id(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .createdAt(savedUser.getCreatedAt())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(AuthResponse.builder()
                        .token(token)
                        .tokenType("Bearer")
                        .user(userDto)
                        .build());
    }

    /**
     * Logins user, verifies BCrypt/legacy hash, and returns JWT token.
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest request) {
        log.info("Request to login user: {}", request.getUsername());

        return userRepository.findByUsername(request.getUsername())
                .map(user -> {
                    if (PasswordUtils.matches(request.getPassword(), user.getPasswordHash())) {
                        // Re-hash with BCrypt if old legacy hash was used
                        if (!user.getPasswordHash().startsWith("$2a$")) {
                            user.setPasswordHash(PasswordUtils.hashPassword(request.getPassword()));
                            userRepository.save(user);
                        }

                        log.info("User logged in successfully: {}", user.getUsername());
                        String token = tokenProvider.generateToken(user.getId(), user.getUsername());
                        UserDto userDto = UserDto.builder()
                                .id(user.getId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .createdAt(user.getCreatedAt())
                                .build();

                        return ResponseEntity.ok(AuthResponse.builder()
                                .token(token)
                                .tokenType("Bearer")
                                .user(userDto)
                                .build());
                    } else {
                        log.warn("Invalid password for user: {}", request.getUsername());
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body(Map.of("message", "Invalid username or password."));
                    }
                })
                .orElseGet(() -> {
                    log.warn("Username not found: {}", request.getUsername());
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(Map.of("message", "Invalid username or password."));
                });
    }

    /**
     * Validates an existing token.
     */
    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader("Authorization") String bearerToken) {
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            String token = bearerToken.substring(7);
            if (tokenProvider.validateToken(token)) {
                Long userId = tokenProvider.getUserIdFromTokenSafely(token);
                if (userId != null) {
                    return userRepository.findById(userId)
                            .map(user -> {
                                UserDto userDto = UserDto.builder()
                                        .id(user.getId())
                                        .username(user.getUsername())
                                        .email(user.getEmail())
                                        .createdAt(user.getCreatedAt())
                                        .build();
                                return ResponseEntity.ok(Map.of("valid", true, "user", userDto));
                            })
                            .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                    .body(Map.of("valid", false, "message", "User not found.")));
                }
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("valid", false, "message", "Token expired or invalid."));
    }

    /**
     * Logs out user and invalidates token in Upstash Redis.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser(@RequestHeader(value = "Authorization", required = false) String bearerToken) {
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            String token = bearerToken.substring(7);
            tokenProvider.invalidateToken(token);
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully."));
    }
}

