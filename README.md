# Running Guide (For Instructor Review)

## Environment Requirements
- **Node.js 16+** (recommended 18+)
- **MySQL 5.7+** (ensure it's started and you have a valid account)
- **npm** or **yarn** package manager

## Quick Start

### Step 1: Backend Environment Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Copy environment variable template**
   - Windows: `copy env-example.txt .env`
   - Linux/Mac: `cp env-example.txt .env`

3. **Edit `.env` file**
   Open the `.env` file and fill in the following configuration as needed:
   ```
   DB_HOST=localhost          # Database host address
   DB_USER=root               # Database username
   DB_PASSWORD=your_password  # Database password (important!)
   DB_NAME=campus_trading     # Database name (can remain unchanged)
   DB_PORT=3306               # Database port (MySQL default 3306)
   JWT_SECRET=any_random_string  # JWT secret key (can be any string, e.g., mySecretKey123)
   PORT=5000                  # Backend service port (can remain unchanged)
   NODE_ENV=development       # Environment variable (can remain unchanged)
   ```

4. **Install backend dependencies**
   ```bash
   npm install
   ```

5. **Initialize database** (Important! Must be executed first)

   There are two initialization methods:

   **Method 1: Complete Initialization (Recommended for first-time setup)**

   ```bash
   npm run init-db-complete
   ```

   This creates the complete database structure, including all necessary tables and fields.

   > ⚠️ **Note**: This command will delete the existing `campus_trading` database (if it exists) and recreate it.

   **Method 2: Basic Initialization (if database already exists and only basic tables are needed)**

   ```bash
   npm run init-db
   ```

   This only creates the basic database and table structure. If subsequent features report missing tables or fields, use Method 1.

   After initialization, it's recommended to run the following scripts to create necessary functional tables (can be skipped if using Method 1 complete initialization):

   ```bash
   npm run migrate                # Add user role field
   npm run migrate-errands        # Create errand tasks table
   npm run migrate-conversations  # Create conversation functionality table
   npm run create-payment-credit-tables  # Create payment and credit related tables
   npm run create-disputes-table  # Create disputes table
   npm run create-appeals-table   # Create appeals table (need to run create-disputes-table first)
   ```

6. **Start backend service**
   ```bash
   npm run dev
   ```
   After successful startup, the backend defaults to listening on `http://localhost:5000`

   > **If you encounter database connection failure errors:**
   > - Check if MySQL service is started
   >   - Windows: Open "Services Manager", find MySQL service and ensure it's started
   >   - Linux/Mac: Run `sudo service mysql status` to check status
   > - Verify `DB_PASSWORD` in `.env` file is correct
   > - Verify MySQL user has permission to create databases
   > - Manually test connection: `mysql -u root -p` then enter password to see if connection works

### Step 2: Frontend Environment Setup

1. **Navigate to frontend directory** (in a new terminal window)
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Start frontend development server**
   ```bash
   npm run dev -- --host --port 5173
   ```
   After successful startup, the frontend defaults to running on `http://localhost:5173`

   > **Note:** If the backend runs on a different port or host, you need to modify the API base address in `frontend/src/services/api.js`.

### Step 3: Verify Operation

1. **Access frontend interface**
   Open a browser and visit `http://localhost:5173`

2. **Check backend health status**
   - Browser access: `http://localhost:5000/`
   - Or command line: `curl http://localhost:5000/`
   - Should return server status information

3. **Test functionality**
   - Register a new user account
   - Login to the system
   - Browse and post items

## Additional Notes

- **Database Structure**: It's recommended to use `npm run init-db-complete` for complete initialization, which automatically creates all necessary database tables without manual operation. If using `npm run init-db` for basic initialization, you may need to run additional migration scripts (see Step 5).

- **Admin Account**:
  - Pre-configured admin account: `1230035596@student.must.edu.mo` / Password: `Frankonly5`
  - To create a new admin account:
    1. First register a regular user in the frontend
    2. Use script: `node scripts/set-user-admin.js` (need to modify email in script)
    3. Or directly modify the `role` field in the `users` table to `admin` in the database

- **Common Issues**:
  - **Port already in use**: If ports 5000 or 5173 are occupied, you can modify `PORT` in `.env` or the port number in the frontend startup command
  - **Dependency installation failed**: Try clearing cache and reinstalling: `npm cache clean --force && npm install`
  - **Frontend cannot connect to backend**: Check if the API address in `frontend/src/services/api.js` matches the backend port

## Testing (Black-box + White-box Quick Check)

- **Backend Automated Testing (White-box, Jest + Supertest)**
  ```bash
  cd backend
  npm install          # Skip if already installed
  npm test             # Uses NODE_ENV=test, directly connects to Express, doesn't occupy port
  ```
  Coverage: Health check interface, item creation/update validation (required fields, positive price), purchase flow (insufficient/sufficient balance calls payment), dispute creation parameter validation, errand task creation and pagination parameters (negative page/negative limit correction), item list pagination and search (negative page/negative limit correction, search placeholder binding). Can continue to expand more interface test cases based on this.

- **Black-box Manual Verification Suggestions** (for instructor quick verification)
  1. Register and login with two accounts (buyer/seller), post items in the frontend.
  2. Buyer purchase: Sufficient balance succeeds; insufficient balance is blocked with prompt.
  3. Create dispute -> Admin review -> Appeal, review again, verify status/amount/credit score changes are correct.
  4. Switch Chinese/English: Admin panel and frontend list/detail pages show no language errors.
