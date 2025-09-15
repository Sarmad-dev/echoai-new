# EchoAI SaaS MVP

AI-powered customer support and lead qualification chatbots for businesses.

## Features

- 🚀 Next.js 14 with App Router
- 🎨 shadcn/ui components with Tailwind CSS
- 🌙 Light/Dark mode support with next-themes
- ✨ Framer Motion animations
- 📱 Fully responsive design
- 🔧 TypeScript and ESLint configuration

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
└── lib/                # Utility functions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Theme**: next-themes
- **Language**: TypeScript
- **Linting**: ESLint