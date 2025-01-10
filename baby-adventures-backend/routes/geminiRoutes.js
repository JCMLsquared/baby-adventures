import express from 'express';
import geminiService from '../utils/geminiService.js';

const router = express.Router();

router.post('/chat', async (req, res) => {
  console.log('Received chat request:', req.body);
  try {
    const { message, history } = req.body;
    
    if (!message) {
      console.log('No message provided in request');
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Processing message with history:', { message, historyLength: history?.length });
    const response = await geminiService.generateResponse(message, history);
    console.log('Response generated:', response);
    res.json({ response });
  } catch (error) {
    console.error('Error in Gemini chat endpoint:', error);
    res.status(500).json({ error: 'Failed to generate response', details: error.message });
  }
});

export default router; 