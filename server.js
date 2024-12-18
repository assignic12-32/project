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
app.use(express.static(path.join(__dirname, 'public')));

// Serve the authentication page (index.html) at the home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the language selection page
app.get('/language', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'language-select.html'));
});

// Serve quiz page which handles both English and Hindi versions
app.get('/quiz', (req, res) => {
    const lang = req.query.lang || 'en'; // Default to English if no language specified
    res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// Google OAuth setup
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'https://project-assignic-sol.vercel.app/auth/google/callback',
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
        // After successful login, redirect to the language selection page
        res.redirect('/language');
    }
);

// Logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

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

        const languagePrompt = lang === 'hi' ? "Please generate the strategy in Hindi.  The response should contain no special formatting such as asterisks (*), bold (**), italics (_), or any markdown symbols. Only plain text should be used." : "Please generate the strategy in English.";
        
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
     Avoid using asterisks(*)  ;
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
        res.json({ strategy });
    } catch (error) {
        console.error("Error in POST /generate:", error);
        res.status(500).json({ error: "Error generating strategy." });
    }
});



// Start Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
