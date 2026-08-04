package com.syncstream.hub.controller;

import com.syncstream.hub.service.R2StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
@Slf4j
public class VideoUploadController {

    private final Path uploadDir = Paths.get("uploaded-videos");
    private final Optional<R2StorageService> r2StorageService;

    public VideoUploadController(@Autowired(required = false) R2StorageService r2StorageService) throws IOException {
        this.r2StorageService = Optional.ofNullable(r2StorageService);
        Files.createDirectories(uploadDir);
    }

    @PostMapping("/video")
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));
        }

        // Strategy 1: Upload to Cloudflare R2 if configured
        if (r2StorageService.isPresent()) {
            try {
                log.info("Uploading file '{}' via Cloudflare R2 Service", file.getOriginalFilename());
                String publicUrl = r2StorageService.get().uploadVideo(file);
                return ResponseEntity.ok(Map.of("url", publicUrl, "provider", "cloudflare-r2"));
            } catch (Exception e) {
                log.error("Cloudflare R2 upload failed, falling back to local storage", e);
            }
        }

        // Strategy 2: Local Disk Fallback
        try {
            String originalName = file.getOriginalFilename();
            String extension = originalName != null && originalName.contains(".")
                    ? originalName.substring(originalName.lastIndexOf('.'))
                    : ".mp4";
            String storedName = UUID.randomUUID() + extension;
            Path target = uploadDir.resolve(storedName);

            file.transferTo(target);
            log.info("Stored uploaded video locally as {}", storedName);

            String publicUrl = "http://localhost:8080/uploads/" + storedName;
            return ResponseEntity.ok(Map.of("url", publicUrl, "provider", "local-disk"));

        } catch (IOException e) {
            log.error("Failed to store uploaded video locally", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "Failed to store video."));
        }
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<?> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException exc) {
        log.warn("File upload size exceeded limit: {}", exc.getMessage());
        return ResponseEntity.status(413)
                .body(Map.of("message", "File is too large! Maximum allowed upload size is 2GB."));
    }
}