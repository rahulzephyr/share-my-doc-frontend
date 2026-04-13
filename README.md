# MyDoc Frontend

React + TypeScript web application for MyDoc - a document storage system with Telegram bot retrieval.

## Features

- 📱 Phone number based authentication
- 📄 Document upload with custom key names
- 🎨 Modern, responsive UI
- ⚡ Fast development with Vite

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Router**: React Router DOM
- **HTTP Client**: Axios
- **Styling**: CSS-in-JS (inline styles)

## Prerequisites

- Node.js 20+
- Backend API running at `http://localhost:3001`

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

App runs at `http://localhost:3000`

### 3. Build for Production

```bash
npm run build
```

Output is in `dist/` folder.

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Main component with routes
│   ├── crypto/
│   │   ├── CryptoService.ts  # Encryption utilities
│   │   └── KeyManager.ts     # Key management
│   └── services/
│       ├── api.service.ts    # Backend API calls
│       └── ocr.service.ts    # OCR processing
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── tsconfig.node.json        # Node TypeScript config
└── package.json
```

## Pages

### Authentication (`/login`)

- **Create Account**: Register with phone number (required), email (optional), password
- **Sign In**: Login with phone number and password

### Dashboard (`/dashboard`)

- View uploaded documents
- Upload new documents with key name
- Delete documents
- See storage usage

## Document Upload

When uploading a document:

1. Select file (images, PDFs supported)
2. Choose document type (Aadhaar, PAN, Passport, etc.)
3. Enter a **Key Name** - this is used to retrieve via Telegram

Example: Upload passport.pdf with key name "passport" → In Telegram, type "passport" to retrieve it.

## API Configuration

The app connects to backend at `http://localhost:3001` by default.

To change, update `baseURL` in `src/services/api.service.ts`:

```typescript
const api = axios.create({
  baseURL: "http://localhost:3001/api", // Change this
});
```

For production, use environment variables:

```typescript
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
```

## Scripts

```bash
npm run dev       # Start dev server with hot reload
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Telegram Integration

After uploading documents via web:

1. Open Telegram and find your bot
2. Share your phone number (same as used during registration)
3. Type document key name (e.g., "passport")
4. Bot sends the document

## Styling

The app uses inline CSS-in-JS styles defined in `App.tsx`. Key design elements:

- Dark theme with purple accent (`#7c3aed`)
- Card-based layouts
- Responsive design
- Clean, modern aesthetic

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires Web Crypto API support.

## Related

- [Backend Repository](https://github.com/rahulzephyr/share-my-doc-backend)

## License

MIT
