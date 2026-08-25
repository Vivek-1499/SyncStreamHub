package com.syncstream.hub.config;

//Configures a custom thread pool (mongoAsyncExecutor) for running @Async methods in the background. It controls the number of threads, queue size, and thread names.

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class AsyncConfig {

    @Bean(name = "mongoAsyncExecutor")
    public Executor mongoAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(15);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("MongoAsync-");
        executor.initialize();
        return executor;
    }
}
