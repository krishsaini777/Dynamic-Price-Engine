# Use the official Node.js 18 image as base
FROM node:20-bullseye-slim

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Symlink python3 to python (so child_process spawn('python') works)
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create application directory
WORKDIR /usr/src/app

# Copy the entire project context (this assumes Docker is built from the root)
# But since this Dockerfile is in the backend folder, we should just copy the backend and ml folders.
# To make this easy for Render, we'll assume the Docker context is the repo root.
# Let's adjust the WORKDIR and copy commands assuming Docker context is the repo root.

# If the user builds from backend/:
# Instead of complicating it, let's just create a simple setup for the backend directory
# and assume the user copies ml/ into backend/ml/ or builds from root.

# Actually, the easiest way for Render deployment from a monorepo is to set the Root Directory to `backend`
# and we can't easily access the `ml` folder.
# Wait, the node code does:
# path.join(__dirname, "..", "..", "ml_inference", "predict.py");
# which means from `backend/src/services/mlPredictor.js`, it goes up to `backend/`, then up to root `Dynamic Price Engine/`, then to `ml_inference/predict.py`.
# So the backend EXPECTS `ml_inference` to be adjacent to `backend/`.
# Therefore, the Docker context MUST be the repository root!

WORKDIR /usr/src/app

# Copy package json from backend
COPY backend/package*.json ./backend/

# Install Node dependencies
WORKDIR /usr/src/app/backend
RUN npm install --omit=dev

# Copy Python requirements
WORKDIR /usr/src/app
COPY ml/requirements.txt ./ml/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r ml/requirements.txt

# Copy all source code
COPY . .

# Set working directory to backend to run the server
WORKDIR /usr/src/app/backend

# Expose the API port
EXPOSE 5000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the server
CMD ["npm", "start"]
