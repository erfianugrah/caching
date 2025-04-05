# Caching Service Admin UI

A modern, responsive administration interface for managing the Caching Service, built with Astro, Shadcn UI, and deployed on Cloudflare Pages.

## Features

- Dashboard with performance metrics
- Asset type configuration management
- Caching strategy settings
- Cache tag management
- Environment-specific configurations
- Cache purge tools and utilities

## Technology Stack

- **Astro** - Fast, lightweight static site generator
- **Shadcn UI** - Unstyled, accessible UI components
- **TypeScript** - Type safety and improved developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **Cloudflare Pages** - Global CDN for static assets
- **Cloudflare Functions** - Serverless API endpoints

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Wrangler CLI (for Cloudflare Pages)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start with Cloudflare Pages integration
npm run cf:pages:dev
```

### Build and Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Cloudflare Pages
npm run cf:pages:deploy
```

## Project Structure

```
admin-ui/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # Shadcn UI components
│   │   └── app/         # Application-specific components
│   ├── layouts/         # Page layouts
│   ├── pages/           # Astro pages
│   ├── styles/          # Global styles and Tailwind config
│   ├── lib/             # Utility functions and API clients
│   ├── models/          # TypeScript interfaces
│   └── api/             # API endpoints (Cloudflare Functions)
├── astro.config.mjs     # Astro configuration
├── tailwind.config.cjs  # Tailwind CSS configuration
└── wrangler.toml        # Cloudflare Pages configuration
```

## Environment Configuration

The application supports different environments through Cloudflare Pages environment variables:

- **Development**: Local development environment
- **Staging**: Pre-production environment for testing
- **Production**: Live production environment

Configuration is managed in `wrangler.toml` and environment-specific variables.

## Authentication

Authentication is handled through Cloudflare Access, providing:

- Secure authentication with your existing identity provider
- Role-based access control
- Audit logging for security compliance

## API Integration

The Admin UI interacts with the Caching Service API for:

- Fetching configuration data
- Updating caching rules
- Managing asset types and strategies
- Viewing telemetry and performance metrics

### API Endpoints

The following API endpoints are available:

- `GET /api/status`: Check API status and environment
- `GET /api/asset-types`: List all asset types
- `POST /api/asset-types`: Create a new asset type
- `GET /api/asset-types/:id`: Get an asset type by ID
- `PUT /api/asset-types/:id`: Update an asset type
- `DELETE /api/asset-types/:id`: Delete an asset type

### Asset Type Configuration

Asset types are a core concept in the caching service. Each asset type defines:

- Pattern matching (regex)
- TTL settings for different status codes (OK, redirects, client errors, server errors)
- Query parameter handling (include/exclude, sorting, normalization)
- Cache directives (stale-while-revalidate, must-revalidate, stale-if-error, etc.)
- Optimization settings (minification, image optimization)

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

ISC © Your Organization