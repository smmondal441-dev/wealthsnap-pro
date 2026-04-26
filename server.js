const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Important: Set this key in Render Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzDmAudv7LjbVB1xw-bFngWPt-5jJ_EB_HTD_KgB8iRCBcZeyYWfUFgJNv_ZxgawDf9/exec";

app.use(express.json());
app.use(express.static(__dirname));

app.post('/process-voice', async (req, res) => {
    const { text } = req.body;
    
    if (!GEMINI_API_KEY) {
        console.error("Server Config Error: API Key is missing");
        return res.status(500).json({ success: false, error: "System Configuration Error" });
    }

    try {
        const prompt = `Extract finance data from: "${text}". Return ONLY JSON format: {"item": "string", "amount": number, "category": "string", "expenditure": "string"}. Do not include any other text or formatting.`;
        
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (!response.data.candidates || response.data.candidates.length === 0) {
            throw new Error("AI failed to process the request");
        }

        const resultText = response.data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        const financeData = JSON.parse(cleanJson);

        console.log("Success: Extracted Data", financeData);

        // Sending data to Google Sheets
        await axios({
            method: 'post',
            url: GOOGLE_SHEET_URL,
            data: JSON.stringify(financeData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        res.json({ success: true, data: financeData });
    } catch (error) {
        console.error("Runtime Error:", error.message);
        res.status(500).json({ success: false, error: "Processing failed" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
