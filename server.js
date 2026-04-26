const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbw6QHuQUjxJ8Ax03EgSvbsU8PGAr7WRAtN8qTSOuq2SSPe77EcS2xK9jd3P8wvnC_1s/exec";

app.use(express.json());
app.use(express.static(__dirname));

// List of Gemini 1.0 and other stable models (Excluding 1.5 series)
const modelList = [
    "gemini-1.0-pro",
    "gemini-pro",
    "gemini-1.0-pro-001",
    "gemini-1.0-pro-latest",
    "gemini-pro-vision", // Just in case
    "text-embedding-004" // Stable auxiliary
];

async function callGemini(text) {
    for (let modelName of modelList) {
        try {
            console.log(`Trying Legacy Model: ${modelName}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: `Extract finance data from: "${text}". Return ONLY JSON: {"item": "string", "amount": number, "category": "string", "expenditure": "string"}` }] }]
            }, { timeout: 10000 });

            if (response.data && response.data.candidates) {
                console.log(`Success! Data extracted using: ${modelName}`);
                return response.data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            const status = err.response ? err.response.status : "Offline";
            console.warn(`${modelName} Status: ${status}`);
            // Continue to next available model
        }
    }
    throw new Error("No compatible Gemini 1.0 models found for your API key.");
}

app.post('/process-voice', async (req, res) => {
    const { text } = req.body;
    console.log("--- Sync Request ---", text);

    if (!GEMINI_API_KEY) return res.status(500).json({ success: false, error: "API Key Not Found" });

    try {
        const resultText = await callGemini(text);
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        const financeData = JSON.parse(cleanJson);

        console.log("Pushing to Sheets:", financeData);
        await axios.post(GOOGLE_SHEET_URL, JSON.stringify(financeData), {
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        res.json({ success: true, data: financeData });
    } catch (error) {
        console.error("Final System Failure:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(port, () => console.log(`WealthSnap Server running on port ${port}`));
