# Personal Portfolio

A personal portfolio website built with modern web technologies, showcasing projects and experience. This project uses [Next.js](https://nextjs.org), Redux for state management, and Playwright for end-to-end testing.

## Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org)
- **State Management**: Redux with Redux Toolkit
- **Testing**: Playwright for E2E testing
- **Styling**: Tailwind CSS
- **Font**: [Geist](https://vercel.com/font) by Vercel

## Getting Started

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the portfolio.

## Project Structure

```
├── app/              # Next.js app directory
├── components/       # Reusable React components
├── store/            # Redux store configuration and slices
├── tests/            # Playwright E2E tests
├── public/           # Static assets
└── styles/           # Global styles
```

## Testing

Run end-to-end tests with Playwright:

```bash
# Run tests
npm run test:e2e

# Open Playwright UI
npm run test:e2e:ui
```

## Deployment

This portfolio is configured for deployment on [Vercel](https://vercel.com), but can be deployed on any platform that supports Next.js.

For manual deployment:

```bash
npm run build
npm run start
```

## Contributing

This is a personal portfolio project, but if you find any bugs or have suggestions for improvements, please feel free to open an issue or submit a pull request.

## License

[MIT License](LICENSE)
