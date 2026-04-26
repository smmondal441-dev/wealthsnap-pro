const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbw6QHuQUjxJ8Ax03EgSvbsU8PGAr7WRAtN8qTSOuq2SSPe77EcS2xK9jd3P8wvnC_1s/exec";

app.use(express.json());
app.use(express.static(__dirname));

app.post('/process-voice', async (req, res) => {
    const { text } = req.body;
    console.log("--- New Request Received ---");
    console.log("Input Text:", text);

    // 1. Check API Key
    if (!GEMINI_API_KEY) {
        console.error("DEBUG ERROR: GEMINI_API_KEY is missing in Render Environment Variables!");
        return res.status(500).json({ success: false, error: "Server Configuration Error: Missing API Key" });
    }

    try {
        // 2. Gemini AI Processing
        console.log("Step 1: Sending to Gemini AI...");
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: `Extract finance data from: "${text}". Return ONLY JSON: {"item": "string", "amount": number, "category": "string", "expenditure": "string"}` }] }]
        });

        const resultText = response.data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        const financeData = JSON.parse(cleanJson);
        console.log("Step 2: AI Successfully parsed data:", financeData);

        // 3. Google Sheets Submission
        console.log("Step 3: Sending to Google Sheets...");
        await axios({
            method: 'post',
            url: GOOGLE_SHEET_URL,
            data: JSON.stringify(financeData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }).then(() => {
            console.log("Step 4: Success! Data sent to Google Sheet.");
        }).catch((err) => {
            // This will catch the 404 error and show details
            console.error("DEBUG ERROR: Google Sheets Failed!");
            console.error("Status Code:", err.response ? err.response.status : "N/A");
            console.error("Error Detail:", err.message);
            throw new Error(`Google Sheets connection failed: ${err.message}`);
        });
        
        res.json({ success: true, data: financeData });

    } catch (error) {
        console.error("CRITICAL ERROR:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`WealthSnap Server active on port ${port}`);
});
