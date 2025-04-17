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
// Ensure user is authenticated middleware

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
const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

  


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
app.get('/choose-option', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'chooseoption.html'));
});
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/choose-option'); // Redirect to selection page
    }
);


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

app.get('/', (req, res) => {
    res.sendFile(path.join('public', 'index.html'));
  });
  app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html')); // Absolute path
  });


  app.get('/videos-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'videos..html')); // Create this page
});
  
  app.get('/caption-generator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz2.html'));
});
async function generateCaptions(answers) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("API Key is missing.");
            return "Error generating captions.";
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are a social media copywriter. Based on the following inputs, generate 2–3 catchy captions for Instagram or Facebook that promote the business:

1. Business Name: ${answers[0]}
2. Service to Promote: ${answers[1]}
3. Location: ${answers[2]}
4. Key Points: ${answers[3]}
5. Industry: ${answers[4]}

Instructions:
- Captions should be creative, concise, and engaging.
- Include a line of 5–8 trending and relevant hashtags after each caption.
- Use emojis where appropriate to enhance appeal.
- Avoid any markdown or special formatting (no *, no **, no numbering, no quotes).
- Separate each caption by a new line.

Output format:
Caption text
#hashtag1 #hashtag2 #hashtag3 ...
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error generating captions:", error);
        return "Error generating captions.";
    }
}

app.post('/generate-captions', async (req, res) => {
    const { answers } = req.body;

    if (!answers || answers.length < 5) {
        return res.status(400).json({ error: "Insufficient data for caption generation." });
    }

    try {
        const generatedCaptions = await generateCaptions(answers);
    
        res.json({ strategy: generatedCaptions });
    } catch (err) {
        console.error("Error in /generate-captions:", err);
        res.status(500).json({ error: "Error generating captions" });
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

        await saveUserData(req, 'strategy', strategy);
        

    
        res.json({ strategy });
    } catch (error) {
        console.error("Error in POST /generate:", error);
        res.status(500).json({ error: "Error generating strategy." });
    }
});
app.post('/generate-15day-plan', async (req, res) => {
    try {
        const { answers, lang } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Gemini API key is missing." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are a social media strategist. Based on the inputs below, create a 15-day content plan for Instagram:

1. Business Name: ${answers[0]}
2. Service/Product: ${answers[1]}
3. Target Audience: ${answers[2]}
4. Platform: ${answers[3]}
5. Theme/Promotion: ${answers[4]}
6. Language: ${lang === 'hi' ? 'Hindi' : 'English'}

Instructions:
- For each of the 15 days, suggest one post idea.
- Include caption idea and content type (e.g., Reel, Image, Carousel).
- Use emojis and a friendly tone.
- Use plain text, no markdown or formatting symbols.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const strategy = response.text();
        await saveUserData(req, '15dayplan', strategy);
       

        res.json({ strategy });
    } catch (err) {
        console.error('Error generating 15-day plan:', err);
        res.status(500).json({ error: 'Failed to generate strategy.' });
    }
});





  


  
  
  app.get('/15day-plan', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quiz3.html'));
});


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
// Serve the language selection page
app.get('/language', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/'); // If user is not authenticated, redirect to login
    }

    res.sendFile(path.join(__dirname, 'public', 'language-select.html')); // Replace with your actual file
});


app.get('/api/get-user-name', (req, res) => {
    if (req.isAuthenticated()) {
        return res.json({ name: req.user.name });
    }
    res.status(401).json({ error: 'User not authenticated' }); // If not authenticated, send error
});
// Mongoose schema
const userDataSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, required: true }, // 'strategy' or '15dayplan'
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const UserData = mongoose.model('UserData', userDataSchema);
module.exports = UserData;

// Save user data to DB
const saveUserData = async (req, type, generatedContent) => {
    try {
        await UserData.create({
            userId: req.user._id,
            type: type,
            content: generatedContent
        });
        console.log(`${type} saved to DB`);
    } catch (err) {
        console.error(`Failed to save ${type}:`, err);
    }
};



// Async profile route using MongoDB


app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    try {
        const userName = req.user.name;
        const userId = req.user._id;

        const [strategy, plan] = await Promise.all([
            UserData.findOne({ userId, type: 'strategy' }).sort({ createdAt: -1 }),
            UserData.findOne({ userId, type: '15dayplan' }).sort({ createdAt: -1 }),
        ]);

        const userStrategy = strategy ? strategy.content : "No strategy generated yet.";
        const userPlan = plan ? plan.content : "No 15-day plan generated yet.";

        res.send(`
            <html>
            <head>
                <title>${userName}'s Profile</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    :root {
                        --primary-color: #2c6bed;
                        --primary-light: #e9f0ff;
                        --secondary-color: #5d3fd3;
                        --text-color: #333333;
                        --light-text: #666666;
                        --bg-color: #f7f9fc;
                        --card-bg: #ffffff;
                        --shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
                        --border-radius: 16px;
                    }
                    
                    * { 
                        box-sizing: border-box; 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
                    }
                    
                    body {
                        background-color: var(--bg-color);
                        color: var(--text-color);
                        line-height: 1.6;
                        padding: 20px;
                        min-height: 100vh;
                    }
                    
                    .container {
                        max-width: 960px;
                        margin: 0 auto;
                        padding: 20px 0;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid rgba(0,0,0,0.05);
                    }
                    
                    .header h1 {
                        color: var(--primary-color);
                        font-size: 26px;
                        font-weight: 700;
                    }
                    
                    .header-actions {
                        display: flex;
                        gap: 15px;
                    }
                    
                    .btn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 10px 16px;
                        border-radius: 30px;
                        font-weight: 600;
                        font-size: 14px;
                        cursor: pointer;
                        text-decoration: none;
                        transition: all 0.2s ease;
                    }
                    
                    .btn i {
                        margin-right: 8px;
                    }
                    
                    .btn-primary {
                        background-color: var(--primary-color);
                        color: white;
                        border: none;
                    }
                    
                    .btn-primary:hover {
                        background-color: #1a5cd7;
                        box-shadow: 0 4px 12px rgba(44, 107, 237, 0.2);
                    }
                    
                    .btn-outline {
                        background-color: transparent;
                        color: var(--primary-color);
                        border: 2px solid var(--primary-color);
                    }
                    
                    .btn-outline:hover {
                        background-color: var(--primary-light);
                    }
                    
                    .dashboard-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                        gap: 24px;
                    }
                    
                    .dashboard-card {
                        background-color: var(--card-bg);
                        border-radius: var(--border-radius);
                        padding: 24px;
                        box-shadow: var(--shadow);
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                    }
                    
                    .dashboard-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
                    }
                    
                    .card-header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 16px;
                    }
                    
                    .card-icon {
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 12px;
                        color: white;
                        font-size: 16px;
                    }
                    
                    .strategy-icon {
                        background: linear-gradient(45deg, #2c6bed, #5d3fd3);
                    }
                    
                    .plan-icon {
                        background: linear-gradient(45deg, #00b894, #00cec9);
                    }
                    
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                    }
                    
                    .card-content {
                        background-color: rgba(0, 0, 0, 0.02);
                        border-radius: 12px;
                        padding: 16px;
                        font-size: 15px;
                        color: var(--light-text);
                        margin-bottom: 16px;
                        max-height: 200px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        transition: max-height 0.3s ease;
                    }
                    
                    .content-preview {
                        max-height: 80px;
                        overflow: hidden;
                        position: relative;
                    }
                    
                    .content-preview::after {
                        content: "";
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        height: 40px;
                        background: linear-gradient(transparent, rgba(0, 0, 0, 0.02));
                    }
                    
                    .card-actions {
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    .toggle-btn {
                        background: none;
                        border: none;
                        color: var(--primary-color);
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        padding: 5px 0;
                    }
                    
                    .toggle-btn i {
                        margin-left: 6px;
                        transition: transform 0.2s ease;
                    }
                    
                    .toggle-btn:hover {
                        color: var(--secondary-color);
                    }
                    
                    .last-updated {
                        font-size: 12px;
                        color: #999;
                    }
                    
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 14px;
                        color: var(--light-text);
                    }
                    
                    @media (max-width: 768px) {
                        .dashboard-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .header {
                            flex-direction: column;
                            align-items: flex-start;
                            gap: 15px;
                        }
                        
                        .header-actions {
                            width: 100%;
                            justify-content: space-between;
                        }
                    }
                </style>
                <script>
                    function toggleContent(id) {
                        const content = document.getElementById(id);
                        const btn = document.getElementById(id + '-btn');
                        const icon = document.getElementById(id + '-icon');
                        
                        if (content.classList.contains('content-preview')) {
                            content.classList.remove('content-preview');
                            btn.innerHTML = 'Show Less <i id="' + id + '-icon" class="fas fa-chevron-up"></i>';
                        } else {
                            content.classList.add('content-preview');
                            btn.innerHTML = 'Show More <i id="' + id + '-icon" class="fas fa-chevron-down"></i>';
                        }
                    }
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome, ${userName}!</h1>
                        <div class="header-actions">
                            <a href="/chooseoption.html" class="btn btn-outline"><i class="fas fa-home"></i> Dashboard</a>
                            <a href="/logout" class="btn btn-primary"><i class="fas fa-sign-out-alt"></i> Logout</a>
                        </div>
                    </div>
                    
                    <div class="dashboard-grid">
                        <div class="dashboard-card">
                            <div class="card-header">
                                <div class="card-icon strategy-icon">
                                    <i class="fas fa-lightbulb"></i>
                                </div>
                                <div class="card-title">Your Strategy</div>
                            </div>
                            <div id="strategy-content" class="card-content content-preview">${userStrategy}</div>
                            <div class="card-actions">
                                <button id="strategy-content-btn" class="toggle-btn" onclick="toggleContent('strategy-content')">
                                    Show More <i id="strategy-content-icon" class="fas fa-chevron-down"></i>
                                </button>
                                <span class="last-updated">Last updated: ${strategy ? new Date(strategy.createdAt).toLocaleDateString() : 'Never'}</span>
                            </div>
                        </div>
                        
                        <div class="dashboard-card">
                            <div class="card-header">
                                <div class="card-icon plan-icon">
                                    <i class="fas fa-calendar-alt"></i>
                                </div>
                                <div class="card-title">15-Day Plan</div>
                            </div>
                            <div id="plan-content" class="card-content content-preview">${userPlan}</div>
                            <div class="card-actions">
                                <button id="plan-content-btn" class="toggle-btn" onclick="toggleContent('plan-content')">
                                    Show More <i id="plan-content-icon" class="fas fa-chevron-down"></i>
                                </button>
                                <span class="last-updated">Last updated: ${plan ? new Date(plan.createdAt).toLocaleDateString() : 'Never'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send("Internal Server Error");
    }
});






// Start Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
