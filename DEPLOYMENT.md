# AVA API Deployment Guide

## Render Deployment Configuration

To deploy your AVA API to Render and fix the Swagger CORS issues, follow these steps:

### 1. Environment Variables Setup

In your Render dashboard, set these environment variables:

```bash
# Required
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-frontend-domain.com  # Update this to your actual frontend URL

# Database
MONGODB_URI=mongodb+srv://ava_user:lKwS1ZdAM2wkQQdR@cluster0.rgykqz6.mongodb.net/ava_db?retryWrites=true&w=majority&appName=Cluster0

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# API Keys (replace with actual keys)
GOOGLE_CLOUD_API_KEY=your_google_cloud_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional
LOG_LEVEL=info
```

### 2. Build and Start Commands

**Build Command:**

```bash
npm install && npm run build
```

**Start Command:**

```bash
npm start
```

### 3. Service Configuration

- **Service Type:** Web Service
- **Runtime:** Node.js
- **Region:** Choose closest to your users
- **Plan:** Free tier available, or Standard for production

### 4. CORS Configuration

The API is now configured to:

- Accept requests from your specified `CLIENT_URL`
- Handle CORS properly for Swagger UI
- Support both HTTP and HTTPS protocols
- Work with the deployed URL automatically

### 5. Testing the Deployment

After deployment:

1. Visit your API docs: `https://your-api-name.onrender.com/api-docs`
2. Test the login endpoint with your credentials
3. Verify CORS is working by checking browser console for errors

### 6. Troubleshooting

**Common Issues:**

1. **CORS Errors:** Ensure `CLIENT_URL` is set correctly in environment variables
2. **Database Connection:** Verify `MONGODB_URI` is correct and accessible
3. **JWT Issues:** Ensure `JWT_SECRET` is set and matches your frontend expectations
4. **Swagger Not Loading:** Check that the API is running and accessible
5. **Swagger Making Wrong API Calls:** If Swagger UI is calling `http://localhost:3001` instead of your deployed URL, this is fixed by the updated middleware that properly detects the deployed environment

**Debug Steps:**

1. Check Render logs for any startup errors
2. Verify environment variables are set correctly
3. Test API endpoints directly with curl or Postman
4. Check browser console for CORS or network errors
5. Verify Swagger UI is making requests to the correct deployed URL (should show your deployed URL, not localhost)

### 7. Security Notes

- Change all default API keys before production use
- Use strong JWT secrets
- Consider using environment-specific database connections
- Enable HTTPS in production (Render provides this automatically)
