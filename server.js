require('dotenv').config();
const express = require("express");
const fs = require('fs'); // ✅ Fix "fs is not defined" error
// const path = require('path');
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');
const { google } = require('googleapis');

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware for authentication
app.use(
    session({
        secret: process.env.SESSION_SECRET || "your-default-session-secret",
        resave: false,
        saveUninitialized: true,
    })

);
const credintals = JSON.parse(fs.readFileSync('credintals.json', 'utf8'));

const CLIENT_ID = credintals.web.client_id;
const CLIENT_SECRET = credintals.web.client_secret;
const REDIRECT_URI = credintals.web.redirect_uris[0];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);


// Initialize passport for Google authentication
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// Define User model
const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Define Strategy model
const strategySchema = new mongoose.Schema({
    businessName: String,
    sector: String,
    website: String,
    instagramPresence: String,
    whatsappMarketing: String,
    seoInvestment: String,
    leadGeneration: String,
    targetAudience: String,
    marketingBudget: String,
    marketingGoals: String,
    strategy: String,
    lang: String,
});
const Strategy = mongoose.model('Strategy', strategySchema);

// Define Consultation model (for consultation form)
const consultationSchema = new mongoose.Schema({
    name: String,
    phone: String,
    date: { type: Date, default: Date.now }
});
const Consultation = mongoose.model('Consultation', consultationSchema);

// Serve the authentication page (index.html) at the home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the language selection page
app.get('/language', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/'); // If user is not authenticated, redirect to login page
    }
    res.sendFile(path.join(__dirname, 'public', 'language-select.html')); // Language page
});

// Serve quiz page which handles both English and Hindi versions
app.get('/quiz', (req, res) => {
    const lang = req.query.lang || 'en'; // Default to English if no language specified
    res.sendFile(path.join(__dirname, 'public', 'quiz.html')); // Quiz page
});

// Google OAuth setup
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:3000/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ googleId: profile.id });
                if (!user) {
                    user = new User({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        name: profile.displayName,
                    });
                    await user.save();
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Login route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// OAuth callback
app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/language'); // Redirect to /language after successful login
    }
);
app.get('/', (req, res) => {
    res.sendFile(path.join('public', 'index.html'));
});
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html')); // Absolute path
});


app.get('/videos-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'videos..html')); // Create this page
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


// Logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});
// Serve the language selection page with user name



// Function to generate marketing strategy using Gemini AI
async function generateStrategy(userInput, lang) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API Key is missing.");
            return "Error generating strategy.";
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chatSession = model.startChat({ generationConfig: { temperature: 0.7 } });

        const languagePrompt = lang === 'hi' ? "Please generate the strategy in Hindi. The response should contain no special formatting such as asterisks (), bold (*), italics (_), or any markdown symbols. Only plain text should be used." : "Please generate the strategy in English.";

        const prompt = `
        Generate a personalized marketing strategy based on the following:
        1. Business Name: ${userInput[0] || "Unknown"}
        2. Sector: ${userInput[1] || "Not specified"}
        3. Website: ${userInput[2] || "Not provided"}
        4. Instagram Presence: ${userInput[3]}
        5. WhatsApp Marketing: ${userInput[4]}
        6. SEO Investment: ${userInput[5]}
        7. Lead Generation: ${userInput[6]}
        8. Target Audience: ${userInput[7]}
        9. Marketing Budget: ${userInput[8]}
        10. Marketing Goals: ${userInput[9]}
        ${languagePrompt}
        give marketing budget amount in rs currency only;
     Avoid using asterisks(*);
    Avoid using double asterisks(**);
   
        Instructions:
- Please generate the strategy in plain, readable text.
- Avoid using any special formatting such as asterisks (*), double asterisks (**), or other markdown elements.
- Provide a clean response with no markdown symbols or unnecessary characters.
        `;

        const result = await chatSession.sendMessage(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error generating strategy:", error);
        return "Error generating strategy.";
    }
}

// POST endpoint to handle strategy generation logic
app.post('/generate', async (req, res) => {
    const userAnswers = req.body.answers;
    const lang = req.body.lang || 'en'; // Get the language from the request

    if (!userAnswers || userAnswers.length < 10) {
        return res.status(400).json({ error: "Insufficient data provided." });
    }

    try {
        const strategy = await generateStrategy(userAnswers, lang);

        // Save generated strategy to MongoDB
        const newStrategy = new Strategy({
            businessName: userAnswers[0],
            sector: userAnswers[1],
            website: userAnswers[2],
            instagramPresence: userAnswers[3],
            whatsappMarketing: userAnswers[4],
            seoInvestment: userAnswers[5],
            leadGeneration: userAnswers[6],
            targetAudience: userAnswers[7],
            marketingBudget: userAnswers[8],
            marketingGoals: userAnswers[9],
            strategy,
            lang
        });

        await newStrategy.save(); // Save the strategy in the MongoDB database
        res.json({ strategy });
    } catch (error) {
        console.error("Error in POST /generate:", error);
        res.status(500).json({ error: "Error generating strategy." });
    }
});

// Consultation form route (GET request for consultation form)


// POST route to handle consultation form submission
app.post('/consultation', async (req, res) => {
    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ success: false, message: "Name and phone number are required." });
    }

    try {
        // Create a new consultation request
        const newConsultation = new Consultation({
            name,
            phone,
        });

        await newConsultation.save(); // Save to MongoDB

        res.json({ success: true, message: "Consultation request submitted successfully." });
    } catch (error) {
        console.error("Error handling consultation request:", error);
        res.status(500).json({ success: false, message: 'Error saving consultation request.' });
    }
});
// Serve the language selection page
app.get('/language', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/'); // If user is not authenticated, redirect to login page
    }
    const userName = req.user.name; // Fetch user name from session
    res.render('language-select', { userName }); // Pass the user name to the template
});

app.get('/api/get-user-name', (req, res) => {
    if (req.isAuthenticated()) {
        return res.json({ name: req.user.name });
    }
    res.status(401).json({ error: 'User not authenticated' }); // If not authenticated, send error
});


// Start Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
