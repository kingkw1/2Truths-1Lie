<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

**Recommendation:**  
The best platform for your needs—**ease of use, low cost (free), and fast setup**—is **Railway.app**. Railway is exceptionally friendly for first-time cloud deployers, has a generous free tier, excellent FastAPI (Python) support, native FFmpeg compatibility, built-in HTTPS, and an intuitive web dashboard. Apps deploy in minutes and you can upgrade later with minimal friction.

***

# Step-by-Step: Deploy FastAPI + FFmpeg Backend on Railway

***

### 1. **Create a Railway Account**
- Go to [https://railway.app/](https://railway.app/)
- Click **Sign Up** (GitHub login recommended for easiest integration)

***

### 2. **Prepare Your FastAPI Project**

- Ensure your backend directory has:
  - `main.py` (your FastAPI entrypoint)
  - `requirements.txt` (list dependencies: `fastapi`, `uvicorn`, `boto3`, `python-multipart`, `ffmpeg-python`, etc.)
  - Any other code files.
- Verify FFmpeg is not just a Python dependency; it's a system package. **Railway provides FFmpeg pre-installed on builds**.

***

### 3. **Initialize Git and Push to GitHub**

If you haven’t already:
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create <your-repo-name> --public  # Or use GitHub Desktop/GitHub web UI
git push -u origin main
```

***

### 4. **Deploy on Railway**

#### A. Connect Railway to Your GitHub
- In Railway dashboard, click **"New Project" > "Deploy from GitHub Repo"**.
- Connect your GitHub account if prompted.

#### B. Select Your Repo
- Select your backend repo.

#### C. Set Up Rails and Environment
- Railway will auto-detect Python and propose a deploy workflow.
- When prompted for the start command, enter:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

#### D. Environment Variables
- Go to the project dashboard > **Variables**.
- Add all required env vars (e.g., `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, any S3 config, secret JWT keys, etc.).
- **Do not put secrets in the Git repo.**

#### E. (Optional) Persistent Storage
- If you need a database (e.g., PostgreSQL/SQLite goes beyond in-memory), select **"Add Plugin"** > choose a database.  
  - Note: SQLite in-memory is okay for early dev, but use Postgres for scaling.

***

### 5. **Confirm FFmpeg Is Available**

Railway deploys all containers with FFmpeg included.  
- In the Railway dashboard → "Deployments" tab, open your app's shell and try:
  ```bash
  ffmpeg -version
  ```
  If this works, you're good!

***

### 6. **Wait for Deploy & Get Your Public URL**

- Once deployed, you’ll get a Railway-provided `2truths-1lie-production.up.railway.app` URL.
- Test this URL in your browser; append `/docs` to confirm FastAPI swagger docs are live.

***

### 7. **Update Your Mobile App’s API Base URL**

- In your app’s config or `.env`, update the backend base URL to your new Railway domain.

***

### 8. **Verify Merging and End-to-End Flows**
- Upload three video files via your app or Postman.
- Confirm merging works and the merged output appears (S3, playback, etc.).

***

### 9. **Monitor Usage**
- Railway dashboard shows logs, errors, and resource use.
- Free tier covers hundreds of hours per month—plenty for hackathons and MVP.

***

## **Quick Recap Table**

| Step                  | Summary                                               |
|-----------------------|------------------------------------------------------|
| 1. Sign Up Railway    | https://railway.app/                                 |
| 2. Prepare Backend    | main.py, requirements.txt, env vars                  |
| 3. Push to GitHub     | Manage your project in a versioned repo              |
| 4. Deploy via Railway | Connect, select repo, deploy, and configure env vars |
| 5. FFmpeg Preinstalled| Confirm with `ffmpeg -version` in deploy shell       |
| 6. Get Domain         | Public https://...up.railway.app URL                 |
| 7. Update Mobile App  | Point API to new Railway backend                     |
| 8. Test End-to-End    | Upload, merge, serve videos                          |
| 9. Monitor            | Railway dashboard for logs/health                    |

***