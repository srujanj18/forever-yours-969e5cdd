# Forever Yours Server

This is the backend server for the Forever Yours application.

## Prerequisites

- Node.js
- npm or yarn
- MongoDB
- Firebase Admin SDK credentials

## Getting Started

1.  **Clone the repository** (if you haven't already).
2.  **Navigate to the `server` directory:**
    ```bash
    cd server
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
    or
    ```bash
    yarn install
    ```
4.  **Create a `.env` file** in the `server` directory and add the following environment variables:
    ```
    MONGO_URI=your_mongodb_connection_string
    CLIENT_URL=http://localhost:3000
    GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
    ```
5.  **Start the server:**
    ```bash
    npm run dev
    ```
    This will start the server in development mode with nodemon, which will automatically restart the server when you make changes.

## Available Scripts

-   `npm start`: Starts the server in production mode.
-   `npm run dev`: Starts the server in development mode.
-   `npm run build`: Compiles the TypeScript code to JavaScript.

## API Endpoints

### Auth

-   `GET /api/auth/profile`: Get the user's profile.
-   `POST /api/auth/generate-invitation`: Generate an invitation for a partner.
-   `POST /api/auth/accept-invitation`: Accept an invitation.

### Messages

-   `GET /api/messages`: Get all messages between partners.
-   `POST /api/messages`: Send a message to a partner.
