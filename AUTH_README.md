# Authentication Readme

This report was produced from static code inspection only. No authentication code, configuration, dependency, schema, provider setting, or existing file was modified.

## 1. Authentication Architecture Overview

The application uses custom username/password authentication implemented with Express routes, Prisma, bcrypt, JWTs, and browser `localStorage`. No external hosted authentication provider such as Clerk, Auth0, Firebase Auth, Supabase Auth, NextAuth, or Passport is configured in the inspected code.

Provider/library stack:

- Backend HTTP framework: Express, configured in `server/server.js:3`, `server/server.js:9`, `server/server.js:13`.
- User database access: Prisma Client from `server/lib/prisma.js:1` and `server/lib/prisma.js:5`.
- Database provider: PostgreSQL via `DATABASE_URL` in `server/prisma/schema.prisma:5` and `server/prisma/schema.prisma:7`.
- Password hashing: `bcryptjs` in `server/controllers/signupController.js:1`, `server/controllers/signupController.js:29`, `server/routes/authRoutes.js:4`, and `server/routes/authRoutes.js:90`.
- JWT creation/verification: `jsonwebtoken` in `server/controllers/signupController.js:2`, `server/controllers/signupController.js:40`, `server/routes/authRoutes.js:5`, `server/routes/authRoutes.js:98`, `server/routes/authRoutes.js:143`, and `server/middleware/authMiddleware.js:23`.
- Password-reset email: `nodemailer` transport in `server/routes/authRoutes.js:6`, `server/routes/authRoutes.js:21`, and `server/routes/authRoutes.js:151`.
- Client auth UI/session state: Zustand persisted store in `client/src/store/useAuthStore.ts:1`, `client/src/store/useAuthStore.ts:22`, and `client/src/store/useAuthStore.ts:34`.

Important security note from code inspection: JWT signing secrets and SMTP test credentials are present directly in source files. This report intentionally does not include those values. The inspected lines are `server/controllers/signupController.js:40`, `server/routes/authRoutes.js:98`, `server/routes/authRoutes.js:143`, and `server/routes/authRoutes.js:21`.

## 2. End-to-End Login Flow

1. The home page controls modal state with `currentView` from the Zustand auth store in `client/src/app/page.tsx:20`.
2. Clicking Login sets the view to `LOGIN` in `client/src/app/page.tsx:46`.
3. When `currentView === 'LOGIN'`, `LoginForm` mounts at `client/src/app/page.tsx:608`.
4. `LoginForm.handleLogin` is defined at `client/src/components/LoginForm.tsx:16`.
5. The login request is sent to `POST http://localhost:8000/api/auth/login` at `client/src/components/LoginForm.tsx:18`.
6. The request body contains `email` and `password` at `client/src/components/LoginForm.tsx:24`.
7. The backend route is registered as `router.post("/login", ...)` in `server/routes/authRoutes.js:70`.
8. The backend validates missing email/password at `server/routes/authRoutes.js:74`.
9. The backend looks up the user by normalized email with `prisma.user.findUnique` at `server/routes/authRoutes.js:80`.
10. If no user exists, it returns `400` with `User not found` at `server/routes/authRoutes.js:84`.
11. The password is checked with `bcrypt.compare` at `server/routes/authRoutes.js:90`.
12. Invalid password returns `400` with `Invalid credentials` at `server/routes/authRoutes.js:93`.
13. A seven-day JWT is signed at `server/routes/authRoutes.js:98`.
14. A successful response returns status `200`, `token`, and a user object at `server/routes/authRoutes.js:103`.
15. The client stores the token in `localStorage` under `token` at `client/src/components/LoginForm.tsx:32`.
16. The client redirects to `/dashboard` or `/setup` based on `data.user.isOnboardingComplete` at `client/src/components/LoginForm.tsx:37`.
17. If no token is returned, the client displays `data.message || "Invalid credentials"` at `client/src/components/LoginForm.tsx:46`.
18. Network/runtime exceptions display `Failed to connect to the authentication server.` at `client/src/components/LoginForm.tsx:52`.

## 3. End-to-End Signup Flow

1. Clicking Sign up sets `currentView` to `SIGNUP` in `client/src/app/page.tsx:53` or `client/src/app/page.tsx:367`.
2. When `currentView === 'SIGNUP'`, `SignupForm` mounts at `client/src/app/page.tsx:609`.
3. `SignupForm.handleSignup` is defined at `client/src/components/SignupForm.tsx:40`.
4. Duplicate submissions are guarded by `submissionInProgress` at `client/src/components/SignupForm.tsx:23`, `client/src/components/SignupForm.tsx:41`, and `client/src/components/SignupForm.tsx:67`.
5. Client-side validation checks missing fields, name characters, email shape, and password shape at `client/src/components/SignupForm.tsx:44`, `client/src/components/SignupForm.tsx:50`, `client/src/components/SignupForm.tsx:56`, and `client/src/components/SignupForm.tsx:62`.
6. The signup request is sent to `POST http://localhost:8000/api/auth/signup` at `client/src/components/SignupForm.tsx:70`.
7. The backend route delegates signup to the controller at `server/routes/authRoutes.js:68`.
8. The controller normalizes `name`, `email`, and `password` at `server/controllers/signupController.js:9`.
9. Backend validation returns `400` for missing fields, invalid email, or invalid password at `server/controllers/signupController.js:13`, `server/controllers/signupController.js:17`, and `server/controllers/signupController.js:20`.
10. Existing email is checked with `prisma.user.findUnique` at `server/controllers/signupController.js:26`.
11. Duplicate email returns `409` at `server/controllers/signupController.js:27`, with a second Prisma unique-constraint guard at `server/controllers/signupController.js:56`.
12. Passwords are hashed with `bcrypt.hash(..., 10)` at `server/controllers/signupController.js:29`.
13. The user is created with onboarding defaults at `server/controllers/signupController.js:30`.
14. A seven-day JWT is signed at `server/controllers/signupController.js:40`.
15. Successful signup returns `201`, a token, and a user object at `server/controllers/signupController.js:41`.
16. The client stores the token in `localStorage` at `client/src/components/SignupForm.tsx:88`.
17. The client stores the user in Zustand through `setSession` at `client/src/components/SignupForm.tsx:94`.
18. The client redirects to `/setup` after a timeout at `client/src/components/SignupForm.tsx:103`.
19. Backend `400`, `409`, and `503` messages are displayed directly when safe at `client/src/components/SignupForm.tsx:111`.

## 4. Session and Token Lifecycle

Token issuance:

- Signup creates a seven-day JWT at `server/controllers/signupController.js:40`.
- Login creates a seven-day JWT at `server/routes/authRoutes.js:98`.
- Forgot password creates a separate short-lived reset JWT at `server/routes/authRoutes.js:143`.

Client storage:

- The raw access token is stored in browser `localStorage` under `token` at `client/src/components/LoginForm.tsx:32` and `client/src/components/SignupForm.tsx:88`.
- The Zustand auth store is persisted in browser `localStorage` under `placement-auth-session` at `client/src/store/useAuthStore.ts:34`.
- The persisted Zustand state includes `currentView` and `user` from `client/src/store/useAuthStore.ts:14` and `client/src/store/useAuthStore.ts:15`.

Authenticated requests:

- Setup autosave reads `localStorage.getItem("token")` and sends `Authorization: Bearer ...` at `client/src/app/setup/page.tsx:66`, `client/src/app/setup/page.tsx:70`, and `client/src/app/setup/page.tsx:74`.
- Resume completion sends the token at `client/src/app/setup/page.tsx:88`, `client/src/app/setup/page.tsx:97`, and `client/src/app/setup/page.tsx:100`.
- Setup profile restore calls `/api/auth/profile` with the token at `client/src/app/setup/page.tsx:185`, `client/src/app/setup/page.tsx:194`, and `client/src/app/setup/page.tsx:195`.
- Analysis calls `/api/ai/generate-analysis` with the token at `client/src/app/setup/analysis/page.tsx:55` and `client/src/app/setup/analysis/page.tsx:61`.

Server validation:

- `authMiddleware` reads the `Authorization` header at `server/middleware/authMiddleware.js:6`.
- Missing token returns `401` with `No token provided` at `server/middleware/authMiddleware.js:8`.
- Bearer tokens are parsed at `server/middleware/authMiddleware.js:18`.
- JWT verification occurs at `server/middleware/authMiddleware.js:23`.
- The decoded payload is attached to `req.user` at `server/middleware/authMiddleware.js:26`.
- Invalid token returns `401` with `Invalid token` at `server/middleware/authMiddleware.js:32`.

Not present in inspected code:

- No refresh-token flow was found.
- No cookie-based auth flow was found.
- No server-side session store was found.
- No implemented logout API route was found.
- No token removal from `localStorage` was found. `logout` clears only Zustand user/view state at `client/src/store/useAuthStore.ts:31`.
- No reset-password page or reset-password API endpoint was found; only reset-link generation exists at `server/routes/authRoutes.js:149`.

## 5. Authentication-Related File Map

- `server/server.js`: Express app setup, CORS, JSON parsing, route mounting, port `8000`.
- `server/routes/authRoutes.js`: Auth route definitions for test, signup, login, forgot password, profile, onboarding, and resume upload.
- `server/controllers/signupController.js`: Signup validation, duplicate-email handling, password hashing, user creation, JWT issuance, and signup-specific error mapping.
- `server/middleware/authMiddleware.js`: JWT extraction and verification middleware.
- `server/lib/prisma.js`: Shared Prisma Client initialization.
- `server/prisma/schema.prisma`: `User` and `PlacementProfile` models and PostgreSQL datasource.
- `server/routes/aiRoutes.js`: Auth-protected analysis route.
- `server/controllers/aiController.js`: Reads authenticated `req.user.userId` and user profile for analysis.
- `client/src/app/page.tsx`: Landing page and auth modal mounting based on Zustand `currentView`.
- `client/src/components/LoginForm.tsx`: Login form, request, token storage, login error display, redirects.
- `client/src/components/SignupForm.tsx`: Signup form, validation, duplicate-submit guard, token/session storage, signup error display, redirects.
- `client/src/components/ForgotPasswordForm.tsx`: Forgot-password form and request.
- `client/src/store/useAuthStore.ts`: Persisted auth UI/session store.
- `client/src/app/setup/page.tsx`: Protected setup page, session restore, authenticated profile/onboarding/resume requests.
- `client/src/app/setup/analysis/page.tsx`: Authenticated analysis request.
- `server/test/signupController.test.js`: Signup behavior tests for bcrypt hashing, `400`, `409`, `503`, and `500` responses.

## 6. Error-Handling Flow

Login errors:

- Missing email/password: backend `400`, message `Email and password are required.` from `server/routes/authRoutes.js:74`.
- Missing user: backend `400`, message `User not found` from `server/routes/authRoutes.js:84`.
- Invalid password: backend `400`, message `Invalid credentials` from `server/routes/authRoutes.js:93`.
- Unexpected backend error: backend logs the error at `server/routes/authRoutes.js:115` and returns `500` with `Server Error` at `server/routes/authRoutes.js:117`.
- Client displays backend `data.message` when no token exists at `client/src/components/LoginForm.tsx:46`.
- Client network exceptions display `Failed to connect to the authentication server.` at `client/src/components/LoginForm.tsx:52`.

Signup errors:

- Missing fields: backend `400` at `server/controllers/signupController.js:13`.
- Invalid email: backend `400` at `server/controllers/signupController.js:17`.
- Invalid password: backend `400` at `server/controllers/signupController.js:20`.
- Duplicate email: backend `409` at `server/controllers/signupController.js:27` and `server/controllers/signupController.js:56`.
- Prisma initialization or connection/pool errors: backend `503` with `Signup is temporarily unavailable. Please try again shortly.` at `server/controllers/signupController.js:59` and `server/controllers/signupController.js:60`.
- Unexpected backend error: backend `500` with `Server error. Please try again later.` at `server/controllers/signupController.js:62`.
- In non-production, signup logs error name, code, message, and stack at `server/controllers/signupController.js:53`.
- Client displays safe backend messages for `400`, `409`, and `503` at `client/src/components/SignupForm.tsx:111`.

Forgot-password errors:

- Missing email: backend `400` at `server/routes/authRoutes.js:127`.
- Missing user: backend `400` at `server/routes/authRoutes.js:137`.
- Unexpected error: backend logs and returns `500` with `Server Error` at `server/routes/authRoutes.js:175`.
- Client displays backend message when the response is not OK at `client/src/components/ForgotPasswordForm.tsx:31`.

Protected-route errors:

- Missing token: `401`, `No token provided` from `server/middleware/authMiddleware.js:8`.
- Invalid token: `401`, `Invalid token` from `server/middleware/authMiddleware.js:32`.
- `/api/auth/profile` missing user: `404`, `User profile not found.` from `server/routes/authRoutes.js:216`.

## 7. Potential Causes of the Intermittent Issue

### Confirmed issue: the signup-specific message only exists in the signup controller

Evidence:

- The exact phrase `Signup is temporarily unavailable. Please try again shortly.` appears in the inspected source at `server/controllers/signupController.js:60`.
- Login route error handling returns `Server Error`, not the signup message, at `server/routes/authRoutes.js:117`.
- Signup client intentionally displays backend `503` messages at `client/src/components/SignupForm.tsx:111`.

Conclusion:

- A true `POST /api/auth/login` response should not produce this exact signup-specific message from the current backend code.
- If this exact phrase appears during an attempted login, the browser may actually be showing the signup form, sending a signup request, displaying stale signup state, or receiving a response from a different deployed/runtime code version.

### Likely issue: persisted modal view can reopen Signup instead of Login

Evidence:

- `currentView` is part of the persisted Zustand store type at `client/src/store/useAuthStore.ts:14`.
- Zustand persistence is enabled at `client/src/store/useAuthStore.ts:22`.
- The localStorage key is `placement-auth-session` at `client/src/store/useAuthStore.ts:34`.
- The home page mounts `SignupForm` when `currentView === 'SIGNUP'` at `client/src/app/page.tsx:609`.
- The home page mounts `LoginForm` when `currentView === 'LOGIN'` at `client/src/app/page.tsx:608`.

Why this matters:

- If the persisted auth UI state contains `SIGNUP`, a page reload or stale persisted store can open Signup even when the user thinks they are returning to login. A signup submission would then produce the signup-specific `503`.

### Likely issue: signup database/pool failures are intentionally mapped to the observed message

Evidence:

- Signup maps `PrismaClientInitializationError` and Prisma codes including `P2024` to `503` at `server/controllers/signupController.js:59`.
- The exact `503` behavior is tested in `server/test/signupController.test.js:58`.
- Prisma uses a shared client in `server/lib/prisma.js:5`.
- Both signup and login call `prisma.user.findUnique`, but only signup has a database-unavailable message that names signup.

Why this matters:

- The observed phrase is consistent with signup hitting a database connection/pool failure, not with the inspected login handler.
- Runtime logs are required to confirm whether the actual failing request is `/api/auth/signup` and whether Prisma emits `P2024`, `P1001`, `P1002`, `P1017`, or `PrismaClientInitializationError`.

### Possible issue: login has no duplicate-submission guard

Evidence:

- Signup uses `submissionInProgress` at `client/src/components/SignupForm.tsx:23`, `client/src/components/SignupForm.tsx:41`, and `client/src/components/SignupForm.tsx:67`.
- Login does not define an equivalent in-progress flag in `client/src/components/LoginForm.tsx:16`.
- Login button calls `handleLogin` directly at `client/src/components/LoginForm.tsx:116`.

Why this matters:

- Rapid repeated clicks can send multiple login requests. This would not directly create the signup-specific message in the inspected code, but it can contribute to intermittent database pressure, racey UI perception, or confusing network traces.

### Possible issue: raw JWT is not cleared on logout

Evidence:

- `logout` clears only Zustand `user` and `currentView` at `client/src/store/useAuthStore.ts:31`.
- No `localStorage.removeItem("token")` or equivalent token removal was found.
- Protected pages read the raw token directly from `localStorage` at `client/src/app/setup/page.tsx:66`, `client/src/app/setup/page.tsx:88`, `client/src/app/setup/page.tsx:155`, `client/src/app/setup/page.tsx:185`, and `client/src/app/setup/analysis/page.tsx:61`.

Why this matters:

- A stale token can keep protected flows active after UI logout. This does not explain the signup-specific message by itself, but it can cause inconsistent auth state and confusing redirects.

### Possible issue: login errors are broadly collapsed

Evidence:

- Login catches all backend exceptions and returns `500` with only `Server Error` at `server/routes/authRoutes.js:115` and `server/routes/authRoutes.js:117`.
- Login client displays backend `data.message` at `client/src/components/LoginForm.tsx:46`.

Why this matters:

- Database connection errors during login would be transformed into generic `Server Error`, losing provider/Prisma error identity. Runtime logs would be needed to distinguish invalid credentials from transient database failure.

### Unverified due to missing runtime information: wrong endpoint, stale bundle, or multiple server instances

Evidence needed:

- Browser Network tab URL, request method, status code, response body, and initiator stack.
- Server logs showing whether `/api/auth/login` or `/api/auth/signup` received the request.
- Confirmation that only one backend is listening on port `8000`.
- Confirmation that the frontend is using the latest compiled code.

Why this matters:

- Static code shows login uses `/api/auth/login` and signup uses `/api/auth/signup`. If a login attempt displays signup-specific text, runtime evidence is needed to prove whether the browser really sent login or signup.

## 8. Evidence Supporting Each Potential Cause

- Signup-only message: `server/controllers/signupController.js:60`; login fallback differs at `server/routes/authRoutes.js:117`.
- Signup message display path: `client/src/components/SignupForm.tsx:111`.
- Login display path: `client/src/components/LoginForm.tsx:46`.
- Persisted modal view: `client/src/store/useAuthStore.ts:14`, `client/src/store/useAuthStore.ts:22`, `client/src/store/useAuthStore.ts:34`, `client/src/app/page.tsx:608`, `client/src/app/page.tsx:609`.
- Prisma signup 503 mapping: `server/controllers/signupController.js:59`.
- Prisma shared client: `server/lib/prisma.js:5`.
- Signup 503 test coverage: `server/test/signupController.test.js:58`.
- Login duplicate-submit absence: `client/src/components/LoginForm.tsx:16` through `client/src/components/LoginForm.tsx:121`; no in-progress flag found in the component.
- Token persistence/stale token: `client/src/components/LoginForm.tsx:32`, `client/src/components/SignupForm.tsx:88`, `client/src/store/useAuthStore.ts:31`.

## 9. Ranked Root-Cause Hypotheses

1. Confirmed issue: the observed message is produced by signup-specific error handling, not by the inspected login backend route.
   - Classification: Confirmed issue.
   - Confidence: High.
   - Reason: Exact phrase exists only in signup controller; login returns different messages.

2. The user-visible "login attempt" is sometimes actually happening while `SignupForm` is mounted because `currentView` is persisted in localStorage.
   - Classification: Likely issue.
   - Confidence: Medium-high.
   - Reason: The modal view is persisted, and SignupForm is the only frontend component that displays the exact backend signup `503` message.

3. Signup is intermittently hitting Prisma/Neon connection-pool or initialization failures.
   - Classification: Likely issue.
   - Confidence: Medium-high.
   - Reason: Signup explicitly maps Prisma connectivity/pool failures to the observed `503`, and prior observed behavior included an approximately 10-second wait consistent with Prisma pool timeout. Current code also has a test locking this mapping.

4. Multiple/duplicate client requests are contributing to intermittent database pressure or confusing UI state.
   - Classification: Possible issue.
   - Confidence: Medium.
   - Reason: Signup is guarded against duplicate submission, but login is not. Static code cannot prove duplicate requests occur.

5. Stale raw JWT and persisted Zustand state are causing inconsistent session/redirect behavior.
   - Classification: Possible issue.
   - Confidence: Medium.
   - Reason: Raw token is not cleared by `logout`, and auth UI state is persisted separately. This can create inconsistent state, though it does not directly produce the signup message.

6. Wrong runtime bundle, endpoint, or multiple server instance.
   - Classification: Unverified due to missing runtime information.
   - Confidence: Unknown.
   - Reason: Static code cannot verify the browser's actual network request or deployed server instance at failure time.

## 10. Safe Reproduction and Diagnostic Steps

These steps do not require code changes:

1. Open the browser Network tab and preserve logs.
2. Clear filters, then reproduce the issue.
3. Confirm the failing request URL is either `/api/auth/login` or `/api/auth/signup`.
4. Record the request method, status code, response body, and timing.
5. Check whether the visible modal heading says `Login` or `Sign up`.
6. Inspect localStorage key `placement-auth-session` and note only whether `state.currentView` is `LOGIN`, `SIGNUP`, `FORGOT_PASSWORD`, or `IDLE`; do not copy token values.
7. Inspect whether localStorage key `token` exists; do not copy its value.
8. In the server terminal, record whether the backend logged `Signup request failed` or a login route error.
9. If the request takes around 10 seconds, check server logs for Prisma codes such as `P2024`, `P1001`, `P1002`, `P1017`, or `PrismaClientInitializationError`.
10. Restart the backend and confirm `GET http://localhost:8000/api/auth/test` returns `Auth Route Working`.
11. Repeat login with a single click only; then repeat with rapid double-clicks and compare Network traces.
12. Temporarily test in a private browser window to remove persisted Zustand state and stale tokens from the equation.

## 11. Recommended Fixes

These are recommendations only. They were not implemented.

- Do not persist `currentView` in the auth store, or force it to `IDLE` during hydration so stale modal state cannot reopen Signup unexpectedly.
- Clear form-level errors when switching between Login, Signup, and Forgot Password.
- Add a login in-progress guard like SignupForm's `submissionInProgress` to prevent duplicate login requests.
- Ensure `logout` removes the raw `token` from localStorage in addition to clearing Zustand user state.
- Move JWT signing secrets and SMTP credentials into environment variables.
- Use one shared environment-backed JWT secret for signing and verifying access tokens.
- Add structured backend logging for login failures similar to signup, while returning safe generic messages to the browser.
- Consider mapping Prisma connection/pool errors consistently across login and signup, with endpoint-neutral user-facing language for shared database outages.
- Add a real reset-password page and API endpoint or remove/disable the dead reset-link path until implemented.
- Add client-side request IDs and send them with auth requests so frontend Network entries can be correlated with backend logs.

## 12. Missing Information or Configuration That Could Not Be Verified

- Actual `.env` values were not inspected or reported.
- Neon project settings, pool mode, connection limits, and dashboard logs were not available from static code.
- Runtime server logs for the intermittent event were not available during this inspection.
- Browser Network traces for the intermittent event were not available.
- Production deployment configuration was not available.
- Whether multiple backend processes are sometimes running on port `8000` could not be verified from static inspection.
- Whether React Strict Mode is causing extra development-only rendering effects could not be confirmed as a cause; the relevant button handlers are direct click handlers, not effect-driven submissions.
- Provider outage, rate limit, stale DNS, and network-layer failures require runtime logs or provider dashboard data.

## Next-Failure Evidence Checklist

Collect the following the next time the intermittent error occurs. Do not capture secret values.

- Exact timestamp with timezone.
- Visible modal heading: `Login`, `Sign up`, or `Forgot Password`.
- Browser Network request URL, method, status code, duration, response body, and initiator.
- Whether the failing request was `/api/auth/login` or `/api/auth/signup`.
- Any request ID header if present.
- Browser console errors around the same timestamp.
- Server terminal logs around the same timestamp.
- Prisma error name, code, and metadata if logged.
- Neon connection/pool logs around the same timestamp.
- Whether localStorage has a `token` key, without copying the value.
- `placement-auth-session.state.currentView`, without copying sensitive user data.
- Whether the action was single-clicked or clicked multiple times.
- Whether the issue reproduces in a private browser window.
