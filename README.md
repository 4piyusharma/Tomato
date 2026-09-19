# 🍅 Tomato (Foodify)

A full-stack food delivery platform built with a microservices architecture. Customers order from nearby restaurants, restaurants manage menus and orders, riders pick up and deliver, and admins verify restaurants and riders, all with live order updates and map tracking.

**Live Demo:** [ADD LINK] | **Repository:** [ADD LINK]

<!-- ![Screenshot](./docs/screenshot.png) -->

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Order Lifecycle](#order-lifecycle)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Real-time Events](#real-time-events)
- [Running with Docker](#running-with-docker)
- [Deployment](#deployment)
- [Author](#author)

## Features

**Customers**
- Sign in with Google
- Browse nearby restaurants (geo-based search) and view menus
- Cart with quantity controls, saved delivery addresses
- Pay with Razorpay or Stripe
- Live order status updates and rider location on an interactive map

**Restaurants (sellers)**
- Create and edit a restaurant profile with image upload
- Add, delete and toggle availability of menu items
- Receive new orders in real time and move them through accepted → preparing → ready for rider

**Riders**
- Create a rider profile and toggle availability
- Get notified of nearby orders, accept them, and update delivery status
- Route visualization to the restaurant and customer with Leaflet Routing Machine

**Admins**
- Review and verify pending restaurants and riders

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, Leaflet, React Leaflet, Leaflet Routing Machine, Socket.IO Client |
| Backend | Node.js, Express 5, TypeScript |
| Database | MongoDB with Mongoose |
| Messaging | RabbitMQ (amqplib) |
| Real-time | Socket.IO |
| Auth | Google OAuth, JWT |
| Payments | Razorpay, Stripe |
| Media | Cloudinary |
| DevOps | Docker (multi-stage builds), Vercel (frontend) |

## Architecture

The backend is split into six services, each with a single responsibility.

| Service | Default Port | Responsibility |
|---------|--------------|----------------|
| `auth` | 5000 | Google login, JWT issuing, user profile, role selection |
| `restaurant` | 5001 | Restaurants, menu items, cart, addresses, orders |
| `utils` | 5002 | Cloudinary uploads and payment processing (Razorpay, Stripe) |
| `realtime` | 5004 | Socket.IO server; receives emit requests from other services |
| `rider` | 5005 | Rider profiles, availability, order acceptance and status |
| `admin` | 5006 | Verification of restaurants and riders |

Ports 5000 to 5006 are the URLs hard-coded in `frontend/src/main.tsx`. Ports are otherwise set through each service's `.env`.

```
                        React (Vite)
                             │
      REST + Socket.IO (JWT in Authorization header / socket auth)
   ┌────────┬────────┬───────┼────────┬──────────┬────────┐
   ▼        ▼        ▼       ▼        ▼          ▼        ▼
 auth   restaurant  utils  realtime  rider     admin     MongoDB
            │  ▲      │       ▲        │  ▲
            │  │      │       │        │  │
            │  └──────┼───────┼────────┘  │
            ▼         ▼       │           │
         ┌───────────────  RabbitMQ  ─────┘
         │  payment queue · rider queue · order-ready queue
         └──────────────────────────────────
     Services call realtime's internal /emit endpoint over HTTP
     (protected by INTERNAL_SERVICE_KEY) to push events to clients.
```

**How the services talk to each other**

- **RabbitMQ:** `utils` publishes `PAYMENT_SUCCESS` after a verified payment. `restaurant` consumes it, marks the order as paid and placed. When a restaurant marks an order ready, `ORDER_READY_FOR_RIDER` is published and `rider` consumes it to find nearby available, verified riders (within 500 m).
- **Internal HTTP:** services call `realtime` at `POST /api/v1/internal/emit` with an `x-internal-key` header. `realtime` then emits to Socket.IO rooms.
- **Socket rooms:** each connected user joins `user:<userId>`, and sellers also join `restaurant:<restaurantId>`.

## Order Lifecycle

```
placed → accepted → preparing → ready_for_rider → rider_assigned → picked_up → delivered
                                                                  (cancelled)
```

1. The customer creates an order and pays (Razorpay or Stripe).
2. Payment success moves the order to `placed` and notifies the restaurant (`order:new`).
3. The restaurant advances it: `accepted` → `preparing` → `ready_for_rider`.
4. Nearby riders are notified (`order:available`); the first to accept gets it (`rider_assigned`).
5. The rider updates the order to `picked_up` and `delivered`. The customer sees updates and rider location live.

## Project Structure

```
tomato-code/
├── frontend/                 # React + Vite app
│   └── src/
│       ├── components/       # Navbar, cards, maps, rider/restaurant widgets
│       ├── context/          # AppContext (auth, cart, location), SocketContext
│       ├── pages/            # Home, Cart, Checkout, Orders, Rider dashboard, Admin...
│       ├── utils/            # Order status flow
│       └── types.ts
├── services/
│   ├── auth/                 # Login, roles, profile
│   ├── restaurant/           # Restaurants, menu, cart, address, orders
│   ├── rider/                # Rider profile and delivery flow
│   ├── admin/                # Verification endpoints
│   ├── realtime/             # Socket.IO server
│   └── utils/                # Uploads and payments
└── Project_Setup_Guide.pdf
```

Each service follows the same layout: `src/{config,controllers,middlewares,models,routes}`, plus a `Dockerfile`.

## Getting Started

### Prerequisites

- Node.js 22 (the Dockerfiles use `node:22-alpine`)
- MongoDB (local or Atlas)
- RabbitMQ (easiest via Docker, see below)
- A Google Cloud OAuth client ID and secret
- Razorpay and Stripe test keys
- A Cloudinary account

### 1. Clone and install

```bash
git clone [ADD REPO URL]
cd tomato-code

# Frontend
cd frontend && npm install && cd ..

# Services
for s in auth restaurant utils realtime rider admin; do
  (cd services/$s && npm install)
done
```

### 2. Start RabbitMQ

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management
```

The management UI is at `http://localhost:15672` (default login `guest` / `guest`). Your `RABBITMQ_URL` will then be `amqp://localhost`.

### 3. Configure environment variables

Create a `.env` in each service and in `frontend/` using the tables in [Environment Variables](#environment-variables).

Then open `frontend/src/main.tsx` and replace the Google Client ID in `GoogleOAuthProvider` with your own. In the Google Cloud Console, add `http://localhost:5173` as an authorized JavaScript origin.

> **Important:** `admin` must use the **same `DB_NAME`** as the other services so that it sees the same restaurants and riders.

### 4. Run everything

Run each service in its own terminal:

```bash
cd services/auth        && npm run dev
cd services/restaurant  && npm run dev
cd services/utils       && npm run dev
cd services/realtime    && npm run dev
cd services/rider       && npm run dev
cd services/admin       && npm run dev
```

Then the frontend:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`.

## Environment Variables

### `services/auth`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SEC` | Secret used to sign JWTs (must match all services) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### `services/restaurant`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5001) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SEC` | Same JWT secret |
| `UTILS_SERVICE` | Base URL of the utils service |
| `REALTIME_SERVICE` | Base URL of the realtime service |
| `INTERNAL_SERVICE_KEY` | Shared key for service-to-service calls |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `PAYMENT_QUEUE` | Queue name for payment events |
| `RIDER_QUEUE` | Queue name for rider events |
| `ORDER_READY_QUEUE` | Queue name for order-ready events |

### `services/rider`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5005) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SEC` | Same JWT secret |
| `UTILS_SERVICE`, `REALTIME_SERVICE`, `RESTAURANT_SERVICE` | Base URLs of the other services |
| `INTERNAL_SERVICE_KEY` | Shared internal key |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `RIDER_QUEUE`, `ORDER_READY_QUEUE` | Queue names |

### `services/utils`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5002) |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_SECRET_KEY` | Cloudinary credentials (required; the service will not start without them) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay credentials |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `FRONTEND_URL` | Frontend URL, used for Stripe redirects |
| `RESTAURANT_SERVICE` | Base URL of the restaurant service |
| `INTERNAL_SERVICE_KEY` | Shared internal key |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `PAYMENT_QUEUE` | Queue name for payment events |

### `services/realtime`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5004 in the frontend config) |
| `JWT_SEC` | Same JWT secret (used to authenticate sockets) |
| `INTERNAL_SERVICE_KEY` | Shared internal key |

### `services/admin`

| Variable | Description |
|----------|-------------|
| `PORT` | Port (default 5006 in the frontend config) |
| `MONGO_URI` | MongoDB connection string |
| `DB_NAME` | Database name (same as the other services) |
| `JWT_SEC` | Same JWT secret |

### `frontend`

| Variable | Description |
|----------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_INTERNAL_SERVICE_KEY` | Internal service key used by the frontend |

## API Overview

All routes except payment, upload and internal ones require `Authorization: Bearer <token>`.

**Auth** (`/api/auth`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/login` | Log in with Google |
| PUT | `/add/role` | Set role (`customer`, `rider`, `seller`) |
| GET | `/me` | Current user profile |

**Restaurant** (`/api/restaurant`, `/api/item`, `/api/cart`, `/api/address`, `/api/order`)

| Area | Routes |
|------|--------|
| Restaurant | `POST /new`, `GET /my`, `PUT /status`, `PUT /edit`, `GET /all` (nearby), `GET /:id` |
| Menu items | `POST /new`, `GET /all/:id`, `DELETE /:itemId`, `PUT /status/:itemId` |
| Cart | `POST /add`, `GET /all`, `PUT /inc`, `PUT /dec`, `DELETE /clear` |
| Address | `POST /new`, `GET /all`, `DELETE /:id` |
| Order | `POST /new`, `GET /myorder`, `GET /:id`, `GET /restaurant/:restaurantId`, `PUT /:orderId`, plus internal rider routes |

**Rider** (`/api/rider`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/new` | Create rider profile |
| GET | `/myprofile` | Get rider profile |
| PATCH | `/toggle` | Toggle availability |
| POST | `/accept/:orderId` | Accept an order |
| GET | `/order/current` | Current order |
| PUT | `/order/update/:orderId` | Update delivery status |

**Admin** (`/api/v1`, admin role only)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/restaurant/pending` | Pending restaurants |
| GET | `/admin/rider/pending` | Pending riders |
| PATCH | `/verify/restaurant/:id` | Verify a restaurant |
| PATCH | `/verify/rider/:id` | Verify a rider |

**Utils** (`/api`)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/upload` | Upload an image to Cloudinary |
| POST | `/payment/create` | Create a Razorpay order |
| POST | `/payment/verify` | Verify a Razorpay payment |
| POST | `/payment/stripe/create` | Create a Stripe session |
| POST | `/payment/stripe/verify` | Verify a Stripe payment |

### Creating an admin

The `add/role` endpoint only allows `customer`, `rider` and `seller`. To create an admin, sign in once, then set that user's `role` to `"admin"` directly in the database.

## Real-time Events

Sockets authenticate with the JWT via `socket.handshake.auth.token`.

| Event | Sent to | Purpose |
|-------|---------|---------|
| `order:new` | `restaurant:<id>` | A paid order was placed |
| `order:update` | `user:<id>` | Order status changed |
| `order:available` | `user:<riderId>` | A nearby order needs a rider |
| `order:rider_assigned` | customer, restaurant, rider | A rider accepted the order |
| `rider:location` | customer | Rider's live position |

## Running with Docker

Each service has its own multi-stage `Dockerfile` (`node:22-alpine`). Build and run a service like this:

```bash
cd services/auth
docker build -t tomato-auth .
docker run --env-file .env -p 5000:5000 tomato-auth
```

Repeat for the other services. A root `docker-compose.yml` would make this a single command and is a good next step.

## Deployment

- **Frontend:** `frontend/vercel.json` rewrites all routes to `index.html`, so it deploys to Vercel as a single-page app. Before deploying, replace the `localhost` service URLs in `frontend/src/main.tsx` with your deployed service URLs.
- **Backend:** build each service with `npm run build` and start it with `npm start`, or use the provided Dockerfiles.

## Author

**Piyush Sharma**
[LinkedIn](https://linkedin.com/in/4piyushsharma) | [GitHub](https://github.com/4piyushsharma) | 4piyusharma@gmail.com
