const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Updated Google Sheet URL for 5-column support
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzDmAudv7LjbVB1xw-bFngWPt-5jJ_EB_HTD_KgB8iRCBcZeyYWfUFgJNv_ZxgawDf9/exec";

app.use(express.json());
app.use(express.static(__dirname));

app.post('/process-voice', async (req, res) => {
    const { text } = req.body;
    try {
        const prompt = `Extract finance data from: "${text}". Return ONLY JSON format: {"item": "string", "amount": number, "category": "string", "expenditure": "string"}. Use the original text or a short description for expenditure. Do not include any other text.`;
        
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const resultText = response.data.candidates[0].content.parts[0].text;
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        const financeData = JSON.parse(cleanJson);

        console.log("Data Extracted:", financeData);

        await axios({
            method: 'post',
            url: GOOGLE_SHEET_URL,
            data: JSON.stringify(financeData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        
        res.json({ success: true, data: financeData });
    } catch (error) {
        console.error("System Error:", error.message);
        res.status(500).json({ success: false, error: "Processing failed" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
