# Docker Configuration

This directory contains all Docker-related files for the Budget Manager application.

## Files

- `Dockerfile.frontend` - Multi-stage build for the React frontend
- `Dockerfile.backend` - Node.js backend server
- `README.md` - This documentation

## Usage

The Docker Compose configuration in the root directory references these Dockerfiles:

- Frontend: `./docker/Dockerfile.frontend`
- Backend: `./docker/Dockerfile.backend`

## Building

To build the containers:

```bash
docker-compose build
```

To run the application:

```bash
docker-compose up -d
```

## Environment Variables

Make sure to set up your `.env` file in the project root with:

```
APP_PASSWORD=your_secure_password_here
COINMARKETCAP_API_KEY=your_api_key_here
```
