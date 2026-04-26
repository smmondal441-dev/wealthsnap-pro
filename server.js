const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbw6QHuQUjxJ8Ax03EgSvbsU8PGAr7WRAtN8qTSOuq2SSPe77EcS2xK9jd3P8wvnC_1s/exec";

app.use(express.json());
app.use(express.static(__dirname));

const modelList = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-1.5-flash-8b",
    "gemini-pro-experimental"
];

async function callGemini(text) {
    for (let modelName of modelList) {
        try {
            console.log(`Checking Model: ${modelName}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: `Extract finance data from: "${text}". Return ONLY JSON: {"item": "string", "amount": number, "category": "string", "expenditure": "string"}` }] }]
            }, { timeout: 10000 });

            if (response.data && response.data.candidates) {
                console.log(`Success with: ${modelName}`);
                return response.data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            const status = err.response ? err.response.status : "Error";
            console.warn(`${modelName} Status: ${status}`);
        }
    }
    throw new Error("No active models found.");
}

app.post('/process-voice', async (req, res) => {
    const { text } = req.body;
    console.log("--- Request Received ---", text);

    if (!GEMINI_API_KEY) return res.status(500).json({ success: false, error: "API Key missing" });

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
        console.error("Critical Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(port, () => console.log(`Server live on port ${port}`));
