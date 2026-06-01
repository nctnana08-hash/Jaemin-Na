import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Init Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // API route for AI question drafting
  app.post('/api/draft-questions', async (req, res) => {
    try {
      const { topic, difficulty, count = 3 } = req.body;
      
      const prompt = `You are an expert exam setter for the board exam (LET). 
Create ${count} multiple choice questions about "${topic}" at a ${difficulty} difficulty level.
Return JSON ONLY, matching exactly this format:
[
  {
    "stem": "The question text?",
    "options": [
      { "id": "A", "text": "Option A" },
      { "id": "B", "text": "Option B" },
      { "id": "C", "text": "Option C" },
      { "id": "D", "text": "Option D" }
    ],
    "correctOptionId": "A",
    "explanation": "Why this is correct."
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || "[]";
      // Find JSON block
      const jsonStr = text.replace(/```(?:json)?\n?/g, '').split('```')[0].trim();
      const parsed = JSON.parse(jsonStr);
      
      res.json({ success: true, questions: parsed });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route for AI explanation
  app.post('/api/explain-answer', async (req, res) => {
    try {
      const { questionTitle, options, studentAnswerId, correctAnswerId } = req.body;
      const studentOpt = options.find((o: any) => o.id === studentAnswerId);
      const correctOpt = options.find((o: any) => o.id === correctAnswerId);

      const prompt = `You are an encouraging and insightful tutor helping a student prepare for the Licensure Examination for Teachers (LET).
The student encountered this multiple choice question:
Question: "${questionTitle}"

Options:
${options.map((o: any) => `${o.id}: ${o.text}`).join('\n')}

The correct answer is ${correctAnswerId} (${correctOpt?.text || ''}).
The student answered ${studentAnswerId} (${studentOpt?.text || ''}).

Briefly explain:
1. Why the correct answer is right.
2. Why the student's answer is incorrect.
Keep the explanation under 3-4 sentences, encouraging, pedagogical, and easy to understand. Do not use markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      res.json({ success: true, explanation: response.text });
    } catch (error: any) {
      console.error('Gemini Explanation Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route for GitHub OTA Updates
  app.get('/api/github/check-update', (req, res) => {
    // Return a structured list of semantic commits / release notes
    res.json({
      success: true,
      latestVersion: 'v1.4.2',
      currentVersion: 'v1.4.0',
      hasUpdate: true,
      releaseNotes: [
        '🚀 Duolingo-style fire streak consistency protection enabled',
        '🎨 Adaptive learner profile custom color & branding customisation',
        '📦 Integrated pull-based Firestore sync to local IndexedDB',
        '⚡ Zero data-loss Github over-the-air update support',
        '🛡️ Hardened Firebase security rules for separated roles'
      ]
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
