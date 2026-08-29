---
name: security-master
description: |
  Unified web security skill. Covers threat modeling (STRIDE, PASTA, MITRE ATT&CK), OWASP Top 10:2025,
  ASVS 5.0, Agentic AI security, zero-trust architecture, defense-in-depth, secure code patterns for
  20+ languages, vulnerability assessment, and incident response.
  Use when: code review, security architecture, threat analysis, vulnerability assessment, auth/authz,
  input handling, cryptography, logging, dependency management, or any security question.
  Merges: cybersecurity-analyst + owasp-security (2025 update).
---

# Security Master

Apply security thinking at every layer: architecture, code, operations.

---

## Core Philosophy

**Defense in Depth**: Layer multiple independent controls. Compromise of one layer must not compromise the whole.

**Assume Breach**: Design for detection and minimal blast radius — not just prevention.

**Least Privilege**: Grant only minimum access necessary. Every excess permission is an attack surface.

**Zero Trust**: Never trust, always verify. Authenticate and authorize continuously, regardless of network location.

**Security by Design**: Security cannot be bolted on. It must be architectural from day zero.

**Fail-Closed**: On error, deny — never allow. The safe default is rejection.

**CIA Triad**: Every security decision maps to Confidentiality, Integrity, or Availability.

---

## OWASP Top 10:2025

| # | Vulnerability | Root Cause | Key Prevention |
|---|---------------|------------|----------------|
| A01 | Broken Access Control | Missing or bypassable authz checks (includes SSRF) | Deny by default, server-side enforcement, verify ownership |
| A02 | Security Misconfiguration | Insecure defaults, exposed features, hardened configs skipped | Harden all configs, disable defaults, minimize attack surface |
| A03 | Supply Chain Failures | Compromised build/distribution/update pipeline | Lock versions, verify integrity (SRI/checksums), audit deps |
| A04 | Cryptographic Failures | Weak algorithms, bad key management, plaintext sensitive data | TLS 1.3+, AES-256-GCM, Argon2/bcrypt, proper key management |
| A05 | Injection | Unsanitized input reaches interpreters (SQL, OS, template) | Parameterized queries, allowlist validation, safe APIs |
| A06 | Insecure Design | Missing threat model, no rate limits, no security controls by design | Threat model at design phase, rate limiting, design security controls |
| A07 | Authentication Failures | Weak credentials, broken session, no MFA | MFA, check breached passwords (HaveIBeenPwned), secure sessions |
| A08 | Integrity Failures | Unsigned packages, unsafe deserialization, broken CI/CD | Sign packages, SRI for CDN assets, safe deserialization only |
| A09 | Security Logging & Alerting Failures | Events not logged or not acted upon (name change from 2021) | Log security events with context, structured format, real-time alerting |
| A10 | Mishandling of Exceptional Conditions | **NEW 2025**: fail-open, swallowed exceptions, logical errors under abnormal state | Fail-closed always, log all exceptions with context, test error paths |

> **2025 Changes vs 2021**: A10 is entirely new (replaces standalone SSRF, which moved into A01). A09 renamed to emphasize alerting, not just logging. A03 now explicitly covers supply chain — not just components. Root-cause framing throughout.

---

## Security Code Review Checklist

### Input Handling
- [ ] All user input validated server-side (allowlist preferred over denylist)
- [ ] Parameterized queries everywhere — no string concatenation into SQL/OS/template
- [ ] Input length limits enforced
- [ ] File uploads: validate type, scan content, store outside webroot

### Authentication & Sessions
- [ ] Passwords hashed with Argon2id or bcrypt (cost ≥12) — never MD5/SHA1/SHA256 raw
- [ ] Checked against breached password lists (HaveIBeenPwned API)
- [ ] Session tokens have ≥128 bits of entropy
- [ ] Sessions invalidated server-side on logout and timeout
- [ ] MFA available and enforced for sensitive operations
- [ ] Passkeys/FIDO2 considered for critical paths (2025 best practice)

### Access Control
- [ ] Authorization checked on every request — not just on login
- [ ] Object ownership verified (prevent IDOR)
- [ ] Deny by default policy in place
- [ ] Privilege escalation paths reviewed
- [ ] SSRF protections: validate URLs, block internal ranges

### Data Protection
- [ ] Sensitive data encrypted at rest (AES-256-GCM)
- [ ] TLS 1.3 (minimum TLS 1.2) for all data in transit
- [ ] No sensitive data in URLs, query strings, or logs
- [ ] Secrets in environment variables or vault — never in code

### Cryptography
- [ ] No MD5, SHA1, DES, RC4, ECB mode
- [ ] Random IV/nonce for each encryption operation
- [ ] Keys derived with PBKDF2/Argon2, not hardcoded
- [ ] Certificate pinning for high-value connections

### Error Handling (A10:2025 — new focus area)
- [ ] No stack traces, internal paths, or DB errors exposed to users
- [ ] Fail-closed on ALL exceptions — deny on error, never allow
- [ ] All exceptions logged with correlation ID and context
- [ ] Consistent generic error responses (prevent enumeration)
- [ ] Error paths tested explicitly — not just happy paths

### Logging & Alerting (A09:2025)
- [ ] Security events logged: auth success/failure, access denied, config changes
- [ ] Logs include: timestamp, user ID, IP, resource, outcome
- [ ] No sensitive data (passwords, tokens) in logs
- [ ] Alerting configured — logging without alerting is incomplete
- [ ] Log integrity protected (tamper-evident, centralized)

### Dependencies (A03:2025 — supply chain)
- [ ] Dependency versions pinned (lockfiles committed)
- [ ] SRI hashes for all CDN assets
- [ ] Automated dep vulnerability scanning in CI (Dependabot, Snyk, etc.)
- [ ] Third-party code reviewed before integration

---

## Secure Code Patterns

### SQL Injection Prevention
```python
# UNSAFE
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# SAFE
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

### Command Injection Prevention
```python
# UNSAFE
os.system(f"convert {filename} output.png")

# SAFE
subprocess.run(["convert", filename, "output.png"], shell=False)
```

### Password Storage
```python
# UNSAFE — never use these for passwords
hashlib.md5(password.encode()).hexdigest()
hashlib.sha256(password.encode()).hexdigest()

# SAFE
from argon2 import PasswordHasher
ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)
ph.hash(password)
```

### Access Control (deny by default)
```python
# UNSAFE — no authorization
@app.route('/api/user/<user_id>')
def get_user(user_id):
    return db.get_user(user_id)

# SAFE — ownership + role check
@app.route('/api/user/<user_id>')
@login_required
def get_user(user_id):
    if current_user.id != user_id and not current_user.is_admin:
        abort(403)
    return db.get_user(user_id)
```

### Fail-Closed (A10:2025 — critical pattern)
```python
# UNSAFE — fail-open
def check_permission(user, resource):
    try:
        return auth_service.check(user, resource)
    except Exception:
        return True  # NEVER. An error is not an authorization.

# SAFE — fail-closed
def check_permission(user, resource):
    try:
        return auth_service.check(user, resource)
    except Exception as e:
        logger.error(f"Auth check failed for {user} on {resource}: {e}", exc_info=True)
        return False  # Deny on any failure, always
```

### Error Handling with Correlation ID (A10:2025)
```python
# UNSAFE — exposes internals
@app.errorhandler(Exception)
def handle_error(e):
    return str(e), 500

# SAFE — generic response + logged context
@app.errorhandler(Exception)
def handle_error(e):
    error_id = str(uuid.uuid4())
    logger.exception(f"Unhandled error [{error_id}]", exc_info=e)
    return {"error": "An unexpected error occurred", "ref": error_id}, 500
```

### Logging with Alerting (A09:2025)
```python
# UNSAFE — logging without alerting is incomplete
logger.warning("Login failed")

# SAFE — structured + alert trigger
logger.warning("auth.login_failed", extra={
    "user_id": user_id,
    "ip": request.remote_addr,
    "timestamp": datetime.utcnow().isoformat(),
    "alert": True,  # triggers SIEM/PagerDuty rule
})
```

---

## Agentic AI Security (OWASP ASI — 2026 Preview)

When building or reviewing AI agent systems:

| Risk | Description | Mitigation |
|------|-------------|------------|
| ASI01: Goal Hijack | Prompt injection alters agent objectives | Input sanitization, goal boundaries, behavioral monitoring |
| ASI02: Tool Misuse | Tools used in unintended ways | Least privilege, fine-grained permissions, validate I/O |
| ASI03: Privilege Abuse | Credential escalation across agents | Short-lived scoped tokens, identity verification |
| ASI04: Supply Chain | Compromised plugins/MCP servers | Verify signatures, sandbox, allowlist plugins |
| ASI05: Code Execution | Unsafe code generation/execution | Sandbox execution, static analysis, human approval |
| ASI06: Memory Poisoning | Corrupted RAG/context data | Validate stored content, segment by trust level |
| ASI07: Agent Comms | Spoofing between agents | Authenticate, encrypt, verify message integrity |
| ASI08: Cascading Failures | Errors propagate across systems | Circuit breakers, graceful degradation, isolation |
| ASI09: Trust Exploitation | Social engineering via AI | Label AI content, user education, verification steps |
| ASI10: Rogue Agents | Compromised agents acting maliciously | Behavior monitoring, kill switches, anomaly detection |

Agent Security Checklist:
- [ ] All agent inputs sanitized and validated
- [ ] Tools operate with minimum required permissions
- [ ] Credentials are short-lived and scoped
- [ ] Third-party plugins verified and sandboxed
- [ ] Code execution happens in isolated environments
- [ ] Agent communications authenticated and encrypted
- [ ] Circuit breakers between agent components
- [ ] Human approval gates for sensitive/irreversible operations
- [ ] Behavior monitoring for anomaly detection
- [ ] Kill switch available for agent systems

---

## ASVS 5.0 Requirements

### Level 1 (All Applications)
- Passwords minimum 12 characters
- Check against breached password lists
- Rate limiting on all authentication endpoints
- Session tokens ≥128 bits entropy
- HTTPS everywhere (HSTS enabled)

### Level 2 (Sensitive Data)
- All L1 requirements, plus:
- MFA for sensitive operations
- Cryptographic key management documented and enforced
- Comprehensive security event logging with alerting
- Input validation on all parameters (not just visible forms)

### Level 3 (Critical Systems)
- All L1/L2 requirements, plus:
- Hardware security modules (HSM) for key storage
- Threat modeling documented and updated
- Advanced monitoring and anomaly detection
- Annual penetration testing validation

---

## Zero Trust Architecture (2025)

Zero Trust is non-negotiable for cloud-native and remote-work environments. Apply all 7 pillars:

1. **Identity as perimeter**: Every user, service, and device authenticated via IAM/IdP. Passkeys/FIDO2 for humans, mTLS for services.
2. **Device health verification**: Access conditioned on device compliance posture — not just credentials.
3. **Least privilege access**: JIT (Just-In-Time) and JEA (Just-Enough-Access). No standing elevated privileges.
4. **Micro-segmentation**: Network divided into small zones. Lateral movement blocked by default.
5. **Continuous verification**: Auth/authz is not a one-time gate — re-evaluate on context change (location, behavior, time).
6. **Encrypted end-to-end**: Assume the internal network is hostile. Encrypt everything in transit including east-west traffic.
7. **Assume breach posture**: Log, monitor, and alert aggressively. Mean Time to Detect (MTTD) is a first-class security metric.

**In code**: apply Zero Trust at the API layer — every request must present valid credentials. No "trusted internal caller" exceptions.

---

## Threat Modeling

Use at design phase. Cheapest time to fix a security issue is before a line of code is written.

### STRIDE (per component)

| Threat | Applies to | Question to ask |
|--------|-----------|-----------------|
| Spoofing | Auth | Can an attacker impersonate a user or service? |
| Tampering | Data | Can data be modified in transit or at rest? |
| Repudiation | Logs | Can an actor deny having taken an action? |
| Information Disclosure | Data/Errors | Can sensitive data leak to unauthorized parties? |
| Denial of Service | Availability | Can an attacker make the system unavailable? |
| Elevation of Privilege | AuthZ | Can a low-privilege actor gain higher access? |

### Process
1. Draw the system: components, data flows, trust boundaries
2. Apply STRIDE to each component and data flow crossing a trust boundary
3. Rate each threat: Likelihood × Impact (CVSS or DREAD)
4. Define mitigations for each rated threat
5. Verify mitigations are implemented before release

---

## Vulnerability Assessment & Management

### Severity-Based SLA
| Severity | Remediate Within |
|----------|-----------------|
| Critical | 24-48 hours |
| High | 7 days |
| Medium | 30 days |
| Low | 90 days |

### Risk Prioritization (not just CVSS)
CVSS score alone is insufficient. Adjust for:
- Is there an active exploit in the wild? (CISA KEV)
- Is the affected asset internet-facing?
- What data or functionality is exposed?
- Is a compensating control already in place?

### Tools
- **SAST**: Semgrep, SonarQube, CodeQL
- **DAST**: OWASP ZAP, Burp Suite
- **Dependency scanning**: Dependabot, Snyk, OWASP Dependency-Check
- **Secrets detection**: TruffleHog, GitLeaks (run in pre-commit and CI)
- **Container**: Trivy, Grype

---

## Incident Response (NIST SP 800-61)

### Phases
1. **Preparation**: IR playbooks, communication plans, tooling ready, team trained
2. **Detection & Analysis**: Monitor → alert → triage → classify → scope
3. **Containment**: Isolate affected systems. Short-term (stop spread) then long-term (stable state)
4. **Eradication**: Remove attacker access, malware, and root cause
5. **Recovery**: Restore from clean backups. Monitor for re-infection
6. **Post-Incident**: Lessons learned, update playbooks, report (MTTD, MTTR, root cause)

### Key Metrics
- **MTTD** — Mean Time to Detect
- **MTTR** — Mean Time to Respond
- **MTTC** — Mean Time to Contain

---

## Language-Specific Security Quirks

> Think like a senior security researcher. Consider: memory model, type system, serialization, concurrency, FFI boundaries, standard library CVE history, package ecosystem risks, build system injection, debug-vs-release differences, error handling behavior.

### JavaScript / TypeScript
**Risks**: Prototype pollution, XSS, eval injection, ReDoS
```javascript
// UNSAFE: prototype pollution
Object.assign(target, userInput)
// SAFE
Object.assign(Object.create(null), validated)

// UNSAFE: eval
eval(userCode)
// SAFE: never use eval with user input — use sandboxed VMs if needed
```
Watch: `eval()`, `innerHTML`, `document.write()`, `__proto__`, `Function()`, ReDoS-prone regexes

---

### Python
**Risks**: Pickle deserialization RCE, format string injection, shell injection
```python
# UNSAFE: Pickle RCE
pickle.loads(user_data)
# SAFE
json.loads(user_data)
```
Watch: `pickle`, `eval()`, `exec()`, `os.system()`, `subprocess(shell=True)`, YAML.load

---

### Java
**Risks**: Deserialization RCE, XXE, JNDI injection (Log4Shell pattern)
```java
// UNSAFE
ObjectInputStream ois = new ObjectInputStream(userStream);
// SAFE: use JSON or serialization allowlists
```
Watch: `ObjectInputStream`, `Runtime.exec()`, XML parsers without XXE protection, JNDI lookups

---

### C#
**Risks**: Deserialization, SQL injection, path traversal
```csharp
// UNSAFE: BinaryFormatter (deprecated, remove entirely)
BinaryFormatter bf = new BinaryFormatter();
// SAFE
var obj = JsonSerializer.Deserialize<SafeType>(json);
```
Watch: `BinaryFormatter` (banned in .NET 9+), `TypeNameHandling.All`, raw SQL strings

---

### PHP
**Risks**: Type juggling, file inclusion, object injection, `==` vs `===`
```php
// UNSAFE: type juggling in auth
if ($password == $stored_hash) { ... }
// SAFE
if (hash_equals($stored_hash, $password)) { ... }
```
Watch: `==` vs `===`, `include/require` with user input, `unserialize()`, `extract()`

---

### Go
**Risks**: Race conditions, template injection, unsafe package
```go
// UNSAFE: Template injection
template.HTML(userInput)
// SAFE: let html/template escape
{{.UserInput}}
```
Watch: Goroutine data races, `template.HTML()`, `unsafe` package

---

### Ruby
**Risks**: Mass assignment, YAML deserialization, regex DoS
```ruby
# UNSAFE: YAML RCE
YAML.load(user_input)
# SAFE
YAML.safe_load(user_input)
```
Watch: `Marshal.load`, `eval`, `send` with user input, `.permit!`

---

### Rust
**Risks**: Unsafe blocks, integer overflow in release builds
```rust
// CAUTION: Release builds wrap on overflow
let y = x.checked_add(1).unwrap_or(u8::MAX);
```
Watch: `unsafe` blocks, FFI calls, `.unwrap()` on untrusted input

---

### Swift
**Risks**: Force unwrap crashes, format string
```swift
// UNSAFE
let value = jsonDict["key"]!
// SAFE
guard let value = jsonDict["key"] else { return }
```
Watch: force unwrap (`!`), `try!`, ObjC bridging

---

### Dart / Flutter
**Risks**: Platform channel injection, insecure local storage
```dart
// UNSAFE: SharedPreferences for tokens
prefs.setString('auth_token', token);
// SAFE: flutter_secure_storage
secureStorage.write(key: 'auth_token', value: token);
```

---

### C / C++
**Risks**: Buffer overflow, use-after-free, format string
```c
// UNSAFE
strcpy(buf, userInput);
printf(userInput);
// SAFE
strncpy(buf, userInput, sizeof(buf) - 1);
printf("%s", userInput);
```
Watch: `strcpy`, `sprintf`, `gets`, raw pointer arithmetic

---

### Shell (Bash)
**Risks**: Command injection, word splitting, globbing
```bash
# UNSAFE
rm $user_file
eval "$user_command"
# SAFE
rm "$user_file"
# Never eval user input
```
Watch: unquoted variables, `eval`, backticks, missing `set -euo pipefail`

---

### SQL (All Dialects)
**Risks**: Injection, privilege escalation, data exfiltration
```sql
-- UNSAFE: string concatenation
"SELECT * FROM users WHERE id = " + userId
-- SAFE: parameterized in all cases
```
Watch: dynamic SQL, `EXECUTE IMMEDIATE`, stored procedures with dynamic queries

---

## Deep Security Analysis Mindset

When reviewing any codebase:

1. **Memory model**: Managed vs manual? GC pause exploitable?
2. **Type system**: Weak typing = type confusion. Look for coercion exploits.
3. **Serialization**: Every language has its pickle/Marshal. All are dangerous with user input.
4. **Concurrency**: Race conditions, TOCTOU, atomicity failures.
5. **FFI boundaries**: Where type safety breaks down.
6. **Standard library**: Research CVE history for std libs in use.
7. **Package ecosystem**: Typosquatting, dependency confusion, malicious packages.
8. **Build system**: Makefile/gradle/npm script injection during CI.
9. **Debug vs release**: Different behavior (Rust overflow, C++ assertions, Go race detector).
10. **Error handling**: Does the language fail silently? With stack traces? Fail-open?

---

## Secure Development Lifecycle (SDL) Integration

| Phase | Security Activity |
|-------|------------------|
| Requirements | Define security requirements, classify data |
| Design | Threat model (STRIDE), architecture review, attack surface reduction |
| Implementation | Secure coding standards, SAST in IDE, secrets detection pre-commit |
| Testing | DAST, dependency scan, pen test for critical paths |
| Release | Final security review, incident response plan ready |
| Operations | Vulnerability management, monitoring, IR exercises |

---

## Key Resources
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)
- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final)
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework)
- [MITRE ATT&CK](https://attack.mitre.org/)
- [CIS Controls v8](https://www.cisecurity.org/controls)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
