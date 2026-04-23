# Secret Share

A professional, encrypted secret sharing solution with a request workflow. Built with Node.js, Express, and Web Crypto API for client-side encryption.

## Features

- **Share Mode**: Encrypt and share text securely, just like PrivateBin
  - AES-256-GCM encryption with optional password protection
  - Burn-after-reading (auto-delete after first view)
  - Decryption keys stored in URL fragments (never sent to server)

- **Request Mode**: Create custom forms to request secrets from customers
  - Generate forms with arbitrary fields
  - Customer fills form and data is encrypted client-side
  - Only the customer who fills the form creates the encryption password
  - You receive the encrypted response with a shareable link

## Security

- **Client-side encryption**: All encryption/decryption happens in the browser using Web Crypto API
- **AES-256-GCM**: Industry-standard authenticated encryption
- **PBKDF2**: 600,000 iterations for password-based key derivation (OWASP 2023 recommendation)
- **Keys in URL fragments**: Decryption keys are stored after `#` in URLs and never sent to the server
- **Burn after reading**: Secrets are deleted from the server immediately after first retrieval
- **No plaintext storage**: Server only stores opaque encrypted blobs

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone or copy the project
cd secret-share

# Start the application
docker-compose up -d

# Access the app at http://localhost:3000
```

### Using Docker

```bash
docker build -t secret-share .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data secret-share
```

### Manual Installation

```bash
# Install dependencies
npm install

# Create data directory
mkdir -p data

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

## Usage

### Sharing a Secret

1. Navigate to "Share Secret"
2. Enter your secret text
3. Optionally protect with a password
4. Enable/disable "Burn after reading"
5. Click "Encrypt & Create Link"
6. Share the generated URL with the recipient

### Requesting Secrets

1. Navigate to "Request Secrets"
2. Add fields (e.g., "API Key", "Database Password")
3. Set an encryption password (customer will use this to encrypt their response)
4. Optionally add a password hint
5. Click "Create Request Link"
6. Send the URL to your customer

The customer will:
1. Open the URL
2. Fill in the requested fields
3. Set their own password to encrypt the data
4. Submit the encrypted form

You will receive a link to view the encrypted response, which you'll decrypt using the password the customer created.

## API Endpoints

- `POST /api/share` - Create a shared secret
- `POST /api/request` - Create a request template
- `GET /api/secret/:id` - Retrieve a secret/request/response
- `POST /api/response/:id` - Submit a response to a request
- `GET /api/health` - Health check

## Configuration

Environment variables:
- `PORT` - Server port (default: 3000)

## Architecture

- **Backend**: Node.js + Express + SQLite3
- **Frontend**: Vanilla JavaScript + CSS (no frameworks)
- **Encryption**: Web Crypto API (AES-256-GCM, PBKDF2)
- **Storage**: SQLite database with burn-after-read support

## Project Structure

```
secret-share/
├── public/              # Static frontend files
│   ├── index.html      # Main HTML
│   ├── app.js          # Application logic
│   ├── crypto.js       # Encryption utilities
│   └── styles.css      # Styles
├── server.js           # Express server
├── package.json        # Dependencies
├── Dockerfile          # Docker image
└── docker-compose.yml  # Docker Compose config
```

## License

MIT
