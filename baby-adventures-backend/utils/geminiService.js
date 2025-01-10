import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    console.log('Initializing GeminiService...');
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    console.log('API Key found, initializing GoogleGenerativeAI...');
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    console.log('Getting model...');
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    console.log('Model initialized successfully');
    this.generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    };
  }

  async startChat(initialHistory = []) {
    try {
      console.log('Starting chat session...');
      const chat = await this.model.startChat({
        generationConfig: this.generationConfig,
        history: initialHistory,
      });
      console.log('Chat session started successfully');
      return chat;
    } catch (error) {
      console.error('Error starting chat:', error);
      throw error;
    }
  }

  async sendMessage(chatSession, message) {
    try {
      console.log('Sending message:', message);
      const result = await chatSession.sendMessage(message);
      console.log('Message sent, getting response...');
      const response = result.response.text();
      console.log('Response received:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async generateResponse(message, history = []) {
    try {
      console.log('Generating response for message:', message);
      const chatSession = await this.startChat(history);
      return await this.sendMessage(chatSession, message);
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }
}

export default new GeminiService(); 