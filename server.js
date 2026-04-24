const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;

// API Configurations
const GEMINI_API_KEY = "AIzaSyBTKfMBJkLCkulGAc20h1snKtVlg0m-oUY"; 
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwOx8rgj8rRX_QJFPFkG5wFwq5ru1BhhzbyvwNnABNhk4V1iUqLCzx7vQV0_XAIG0ig/exec"; 

app.use(express.json());
app.use(express.static(__dirname));

// Multilayer Failover Configuration
const API_LAYERS = [
    { v: 'v1beta', m: 'gemini-2.5-flash' },
    { v: 'v1beta', m: 'gemini-2.0-flash' },
    { v: 'v1', m: 'gemini-flash-latest' }
];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROUTE 1: Process and Track New Expense
app.post('/api/track', async (req, res) => {
    const { text } = req.body;
    let success = false;

    console.log(`\n[Request Received]: "${text}"`);

    for (let layer of API_LAYERS) {
        if (success) break;

        try {
            console.log(`[Processing]: Using ${layer.m}...`);
            const url = `https://generativelanguage.googleapis.com/${layer.v}/models/${layer.m}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await axios.post(url, {
                contents: [{ 
                    parts: [{ 
                        text: `Context: Professional worker (Engineer/Technician/Sales/Official). 
                        Extract expense from: "${text}". 
                        Languages: Bengali, English, or Mixed.
                        Categories: "Field Materials", "Equipment & Tools", "Professional Books/Resources", "Daily Allowance/TA-DA", "Office Supplies", "Emergency Repairs", "Travel & Transport".
                        Return ONLY JSON: {"amount": number, "item": "string", "category": "string"}.` 
                    }] 
                }]
            }, { timeout: 10000 }); 

            const aiRaw = response.data.candidates[0].content.parts[0].text;
            const cleanJson = aiRaw.replace(/```json|```/g, "").trim();
            const parsedData = JSON.parse(cleanJson);
            
            console.log(`[AI SUCCESS]: Extracted ${parsedData.item} - ${parsedData.amount} BDT`);

            // Sync to Google Sheets
            try {
                await axios.post(GOOGLE_SHEET_URL, parsedData, {
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                console.log(`[SHEET SUCCESS]: Data synced to Cloud.`);
            } catch (sheetErr) {
                console.error("[SHEET ERROR]: Cloud sync failed.");
            }

            res.json(parsedData);
            success = true;

        } catch (error) {
            console.log(`[FAILED]: ${layer.m} attempt failed.`);
        }
    }

    if (!success) {
        res.status(500).json({ error: "AI Processing Failed on all layers." });
    }
});

// ROUTE 2: Fetch Report Data (New Module)
app.get('/api/report', async (req, res) => {
    try {
        const response = await axios.get(GOOGLE_SHEET_URL);
        console.log(`[REPORT SUCCESS]: Data fetched for Analytics.`);
        res.json(response.data);
    } catch (error) {
        console.error("[REPORT ERROR]: Could not fetch data.");
        res.status(500).json({ error: "Failed to fetch report data." });
    }
});

app.listen(PORT, () => {
    console.log("=========================================");
    console.log("WealthSnap Pro: Enterprise Ready");
    console.log("Modules: Tracking, Failover, Report API");
    console.log(`Server: http://localhost:${PORT}`);
    console.log("=========================================");
});