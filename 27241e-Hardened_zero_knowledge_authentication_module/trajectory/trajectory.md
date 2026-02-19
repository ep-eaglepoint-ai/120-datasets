### Trajectory (Thinking Process for Security Hardening)

**1. Audit the Original Code (Identify Security Vulnerabilities)**
I audited the original `insecure_auth.js` file and identified critical, high-risk security flaws and constraint violations. The script stored passwords in plain text, used a non-constant-time comparison vulnerable to timing attacks, and utilized forbidden data structures (`{}` and `[]`) that exposed it to prototype pollution.

Learn about the constant-time comparison problem and why it’s a critical security risk:

- **Resource**: Simon Willison's explanation of constant-time string comparison.
- **Link**: [https://til.simonwillison.net/node/constant-time-compare-strings](https://til.simonwillison.net/node/constant-time-compare-strings)

**2. Define a Security Contract First**
I established a strict contract based on the prompt's requirements:

- **Zero-Knowledge**: Passwords must never be stored. Only salted hashes are permissible.
- **Cryptographic Primitives**: Must exclusively use the `SubtleCrypto` API for hashing.
- **Timing Attack Resistance**: Authentication checks must use a constant-time comparison.
- **Prototype Pollution Prevention**: User objects must be created with `Object.create(null)`.
- **Data Structure Compliance**: The user collection must be a `Map` or `Set`, not an `Array`.

**3. Rework the Data Structures for Security and Compliance**
I replaced the vulnerable data structures. The `USERS` array was replaced with a `const USER_STORE = new Map()` for efficient, key-based lookups and to meet the project constraints. All user objects (`userRecord`) are now created using `Object.create(null)` to eliminate the prototype chain and are frozen with `Object.freeze()` to ensure immutability.

**4. Rebuild the Registration Logic with Zero-Knowledge Hashing**
I completely removed the plain-text password storage. The new `registerUser` function implements a "hash-and-salt" strategy. For reproducibility as required by the task, a deterministic (insecure) seed is used to generate the salt. The password and salt are then processed by `generateSaltedHash`, which uses the required `SHA-256` algorithm from `SubtleCrypto`.

Learn more about the `SubtleCrypto` API for secure hashing operations in JavaScript:

- **Resource**: MDN Web Docs for `SubtleCrypto.digest`.
- **Link**: [https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)

**5. Replace the Authentication Check with a Native, Timing-Safe Method**
The original, unsafe `===` comparison was eliminated. Instead of a custom-built comparison function, I now use `timingSafeEqual` imported directly from Node.js's native `crypto` module. This method is a battle-tested, C++ backed implementation designed specifically to prevent timing attacks, making it a more robust and secure choice than a hand-rolled JavaScript version.

**6. Result: A Hardened, Compliant, and Verifiable Module**
The final solution successfully meets all security and structural requirements.

- It exhibits **Zero-Knowledge** properties by never storing passwords.
- It is protected against **timing attacks** by using a native, constant-time comparison function.
- It is hardened against **prototype pollution** by using prototype-less objects.
- It fully adheres to all **code pattern constraints** mandated by the prompt.
- The use of a deterministic seed for the salt, while insecure for production, ensures the module's output is **reproducible** for this specific task.
