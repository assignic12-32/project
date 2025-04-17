const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Load OAuth credentials
const credintals = JSON.parse(fs.readFileSync('credintals.json', 'utf8'));
const { client_id, client_secret, redirect_uris } = credintals.web;

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Scopes for accessing private videos
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

// Redirect user to Google login
app.get('/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

// Handle OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received:', tokens); // Debugging

    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token received. Try revoking access and logging in again.');
    }

    oauth2Client.setCredentials(tokens);
    fs.writeFileSync('tokens.json', JSON.stringify(tokens));

    res.send('Authentication successful! You can now fetch private videos.');
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).send('Authentication failed.');
  }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join('public', 'index.html'));
});
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html')); // Absolute path
});
app.get('/user-info', async (req, res) => {
  try {
    const user = JSON.parse(fs.readFileSync('user.json', 'utf8'));
    res.json(user);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).send('Failed to fetch user info.');
  }
});

// Fetch private videos
app.get('/private-videos', async (req, res) => {
  try {
    // Load saved tokens
    const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    const { pageToken } = req.query;

    // Fetch videos from the authenticated user's playlist
    const response = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      maxResults: 10,
      playlistId: 'PLO7-VO1D0_6M1xUjj8HxTxskouWx48SNw', // Replace with your playlist ID
      pageToken: pageToken || "",
    });

    const videos = response.data.items;

    // Send the video details to the client
    res.json({
      videos: videos.map(video => ({
        id: video.contentDetails.videoId,  // Use contentDetails.videoId
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.medium.url,  // Include thumbnail
      })),
      nextPageToken: response.data.nextPageToken || null,
    });
  } catch (error) {
    console.error('Error fetching private videos:', error);
    res.status(500).send('Failed to fetch private videos.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
