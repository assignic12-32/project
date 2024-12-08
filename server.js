require('dotenv').config();
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

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

// Initialize passport for Google authentication
app.use(passport.initialize());
app.use(passport.session());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Google OAuth setup
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:3000/auth/google/callback',
        },
        (accessToken, refreshToken, profile, done) => {
            return done(null, profile);
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
        res.redirect('/quiz');
    }
);

// Logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Serve quiz page only if user is authenticated
app.get('/quiz', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// Function to generate marketing strategy
async function generateStrategy(userInput) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API Key is missing.");
            return "Error generating strategy.";
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chatSession = model.startChat({ generationConfig: { temperature: 0.7 } });

        const prompt = `
        Generate a personalized marketing strategy based on the following:
        1. Brand Name: ${userInput[0] || "Unknown"}
        2. Sector: ${userInput[1] || "Not specified"}
        3. Website: ${userInput[2] || "Not provided"}
        4. Instagram Presence: ${userInput[3]}
        5. WhatsApp Marketing: ${userInput[4]}
        6. SEO Investment: ${userInput[5]}
        7. Lead Generation: ${userInput[6]}
        8. Target Audience: ${userInput[7]}
        9. Marketing Budget: ${userInput[8]}
        10. Marketing Goals: ${userInput[9]}
        Please generate this strategy in plain text, not markdown.
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
    if (!userAnswers || userAnswers.length < 10) {
        return res.status(400).json({ error: "Insufficient data provided." });
    }

    try {
        const strategy = await generateStrategy(userAnswers);
        res.json({ strategy });
    } catch (error) {
        console.error("Error in POST /generate:", error);
        res.status(500).json({ error: "Error generating strategy." });
    }
});

// Start Express server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
