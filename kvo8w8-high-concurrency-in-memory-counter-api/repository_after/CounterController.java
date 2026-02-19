package com.example.counter;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/counter")
public class CounterController {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @PostMapping("/increment/{name}")
    public Map<String, Object> increment(@PathVariable String name) {
        Long count = redisTemplate.opsForValue().increment("counter:" + name);
        Long totalKeys = redisTemplate.getConnectionFactory().getConnection().dbSize();
        
        Map<String, Object> response = new HashMap<>();
        response.put("name", name);
        response.put("count", count.intValue());
        response.put("totalKeys", totalKeys.intValue());
        return response;
    }

    @GetMapping("/count/{name}")
    public Map<String, Object> getCount(@PathVariable String name) {
        String value = redisTemplate.opsForValue().get("counter:" + name);
        int count = value != null ? Integer.parseInt(value) : 0;
        
        Map<String, Object> response = new HashMap<>();
        response.put("name", name);
        response.put("count", count);
        return response;
    }
}