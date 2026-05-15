# Krishi Sahayata — Backend Architecture Design

## Overview

PHP + MySQL backend providing RESTful JSON APIs for the Krishi Sahayata farmer assistant platform. Replaces the current client-only architecture (localStorage auth, static crop data, direct third-party API calls) with a secure, scalable server layer.

---

## 1. Folder Structure

```
backend/
├── public/
│   ├── index.php                 # Entry point — boots the app & routes
│   └── .htaccess                 # Apache URL rewriting to index.php
├── config/
│   ├── database.php              # PDO connection factory
│   ├── app.php                   # App constants (JWT secret, API keys, CORS origins)
│   └── cors.php                  # CORS header configuration
├── routes/
│   └── api.php                   # Route definitions (method + path → controller)
├── middleware/
│   ├── AuthMiddleware.php        # Validates JWT Bearer token
│   ├── CorsMiddleware.php        # Sets CORS headers on every response
│   └── RateLimitMiddleware.php   # Token-bucket rate limiting per IP/user
├── controllers/
│   ├── AuthController.php        # Register, login, logout, profile, password reset
│   ├── CropController.php        # List, detail, filter by category/season
│   ├── DiseaseController.php     # Detect (AI), history, CRUD
│   ├── ChatController.php        # Sessions, messages, send
│   ├── WeatherController.php     # Current, forecast, saved locations
│   └── NewsletterController.php  # Subscribe, unsubscribe
├── models/
│   ├── User.php
│   ├── Crop.php
│   ├── CropDetail.php
│   ├── DiseaseDetection.php
│   ├── ChatSession.php
│   ├── ChatMessage.php
│   ├── SavedLocation.php
│   ├── WeatherSearch.php
│   └── Subscriber.php
├── services/
│   ├── GroqService.php           # Calls Groq AI API (LLaMA 3.3-70B)
│   ├── WeatherService.php        # Calls OpenWeatherMap API
│   └── AuthService.php           # JWT create / verify / refresh
├── helpers/
│   ├── Response.php              # json(), error(), paginated() helpers
│   ├── Validator.php             # Input validation rules engine
│   └── Logger.php                # File + database error logging
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_crops.sql
│   ├── 003_create_disease_detections.sql
│   ├── 004_create_chat_sessions.sql
│   ├── 005_create_chat_messages.sql
│   ├── 006_create_weather_searches.sql
│   ├── 007_create_saved_locations.sql
│   └── 008_create_newsletter_subscribers.sql
├── uploads/
│   └── diseases/                 # Crop disease images (server-side)
├── scripts/
│   ├── seed_crops.php            # Populate crop data from existing HTML
│   └── migrate.php               # Run all migrations in order
├── composer.json
└── README.md
```

### Why this structure?

| Layer | Responsibility |
|-------|---------------|
| `public/` | Web root — only directory exposed to the web server |
| `routes/` | Single file mapping HTTP verbs + paths to controller methods |
| `middleware/` | Intercepts requests before controllers (auth, CORS, rate-limit) |
| `controllers/` | Thin — parse input, call services/models, return response |
| `models/` | Data access (Eloquent-style or raw PDO with query methods) |
| `services/` | External API integrations (Groq, OpenWeatherMap) |
| `helpers/` | Stateless utility functions |
| `migrations/` | Ordered SQL files for schema versioning |
| `uploads/` | User-uploaded files (disease images) |

---

## 2. Database Schema

### Entity-Relationship Overview

```
users ──< disease_detections
  │
  ├──< chat_sessions ──< chat_messages
  │
  ├──< saved_locations
  │
  └──< weather_searches

crops ──< crop_details
```

### 2.1 `users`

| Column      | Type             | Constraints              |
|-------------|------------------|--------------------------|
| id          | INT UNSIGNED     | PK, AUTO_INCREMENT       |
| name        | VARCHAR(100)     | NOT NULL                 |
| email       | VARCHAR(255)     | NOT NULL, UNIQUE         |
| password    | VARCHAR(255)     | NOT NULL (bcrypt hash)   |
| avatar_url  | VARCHAR(500)     | NULLABLE                 |
| created_at  | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP|
| updated_at  | TIMESTAMP        | ON UPDATE CURRENT_TIMESTAMP|

Indexes: `UNIQUE(email)`

### 2.2 `crops`

| Column            | Type             | Constraints              |
|-------------------|------------------|--------------------------|
| id                | INT UNSIGNED     | PK, AUTO_INCREMENT       |
| slug              | VARCHAR(50)      | NOT NULL, UNIQUE         |
| name              | VARCHAR(100)     | NOT NULL                 |
| short_description | VARCHAR(255)     | NULLABLE                 |
| image_url         | VARCHAR(500)     | NULLABLE                 |
| season            | VARCHAR(50)      | NULLABLE (Rabi/Kharif/Annual/Perennial/Year-round) |
| category          | VARCHAR(50)      | NULLABLE (Cereal/Pulse/Oilseed/Vegetable/Fruit/Spice/Fiber/Cash/Palm) |
| created_at        | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP|

Indexes: `UNIQUE(slug)`, `INDEX(season)`, `INDEX(category)`

### 2.3 `crop_details`

| Column       | Type             | Constraints                     |
|--------------|------------------|----------------------------------|
| id           | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| crop_id      | INT UNSIGNED     | NOT NULL, FK → crops.id ON DELETE CASCADE |
| detail_key   | VARCHAR(50)      | NOT NULL                         |
| detail_value | TEXT             | NOT NULL                         |
| detail_type  | ENUM('text','list') | DEFAULT 'text'                |
| display_order| INT UNSIGNED     | DEFAULT 0                        |
| created_at   | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |

`detail_key` values: `crop_duration`, `water_requirements`, `fertilizers`, `common_diseases`, `soil_requirements`, `climate`, `harvesting`, `yield_potential`

When `detail_type = 'list'`, `detail_value` stores a JSON array of strings.

Indexes: `UNIQUE(crop_id, detail_key)`, `FK(crop_id → crops.id)`

### 2.4 `disease_detections`

| Column              | Type             | Constraints                     |
|---------------------|------------------|----------------------------------|
| id                  | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| user_id             | INT UNSIGNED     | NULLABLE, FK → users.id ON DELETE SET NULL |
| crop_name           | VARCHAR(100)     | NULLABLE                         |
| image_path          | VARCHAR(500)     | NULLABLE                         |
| symptoms            | TEXT             | NULLABLE (user-described)        |
| disease_name        | VARCHAR(255)     | NOT NULL                         |
| confidence          | DECIMAL(5,2)     | NULLABLE                         |
| symptoms_description| TEXT             | NULLABLE                         |
| treatment_list      | JSON             | NULLABLE                         |
| prevention_list     | JSON             | NULLABLE                         |
| hindi_summary       | VARCHAR(500)     | NULLABLE                         |
| created_at          | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |

Indexes: `INDEX(user_id)`, `FK(user_id → users.id)`

### 2.5 `chat_sessions`

| Column     | Type             | Constraints                     |
|------------|------------------|----------------------------------|
| id         | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| user_id    | INT UNSIGNED     | NULLABLE, FK → users.id ON DELETE SET NULL |
| session_id | VARCHAR(100)     | NOT NULL, UNIQUE (UUID v4)       |
| title      | VARCHAR(255)     | DEFAULT 'New Chat'               |
| created_at | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |
| updated_at | TIMESTAMP        | ON UPDATE CURRENT_TIMESTAMP      |

Indexes: `UNIQUE(session_id)`, `INDEX(user_id)`

### 2.6 `chat_messages`

| Column     | Type             | Constraints                     |
|------------|------------------|----------------------------------|
| id         | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| session_id | VARCHAR(100)     | NOT NULL, FK → chat_sessions.session_id ON DELETE CASCADE |
| role       | ENUM('user','assistant') | NOT NULL                |
| message    | TEXT             | NOT NULL                         |
| created_at | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |

Indexes: `INDEX(session_id)`, `FK(session_id → chat_sessions.session_id)`

### 2.7 `weather_searches`

| Column     | Type             | Constraints                     |
|------------|------------------|----------------------------------|
| id         | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| user_id    | INT UNSIGNED     | NULLABLE, FK → users.id ON DELETE SET NULL |
| location   | VARCHAR(255)     | NOT NULL                         |
| created_at | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |

Indexes: `INDEX(user_id)`

### 2.8 `saved_locations`

| Column     | Type             | Constraints                     |
|------------|------------------|----------------------------------|
| id         | INT UNSIGNED     | PK, AUTO_INCREMENT               |
| user_id    | INT UNSIGNED     | NOT NULL, FK → users.id ON DELETE CASCADE |
| location   | VARCHAR(255)     | NOT NULL                         |
| is_default | TINYINT(1)       | DEFAULT 0                        |
| created_at | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP        |

Indexes: `UNIQUE(user_id, location)`, `FK(user_id → users.id)`

### 2.9 `newsletter_subscribers`

| Column          | Type             | Constraints              |
|-----------------|------------------|--------------------------|
| id              | INT UNSIGNED     | PK, AUTO_INCREMENT       |
| email           | VARCHAR(255)     | NOT NULL, UNIQUE         |
| is_active       | TINYINT(1)       | DEFAULT 1                |
| subscribed_at   | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP|
| unsubscribed_at | TIMESTAMP        | NULLABLE                 |

Indexes: `UNIQUE(email)`

---

## 3. API Endpoints

All endpoints return JSON. Authenticated endpoints require `Authorization: Bearer <jwt>` header.

### 3.1 Authentication

| Method | Path                     | Auth | Description              |
|--------|--------------------------|------|--------------------------|
| POST   | `/api/auth/register`     | No   | Create new account       |
| POST   | `/api/auth/login`        | No   | Login, returns JWT       |
| POST   | `/api/auth/logout`       | Yes  | Invalidate token         |
| GET    | `/api/auth/me`           | Yes  | Get current user profile |
| PUT    | `/api/auth/me`           | Yes  | Update profile (name, avatar) |
| PUT    | `/api/auth/password`     | Yes  | Change password          |
| POST   | `/api/auth/forgot-password` | No | Request password reset   |
| POST   | `/api/auth/reset-password`  | No | Reset with token       |

**POST `/api/auth/register`**
```json
// Request
{ "name": "Ramesh Kumar", "email": "ramesh@example.com", "password": "securePass123" }

// Response 201
{ "success": true, "message": "Account created", "data": { "user": { "id": 1, "name": "Ramesh Kumar", "email": "ramesh@example.com" }, "token": "eyJ..." } }
```

**POST `/api/auth/login`**
```json
// Request
{ "email": "ramesh@example.com", "password": "securePass123" }

// Response 200
{ "success": true, "data": { "user": { "id": 1, "name": "Ramesh Kumar", "email": "ramesh@example.com", "avatar_url": null }, "token": "eyJ..." } }
```

### 3.2 Crops

| Method | Path                          | Auth | Description              |
|--------|-------------------------------|------|--------------------------|
| GET    | `/api/crops`                  | No   | List all crops           |
| GET    | `/api/crops/{slug}`           | No   | Single crop with details |
| GET    | `/api/crops/category/{cat}`   | No   | Filter by category       |
| GET    | `/api/crops/season/{season}`  | No   | Filter by season         |

**GET `/api/crops`**
```json
// Response 200
{ "success": true, "data": [
  { "id": 1, "slug": "wheat", "name": "Wheat", "short_description": "Rabi season crop, staple food grain", "image_url": "/uploads/crops/wheat.jpg", "season": "Rabi", "category": "Cereal" },
  ...
]}
```

**GET `/api/crops/wheat`**
```json
// Response 200
{ "success": true, "data": {
  "crop": { "id": 1, "slug": "wheat", "name": "Wheat", ... },
  "details": [
    { "key": "crop_duration", "value": "110-130 days from sowing to harvest", "type": "text" },
    { "key": "water_requirements", "value": "Requires 4-6 irrigations...", "type": "text" },
    { "key": "fertilizers", "value": ["Nitrogen: 120-150 kg/ha...", "Phosphorus: 60-80 kg/ha..."], "type": "list" },
    { "key": "common_diseases", "value": ["Rust: Use resistant varieties...", "Karnal bunt: Seed treatment..."], "type": "list" },
    ...
  ]
}}
```

### 3.3 Disease Detection

| Method | Path                          | Auth | Description                    |
|--------|-------------------------------|------|--------------------------------|
| POST   | `/api/disease/detect`         | No   | Analyze crop image + symptoms  |
| GET    | `/api/disease/history`        | Yes  | User's detection history       |
| GET    | `/api/disease/{id}`           | Yes  | Single detection result        |
| DELETE | `/api/disease/{id}`           | Yes  | Delete detection record        |

**POST `/api/disease/detect`** — Accepts `multipart/form-data`
| Field    | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| image    | File   | Yes      | Crop leaf/plant image (JPEG/PNG, max 5MB) |
| crop_name| String | No       | e.g. "wheat"      |
| symptoms | String | Yes      | User-described symptoms |

```json
// Response 200
{ "success": true, "data": {
  "id": 45,
  "disease_name": "Leaf Rust",
  "confidence": 92.5,
  "symptoms_description": "Small, round to oval yellow spots on leaves that develop into reddish-brown pustules.",
  "treatment_list": ["Spray Propiconazole (Tilt 25EC) at 0.1%", "Apply Mancozeb (Dithane M-45) at 0.2%"],
  "prevention_list": ["Use certified disease-free seeds", "Practice crop rotation"],
  "hindi_summary": "गेहूं की पत्तियों पर भूरे धब्बे दिखाई दे रहे हैं। प्रोपिकोनाजोल 0.1% का छिड़काव करें।",
  "image_url": "/uploads/diseases/abc123.jpg",
  "created_at": "2025-05-15T10:30:00Z"
}}
```

### 3.4 Chat

| Method | Path                               | Auth | Description              |
|--------|------------------------------------|------|--------------------------|
| POST   | `/api/chat/sessions`               | No   | Create new session       |
| GET    | `/api/chat/sessions`               | Yes  | List user's sessions     |
| GET    | `/api/chat/sessions/{sessionId}`   | No   | Get messages in session  |
| POST   | `/api/chat/sessions/{sessionId}`   | No   | Send message + get reply |
| DELETE | `/api/chat/sessions/{sessionId}`   | Yes  | Delete session           |

**POST `/api/chat/sessions/{sessionId}`**
```json
// Request
{ "message": "गेहूं में खाद कब डालें?" }

// Response 200
{ "success": true, "data": {
  "user_message": { "role": "user", "message": "गेहूं में खाद कब डालें?", "created_at": "..." },
  "bot_reply": { "role": "assistant", "message": "गेहूं में नाइट्रोजन की आधी मात्रा बुवाई के समय और बाकी दो भागों में...", "created_at": "..." }
}}
```

### 3.5 Weather

| Method | Path                             | Auth | Description              |
|--------|----------------------------------|------|--------------------------|
| GET    | `/api/weather/current?q=Indore`  | No   | Current weather          |
| GET    | `/api/weather/forecast?q=Indore` | No   | 5-day/3-hour forecast    |
| GET    | `/api/weather/history`           | Yes  | User's search history    |
| POST   | `/api/weather/locations`         | Yes  | Save a location          |
| GET    | `/api/weather/locations`         | Yes  | List saved locations     |
| DELETE | `/api/weather/locations/{id}`    | Yes  | Remove saved location    |

**GET `/api/weather/current?q=Indore`**
```json
// Response 200
{ "success": true, "data": {
  "location": "Indore, IN",
  "temperature": 32.5,
  "description": "scattered clouds",
  "icon": "cloud",
  "humidity": 45,
  "wind_speed": 12.3,
  "feels_like": 34.1
}}
```

### 3.6 Newsletter

| Method | Path                              | Auth | Description              |
|--------|-----------------------------------|------|--------------------------|
| POST   | `/api/newsletter/subscribe`       | No   | Subscribe email          |
| POST   | `/api/newsletter/unsubscribe`     | No   | Unsubscribe email        |

**POST `/api/newsletter/subscribe`**
```json
// Request
{ "email": "farmer@example.com" }

// Response 201
{ "success": true, "message": "Subscribed successfully" }
```

### 3.7 Health

| Method | Path           | Auth | Description |
|--------|----------------|------|-------------|
| GET    | `/api/health`  | No   | Server + DB status |

---

## 4. Authentication Flow

### JWT-Based Auth

```
┌──────────┐         ┌──────────────┐         ┌───────────┐
│  Client  │         │   Backend    │         │ Database  │
└────┬─────┘         └──────┬───────┘         └─────┬─────┘
     │  POST /auth/login    │                       │
     │  {email, password}   │                       │
     │─────────────────────>│                       │
     │                      │  SELECT * FROM users   │
     │                      │  WHERE email = ?      │
     │                      │──────────────────────>│
     │                      │  user row             │
     │                      │<──────────────────────│
     │                      │                       │
     │                      │  password_verify()     │
     │                      │  → JWT {sub, name,    │
     │                      │    iat, exp}          │
     │  200 {token, user}   │                       │
     │<─────────────────────│                       │
     │                      │                       │
     │  GET /auth/me        │                       │
     │  Authorization:      │                       │
     │  Bearer <token>      │                       │
     │─────────────────────>│                       │
     │                      │  JWT::decode()        │
     │                      │  → payload.sub       │
     │                      │                       │
     │  200 {user}          │                       │
     │<─────────────────────│                       │
```

**Token payload:**
```json
{
  "sub": 1,
  "email": "ramesh@example.com",
  "name": "Ramesh Kumar",
  "iat": 1747296000,
  "exp": 1747382400
}
```

- Token expiry: 24 hours (configurable in `config/app.php`)
- Refresh: client re-logs in or uses a refresh token endpoint
- Password hashing: `password_hash()` with `PASSWORD_BCRYPT` (cost 12)

### Middleware Chain

```
Request → CorsMiddleware → RateLimitMiddleware → AuthMiddleware (if route requires) → Controller
```

---

## 5. External Service Integration

### 5.1 Groq AI (`services/GroqService.php`)

```
Backend (PHP) ──POST──> https://api.groq.com/openai/v1/chat/completions
         ↑                      |
         └─────── Response ─────┘
```

- API key stored in `config/app.php` (environment variable, not hardcoded)
- Two call patterns:
  1. **Disease detection** → system prompt asks for JSON response, parsed into structured result
  2. **Chat** → streaming-friendly (optional SSE), plain text response
- Error handling: timeout (30s), rate-limit backoff, fallback response

### 5.2 OpenWeatherMap (`services/WeatherService.php`)

```
Backend (PHP) ──GET──> https://api.openweathermap.org/data/2.5/weather?q=...&appid=...
                  ──GET──> https://api.openweathermap.org/data/2.5/forecast?q=...&appid=...
```

- API key from environment variable
- Response caching (file-based or DB cache, TTL 10 minutes)
- Units: metric (Celsius)

---

## 6. Data Flow for Key Operations

### 6.1 Disease Detection Flow

```
Client                          Backend                       Groq AI
  │                               │                             │
  │ POST /disease/detect          │                             │
  │ (image + symptoms)            │                             │
  │ ─────────────────────────────>│                             │
  │                               │  Save image to uploads/     │
  │                               │                             │
  │                               │  Build prompt:              │
  │                               │   system: "You are Krishi   │
  │                               │    Sahayata..."             │
  │                               │   user: crop + symptoms    │
  │                               │ ───────────────────────────>│
  │                               │                             │
  │                               │  { disease_name,            │
  │                               │    confidence,              │
  │                               │    symptoms_description,    │
  │                               │    treatment_list,          │
  │                               │    prevention_list,         │
  │                               │    short_hindi_summary }    │
  │                               │<─────────────────────────── │
  │                               │                             │
  │                               │  INSERT into                │
  │                               │  disease_detections         │
  │                               │                             │
  │  200 { detection result }    │                             │
  │<─────────────────────────────│                             │
```

### 6.2 Chat Flow

```
Client                          Backend                       Groq AI
  │                               │                             │
  │ POST /chat/sessions/{sid}     │                             │
  │ { message }                   │                             │
  │ ─────────────────────────────>│                             │
  │                               │  INSERT user message        │
  │                               │                             │
  │                               │  Build prompt with context  │
  │                               │  (last N messages from      │
  │                               │   this session)             │
  │                               │                             │
  │                               │ ───────────────────────────>│
  │                               │                             │
  │                               │  { response text }          │
  │                               │<─────────────────────────── │
  │                               │                             │
  │                               │  INSERT bot reply           │
  │                               │  UPDATE session updated_at  │
  │                               │                             │
  │  200 { user_msg, bot_reply } │                             │
  │<─────────────────────────────│                             │
```

---

## 7. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Password storage | `password_hash(PASSWORD_BCRYPT, ['cost' => 12])` |
| SQL injection | PDO prepared statements exclusively |
| XSS | `htmlspecialchars()` on all output; Content-Type: application/json |
| CSRF | Token-based auth (Bearer JWT), no cookies |
| File upload | Validate MIME type, randomize filename, limit to 5MB, check magic bytes |
| Rate limiting | 60 requests/min per IP; 10/min for auth endpoints |
| CORS | Only allow the frontend origin in production |
| API keys | Environment variables (`.env`), never in code or repo |
| JWT | HS256 or RS256, short expiry (24h), stored in `Authorization` header |
| Input validation | Whitelist-based validation in `Validator.php` |
| Logging | No sensitive data (passwords, tokens) in logs |

---

## 8. Error Response Format

All errors follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The email field is required.",
    "details": {
      "email": ["The email field is required."],
      "password": ["Password must be at least 6 characters."]
    }
  }
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created (register, subscribe) |
| 400 | Validation error, bad request |
| 401 | Missing/invalid token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## 9. Frontend Integration (Migration Path)

The existing frontend (`script.js`) will need these changes to work with the backend:

| Current Behavior | New Behavior |
|-----------------|--------------|
| `localStorage` auth | API calls to `/api/auth/*`, JWT stored in `localStorage` |
| Static HTML crop details | Fetch from `GET /api/crops/{slug}` and render dynamically |
| Direct Groq API calls | POST to `/api/disease/detect` and `/api/chat/sessions/{id}` (backend proxies Groq) |
| Direct OpenWeatherMap calls | GET `/api/weather/current` and `/api/weather/forecast` (backend proxies + caches) |
| No persistence for disease results | GET `/api/disease/history` to show past results |
| Newsletter form does nothing | POST `/api/newsletter/subscribe` |

### Gradual Adoption Strategy

1. **Phase 1:** Deploy backend with auth + crops endpoints only
2. **Phase 2:** Migrate disease detection and chat to proxy through backend
3. **Phase 3:** Move weather API calls behind backend proxy (with caching)
4. **Phase 4:** Enable history features, newsletter, saved locations

---

## 10. Configuration (`config/app.php`)

```php
return [
    'db' => [
        'host'     => $_ENV['DB_HOST'] ?? 'localhost',
        'port'     => $_ENV['DB_PORT'] ?? 3306,
        'database' => $_ENV['DB_NAME'] ?? 'krishi_sahayata',
        'username' => $_ENV['DB_USER'] ?? 'root',
        'password' => $_ENV['DB_PASS'] ?? '',
        'charset'  => 'utf8mb4',
    ],
    'jwt' => [
        'secret'     => $_ENV['JWT_SECRET'] ?? 'change-this-in-production',
        'algorithm'  => 'HS256',
        'expiry'     => 86400, // 24 hours
    ],
    'api_keys' => [
        'groq'    => $_ENV['GROQ_API_KEY'] ?? '',
        'weather' => $_ENV['WEATHER_API_KEY'] ?? '',
    ],
    'cors' => [
        'allowed_origins' => ['http://localhost:5500', 'http://127.0.0.1:5500'],
        'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ],
    'upload' => [
        'max_size'     => 5 * 1024 * 1024, // 5MB
        'allowed_mimes' => ['image/jpeg', 'image/png', 'image/webp'],
        'path'         => __DIR__ . '/../uploads/diseases',
    ],
    'rate_limit' => [
        'requests_per_minute' => 60,
        'auth_requests_per_minute' => 10,
    ],
];
```

---

## 11. Entry Point (`public/index.php`) Pseudocode

```
1. Load Composer autoload
2. Load config (app.php, database.php)
3. Set CORS headers
4. Parse request URI and method
5. Apply rate-limit middleware
6. Match route:
   a. If route requires auth → run AuthMiddleware (verify JWT)
   b. Instantiate controller → call method
7. Controller processes request, calls models/services
8. Return JSON response via Response helper
9. On error → catch Exception → log → return error JSON
```
