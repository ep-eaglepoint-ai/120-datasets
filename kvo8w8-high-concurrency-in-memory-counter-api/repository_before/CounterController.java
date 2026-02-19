package com.example.counter;

import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/counter")
public class CounterController {

    private final Map<String, Integer> counters = new HashMap<>();

    @PostMapping("/increment/{name}")
    public Map<String, Object> increment(@PathVariable String name) {
        Integer current = counters.get(name);
        if (current == null) {
            counters.put(name, 1);
        } else {
            counters.put(name, current + 1);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("name", name);
        response.put("count", counters.get(name));
        response.put("totalKeys", counters.size());
        return response;
    }

    @GetMapping("/count/{name}")
    public Map<String, Object> getCount(@PathVariable String name) {
        Map<String, Object> response = new HashMap<>();
        response.put("name", name);
        response.put("count", counters.getOrDefault(name, 0));
        return response;
    }
}
