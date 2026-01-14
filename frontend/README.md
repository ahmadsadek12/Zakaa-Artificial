# Zakaa Frontend

Modern React dashboard for Zakaa business management.

## Features

- 🎨 Modern, clean UI with Tailwind CSS
- 📱 Responsive design (mobile-friendly)
- 🔐 Authentication (Login/Register)
- 📊 Dashboard with statistics
- 📦 Order management
- 🏪 Branch management
- 🍽️ Menu & Item management
- 📈 Analytics (Premium)
- ⚙️ Settings

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (optional):
```env
VITE_API_URL=http://localhost:3000
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Lucide React** - Icons
- **Recharts** - Charts (for analytics)

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── contexts/       # React contexts (Auth)
│   ├── pages/          # Page components
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── index.html
└── package.json
```
