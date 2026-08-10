package com.syncstream.hub.config;

import com.syncstream.hub.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Collections;
import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider tokenProvider;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable simple in-memory broker for public topics and personal user channels
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Native WebSocket and SockJS endpoint on /ws
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");

        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Dedicated SockJS fallback endpoint on /ws-sockjs
        registry.addEndpoint("/ws-sockjs")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    List<String> authorization = accessor.getNativeHeader("Authorization");
                    if (authorization != null && !authorization.isEmpty()) {
                        String bearerToken = authorization.get(0);
                        if (bearerToken.startsWith("Bearer ")) {
                            String token = bearerToken.substring(7);
                            if (tokenProvider.validateToken(token)) {
                                Long userId = tokenProvider.getUserIdFromToken(token);
                                String username = tokenProvider.getUsernameFromToken(token);
                                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                        username, null, Collections.emptyList());
                                accessor.setUser(auth);
                                log.info("Authenticated WebSocket STOMP connection for user: {} (ID: {})", username, userId);
                            }
                        }
                    }
                }
                return message;
            }
        });
    }
}
