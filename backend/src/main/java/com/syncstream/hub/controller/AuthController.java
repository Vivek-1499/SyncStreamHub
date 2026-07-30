package com.syncstream.hub.controller;

import com.syncstream.hub.model.dto.LoginRequest;
import com.syncstream.hub.model.dto.RegisterRequest;
import com.syncstream.hub.model.jpa.User;
import com.syncstream.hub.repository.jpa.UserRepository;
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

    /**
     * Registers a new user. Checks for existing emails/usernames in PostgreSQL.
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
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    /**
     * Logins user. Checks against the hashed password stored in PostgreSQL.
     */
    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest request) {
        log.info("Request to login user: {}", request.getUsername());

        return userRepository.findByUsername(request.getUsername())
                .map(user -> {
                    String hashedInput = PasswordUtils.hashPassword(request.getPassword());
                    if (user.getPasswordHash().equals(hashedInput)) {
                        log.info("User logged in successfully: {}", user.getUsername());
                        return ResponseEntity.ok(user);
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
}
