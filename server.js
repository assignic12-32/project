// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize express app
const app = express();

// Port to listen on
const port = process.env.PORT || 3000;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
// Serve static files (like CSS) from the 'public' folder
app.use(express.static('public'));


// Setup Google Generative AI with the API key from .env
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("API key is missing. Please check your .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generationConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 500, // Limit response length
  responseMimeType: "text/plain",
};

// Function to generate strategy based on user input
async function generateStrategy(userInput) {
  try {
    const chatSession = model.startChat({ generationConfig });

    const prompt = `
    Generate a personalized marketing strategy for a high-budget brand based on the following information:
    1. Brand Name: ${userInput.brandName}
    2. Sector: ${userInput.sector}
    3. Website: ${userInput.website}
    4. Instagram Presence: ${userInput.instagram}
    5. WhatsApp Marketing: ${userInput.whatsappMarketing}
    6. SEO Investment: ${userInput.seoInvestment}
    7. Lead Generation through Website: ${userInput.leadGeneration}
    8. Target Audience: ${userInput.targetAudience}
    9. Marketing Budget: ${userInput.marketingBudget}
    10. Marketing Goals: ${userInput.marketingGoals}

    Provide a detailed marketing strategy in short few words considering the above factors, and include personalized recommendations for customer retention, increasing brand engagement, 
    `;

    // Send the user input to the AI model
    const result = await chatSession.sendMessage(prompt);
    return result.response.text(); // Return the strategy
  } catch (error) {
    console.error("Error generating strategy: ", error);
    return "Error generating strategy. Please try again.";
  }
}

// Serve the HTML form
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Handle form submission and generate the strategy
app.post("/generate", async (req, res) => {
  const userInput = {
    brandName: req.body.brandName,
    sector: req.body.sector,
    website: req.body.website,
    instagram: req.body.instagram,
    whatsappMarketing: req.body.whatsappMarketing,
    seoInvestment: req.body.seoInvestment,
    leadGeneration: req.body.leadGeneration,
    targetAudience: req.body.audience, // Added this line for target audience
    marketingBudget: req.body.budget, // Added this line for marketing budget
    marketingGoals: req.body.goals, // Added this line for marketing goals
  };

  const strategy = await generateStrategy(userInput);

  // Send the generated strategy back as a response

  res.send(`
    <html>
      <head>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <h1>Generated Marketing Strategy for ${userInput.brandName}</h1>
        <pre>${strategy}</pre>
        <a href="/">Generate Another Strategy</a>
      </body>
    </html>
  `);
  
  
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
