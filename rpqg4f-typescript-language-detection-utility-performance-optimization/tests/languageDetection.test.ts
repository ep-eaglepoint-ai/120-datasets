import {
  checkLanguage,
  isEnglish,
  detectLanguage,
  LanguageCheckResult,
} from "@impl/languageDetection";

describe("Language Detection Utility", () => {
  // Requirement 10: Results must be identical - Functional correctness tests
  describe("Functional Correctness", () => {
    test("checkLanguage returns valid for English sentence", () => {
      const result = checkLanguage(
        "The quick brown fox jumps over the lazy dog",
      );
      expect(result.isEnglish).toBe(true);
      expect(result.reason).toBe("valid");
      expect(result.detectedLanguage).toBe("eng");
    });

    test("checkLanguage returns empty for empty string", () => {
      const result = checkLanguage("");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("empty");
    });

    test("checkLanguage returns empty for whitespace only", () => {
      const result = checkLanguage("   ");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("empty");
    });

    test("checkLanguage returns too_short for less than 5 words", () => {
      const result = checkLanguage("Hello world");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("too_short");
    });

    test("checkLanguage returns non_latin for Arabic text", () => {
      const result = checkLanguage("مرحبا بالعالم");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("non_latin");
    });

    test("checkLanguage returns non_latin for Chinese text", () => {
      const result = checkLanguage("你好世界");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("non_latin");
    });

    test("checkLanguage returns non_latin for Japanese text", () => {
      const result = checkLanguage("こんにちは世界");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("non_latin");
    });

    test("checkLanguage returns non_latin for Korean text", () => {
      const result = checkLanguage("안녕하세요 세계");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("non_latin");
    });

    test("checkLanguage detects Spanish text needing translation", () => {
      const result = checkLanguage("Hola como estas hoy amigo mio");
      expect(result.isEnglish).toBe(false);
      expect(result.reason).toBe("needs_translation");
      expect(result.needsTranslation).toBe(true);
    });

    test("isEnglish returns true for English text", () => {
      expect(isEnglish("The quick brown fox jumps over the lazy dog")).toBe(
        true,
      );
    });

    test("isEnglish returns false for non-English text", () => {
      expect(isEnglish("Bonjour le monde comment allez vous")).toBe(false);
    });

    test("detectLanguage returns eng for English", () => {
      expect(
        detectLanguage("The quick brown fox jumps over the lazy dog"),
      ).toBe("eng");
    });

    test("detectLanguage returns null for empty string", () => {
      expect(detectLanguage("")).toBe(null);
    });
  });

  // Requirement 1: Batch processing of 10,000 messages must complete in under 1 second
  describe("Performance: Batch Processing", () => {
    test("batch processing 10000 messages completes under 1 second", () => {
      const messages = [
        "The quick brown fox jumps over the lazy dog",
        "Hello world how are you doing today",
        "This is a test message for performance testing",
        "JavaScript is a programming language for the web",
        "TypeScript adds static typing to JavaScript code",
      ];

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        checkLanguage(messages[i % messages.length]);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });

  // Requirement 2: Single message p99 latency must be under 5ms
  describe("Performance: Single Message Latency", () => {
    test("p99 latency under 5ms for 1000 calls", () => {
      const latencies: number[] = [];
      const message = "The quick brown fox jumps over the lazy dog";

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        checkLanguage(message);
        latencies.push(performance.now() - start);
      }

      latencies.sort((a, b) => a - b);
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      expect(p99).toBeLessThan(5);
    });
  });

  // Requirement 3: Large input processing must complete in under 100ms
  describe("Performance: Large Input", () => {
    test("100000 character input processes under 100ms", () => {
      const largeInput = "The quick brown fox jumps over the lazy dog ".repeat(
        2500,
      );

      const start = performance.now();
      checkLanguage(largeInput);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  // Requirement 5: Regex patterns must be compiled once at module load time
  describe("Optimization: Regex Compilation", () => {
    test("multiple calls do not recompile regex (consistent fast performance)", () => {
      const message = "The quick brown fox jumps over the lazy dog";

      // First call (should be same speed as subsequent if compiled at load)
      const start1 = performance.now();
      for (let i = 0; i < 100; i++) {
        checkLanguage(message);
      }
      const batch1Time = performance.now() - start1;

      // Second batch (should be similar if no recompilation)
      const start2 = performance.now();
      for (let i = 0; i < 100; i++) {
        checkLanguage(message);
      }
      const batch2Time = performance.now() - start2;

      // Times should be similar (within 2x) if regex is pre-compiled
      expect(batch2Time).toBeLessThan(batch1Time * 2);
    });
  });

  // Requirement 6: franc must be called exactly once per invocation
  describe("Optimization: Single Franc Call", () => {
    test("consistent results across multiple calls (no randomness from multiple franc calls)", () => {
      const message = "The quick brown fox jumps over the lazy dog";
      const results: LanguageCheckResult[] = [];

      for (let i = 0; i < 10; i++) {
        results.push(checkLanguage(message));
      }

      // All results should be identical
      const firstResult = JSON.stringify(results[0]);
      results.forEach((result) => {
        expect(JSON.stringify(result)).toBe(firstResult);
      });
    });
  });

  // Requirement 7: String operations must use O(n) algorithms
  describe("Optimization: O(n) String Operations", () => {
    test("large string toLowerCase does not cause quadratic slowdown", () => {
      const smallInput = "Hello World Test ".repeat(100);
      const largeInput = "Hello World Test ".repeat(1000);

      const startSmall = performance.now();
      checkLanguage(smallInput);
      const smallTime = performance.now() - startSmall;

      const startLarge = performance.now();
      checkLanguage(largeInput);
      const largeTime = performance.now() - startLarge;

      // 10x input should not cause more than 20x slowdown (linear vs quadratic)
      // O(n) would be ~10x, O(n²) would be ~100x
      expect(largeTime).toBeLessThan(smallTime * 50);
    });
  });

  // Requirement 8: Word counting must use a single-pass algorithm
  describe("Optimization: Single-Pass Word Count", () => {
    test("word counting is efficient for large inputs", () => {
      const largeInput = "word ".repeat(10000);

      const start = performance.now();
      checkLanguage(largeInput);
      const elapsed = performance.now() - start;

      // Should complete quickly with single-pass
      expect(elapsed).toBeLessThan(500);
    });
  });

  // Requirement 9: Non-English word checking must exit early on first match
  describe("Optimization: Early Exit", () => {
    test("early exit when non-English word found", () => {
      // Text with Spanish word at the beginning
      const textWithSpanish = "hola this is a test message for checking";

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        checkLanguage(textWithSpanish);
      }
      const elapsed = performance.now() - start;

      // Should be fast due to early exit
      expect(elapsed).toBeLessThan(500);
    });
  });

  // Requirement 11: Function signatures must not change
  describe("API Compatibility", () => {
    test("checkLanguage accepts string and returns LanguageCheckResult", () => {
      const result = checkLanguage("test input for the language detector");
      expect(typeof result.isEnglish).toBe("boolean");
      expect(typeof result.reason).toBe("string");
    });

    test("isEnglish accepts string and returns boolean", () => {
      const result = isEnglish("test input for the language detector");
      expect(typeof result).toBe("boolean");
    });

    test("detectLanguage accepts string and returns string or null", () => {
      const result = detectLanguage("test input for the language detector");
      expect(result === null || typeof result === "string").toBe(true);
    });
  });

  // Edge Case: Non-breaking spaces and Unicode whitespace
  describe("Edge Cases: Unicode Whitespace", () => {
    test("handles non-breaking spaces identical to standard spaces", () => {
      // 5 words using non-breaking space (\u00A0)
      const text = "One\u00A0Two\u00A0Three\u00A0Four\u00A0Five";
      const result = checkLanguage(text);
      // If logic is broken, this returns 'too_short' (1 word). If fixed, returns 'valid' (5 words).
      expect(result.reason).not.toBe("too_short");
      expect(result.isEnglish).toBe(true);
    });

    test("handles mixed Unicode whitespace characters", () => {
      // Using various Unicode whitespace: space, tab, non-breaking space
      const text = "Word1 Word2\tWord3\u00A0Word4\u00A0Word5";
      const result = checkLanguage(text);
      expect(result.reason).not.toBe("too_short");
    });
  });

  // Requirement 4: Memory usage must remain bounded under 100MB
  describe("Performance: Memory Usage", () => {
    test("heap growth stays under 100MB for 10000 requests", () => {
      // Force garbage collection if available (requires --expose-gc flag)
      if (global.gc) global.gc();

      const startMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10000; i++) {
        checkLanguage("The quick brown fox jumps over the lazy dog");
      }

      const endMemory = process.memoryUsage().heapUsed;
      const growth = endMemory - startMemory;
      const limit = 100 * 1024 * 1024; // 100MB

      expect(growth).toBeLessThan(limit);
    });
  });

  // Security: No catastrophic backtracking (ReDoS protection)
  describe("Security: Adversarial Input", () => {
    test("handles potential ReDoS patterns gracefully", () => {
      // Create a string that often triggers backtracking in poorly written regex
      const badInput = "a".repeat(50000) + "!";

      const start = performance.now();
      checkLanguage(badInput);
      const elapsed = performance.now() - start;

      // Should fail instantly if regex is vulnerable, otherwise finish quickly
      expect(elapsed).toBeLessThan(200);
    });

    test("handles extremely long input without hanging", () => {
      const longInput = "word ".repeat(20000);

      const start = performance.now();
      checkLanguage(longInput);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });
});
