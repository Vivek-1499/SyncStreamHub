package com.syncstream.hub.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
@Slf4j
@ConditionalOnProperty(name = "cloudflare.r2.enabled", havingValue = "true", matchIfMissing = true)
public class R2StorageService {

    private final S3Client s3Client;

    @Value("${cloudflare.r2.bucket-name:syncstream-videos}")
    private String bucketName;

    @Value("${cloudflare.r2.account-id}")
    private String accountId;

    @Value("${cloudflare.r2.public-url:}")
    private String publicUrlPrefix;

    public R2StorageService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    /**
     * Uploads a video file directly to Cloudflare R2 bucket and returns public access URL.
     */
    public String uploadVideo(MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                : ".mp4";
        String storedFilename = UUID.randomUUID() + extension;

        String contentType = file.getContentType() != null ? file.getContentType() : "video/mp4";

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(storedFilename)
                .contentType(contentType)
                .contentLength(file.getSize())
                .build();

        log.info("Uploading video {} ({} bytes) to Cloudflare R2 bucket {}", storedFilename, file.getSize(), bucketName);

        s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        log.info("Successfully uploaded video {} to Cloudflare R2", storedFilename);

        // Construct public streaming URL
        if (publicUrlPrefix != null && !publicUrlPrefix.isBlank() && !publicUrlPrefix.contains("pub-xxxx")) {
            return publicUrlPrefix.endsWith("/") ? publicUrlPrefix + storedFilename : publicUrlPrefix + "/" + storedFilename;
        }

        // Fallback to Cloudflare R2 direct S3 object URL
        return String.format("https://%s.r2.cloudflarestorage.com/%s/%s", accountId, bucketName, storedFilename);
    }
}
