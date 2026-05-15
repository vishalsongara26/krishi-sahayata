# 🌾 Krishi Sahayata — Farmer's Assistant

A web-based platform empowering Indian farmers with crop information, AI-powered disease detection, weather forecasts, and a multilingual assistant chatbot.

**Live:** [krishi-sahayata.vercel.app](https://krishi-sahayata.vercel.app)

---

## Features

- **Crop Database** — 27 crops with detailed info (duration, water needs, fertilizers, diseases, soil, climate, harvesting, yield)
- **AI Disease Detection** — Upload crop images + describe symptoms; Groq AI (LLaMA 3.3-70B) diagnoses the issue in Hindi/English
- **AI Chatbot** — Krishi AI Sahayak answers farming questions in Hindi
- **Weather Forecast** — Current weather + 3-day forecast via OpenWeatherMap
- **Multi-Language** — English / हिन्दी toggle with full Hindi translations for all UI and crop data
- **User Authentication** — Login/signup modal with localStorage persistence, avatar dropdown, forgot password
- **Voice Output** — Crop info and chatbot responses read aloud in Hindi
- **Responsive Design** — Mobile-friendly green/earthy theme with smooth animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| APIs | Groq AI (LLaMA 3.3-70B), OpenWeatherMap |
| Auth | Client-side localStorage (JWT-ready for backend) |
| Backend (planned) | PHP + MySQL — see [`design.md`](design.md) |

## Project Structure

```
krishi sahayata/
├── index.html              # Entry point — all UI
├── assets/
│   ├── css/
│   │   └── style.css       # All styles (theme, auth, lang toggle, animations)
│   ├── js/
│   │   └── script.js       # All logic (crops, auth, lang, chatbot, disease, weather)
│   └── images/
│       ├── wheat image.jpg # Crop images (27 total)
│       ├── rice.jpg
│       └── ...
├── design.md               # Backend architecture doc (PHP + MySQL)
└── README.md
```

## Getting Started

### Prerequisites

- A modern web browser
- (Optional) [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for local development

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/vishalsongara26/krishi-sahayata.git
   cd krishi-sahayata
   ```

2. **Set your Groq API key** (required for chatbot + disease detection)
   ```js
   // In browser console:
   localStorage.setItem('groq_api_key', 'gsk_...');
   ```
   Get a free key at [console.groq.com](https://console.groq.com).

3. **Open the app**
   ```bash
   # Using Live Server (recommended)
   # or just open index.html in your browser
   ```

## Usage

| Feature | How to Use |
|---------|-----------|
| Browse Crops | Click any crop card → detailed info opens below |
| Disease Detection | Upload a crop image, describe symptoms → AI analyzes |
| Chatbot | Type a farming question in Hindi/English → AI replies |
| Weather | Enter a city name → current + 3-day forecast |
| Language | Toggle EN / हि in the navbar |
| Auth | Click Login → sign up or log in → avatar appears in navbar |

## Backend (Planned)

See [`design.md`](design.md) for the full backend architecture:

- PHP + MySQL with PDO
- JWT-based authentication
- 9 database tables, 25+ REST endpoints
- Proxy layer for Groq AI + OpenWeatherMap
- Rate limiting, CORS, file uploads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT
