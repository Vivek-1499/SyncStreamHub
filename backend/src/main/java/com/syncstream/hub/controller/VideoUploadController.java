package com.syncstream.hub.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
@Slf4j
public class VideoUploadController {

    private final Path uploadDir = Paths.get("uploaded-videos");

    public VideoUploadController() throws IOException {
        Files.createDirectories(uploadDir);
    }

    @PostMapping("/video")
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file provided."));
        }

        try {
            String originalName = file.getOriginalFilename();
            String extension = originalName != null && originalName.contains(".")
                    ? originalName.substring(originalName.lastIndexOf('.'))
                    : "";
            String storedName = UUID.randomUUID() + extension;
            Path target = uploadDir.resolve(storedName);

            file.transferTo(target);
            log.info("Stored uploaded video as {}", storedName);

            // This is the real, fetchable URL every browser can use
            String publicUrl = "http://localhost:8080/uploads/" + storedName;
            return ResponseEntity.ok(Map.of("url", publicUrl));

        } catch (IOException e) {
            log.error("Failed to store uploaded video", e);
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