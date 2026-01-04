# Product Management API

Production-style Node.js + Express + MySQL backend:
- JWT authentication (bcrypt password hashing)
- Input validation (Zod)
- Security middleware (Helmet, rate limit)
- CRUD endpoints

## Requirements
- Node.js 18+ recommended
- MySQL 8+ (or MariaDB 10.4+)

## Setup

1) Create database
```sql
CREATE DATABASE product_management_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2) Configure environment
```bash
cp .env.example .env
# edit .env
```

3) Install dependencies
```bash
npm install
```

4) Initialize schema
Run the SQL file in your MySQL client:
- `scripts/init.sql`

5) Run server
```bash
npm run dev
# or
npm start
```

Server: `http://localhost:4002`

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

## Notes
- Protected routes require `Authorization: Bearer <token>`
- Ownership: users can only access their own records (admin can access all if role=admin)
