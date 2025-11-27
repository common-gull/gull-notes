# Gull Notes

Private notes that stay private. Encrypted on your device, readable only by you.

## Features

- **AES-256 Encryption** — Note titles, tags, and content are encrypted before they touch storage
- **Local-First** — Runs entirely in your browser with IndexedDB. No account needed
- **Zero-Knowledge** — Only you can decrypt your notes. No exceptions
- **Vault System** — Organize notes into password-protected vaults
- **Rich Text Editor** — TipTap-powered editor with markdown support

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/)
- [TipTap](https://tiptap.dev/) editor
- [Dexie](https://dexie.org/) (IndexedDB wrapper)
- [Tailwind CSS](https://tailwindcss.com/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

## Getting Started

```bash
cd app
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run all tests |
| `npm run lint` | Check formatting & linting |
| `npm run check` | Svelte type checking |

## Security

- AES-256-GCM encryption with PBKDF2 key derivation
- Master Key / Data Key hierarchy
- Encrypted metadata cache for search
- Session management and auto-lock

