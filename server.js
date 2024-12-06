// Load environment variables from .env file 
require('dotenv').config();

// Import required modules
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware for form parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware for authentication
app.use(
    session({
        secret: process.env.SESSION_SECRET, // Your session secret
        resave: false,
        saveUninitialized: true,
    })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Google login
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/quiz');
    }
);

// Passport configuration
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'https://project-zdfo.vercel.app/auth/google/callback',
        },
        (accessToken, refreshToken, profile, done) => done(null, profile)
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Quiz route
app.get('/quiz', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// Function to generate strategy
async function generateStrategy(userInput) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API key is missing. Check your .env file.");
            return "Error generating strategy.";
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const generationConfig = {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 500,
            responseMimeType: "text/plain",
        };

        const chatSession = model.startChat({ generationConfig });

        // Build prompt dynamically based on user input
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
         Please do not use  asterisks, or markdown. Provide the strategy in a readable format.`
        
        
        ;

        const result = await chatSession.sendMessage(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error generating strategy:", error);
        return "Error generating strategy.";
    }
}

// Handle POST request for generating a strategy
app.post('/generate', async (req, res) => {
    const userAnswers = req.body.answers;

    if (!userAnswers || userAnswers.length < 10) {
        return res.status(400).json({ error: "Insufficient data provided." });
    }

    try {
        const strategy = await generateStrategy(userAnswers);
        res.json({ strategy });
    } catch (error) {
        res.status(500).json({ error: "Error generating strategy." });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// Start the server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
