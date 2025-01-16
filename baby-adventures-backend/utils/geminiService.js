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
      temperature: 0.85,
      topP: 0.85,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    };

    this.storyPromptTemplate = `
You are a skilled children's story writer creating a continuous, engaging story. Your task is to write the next chapter that:

1. MUST maintain perfect continuity with the previous chapters
2. MUST keep the main character's personality and traits consistent
3. MUST reference and build upon previous events naturally
4. MUST use clear transitions between scenes
5. MUST maintain the established setting and world
6. MUST use age-appropriate language and themes
7. MUST advance the plot in a meaningful way
8. MUST include the main character actively in the story

Story Elements:
- Main Character: {mainCharacter}
- Current Setting: {setting}
- Theme: {theme}
- Age Group: {ageGroup}
- Current Chapter: {chapterNumber}

Previous Story Context:
{previousContext}

Write the next chapter that continues this story while maintaining perfect continuity with what came before. Make sure to reference previous events and keep the character's personality consistent:`;
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

  async generateStoryChapter(params) {
    const { 
      context, 
      story_elements, 
      previous_text,
      age_group,
      theme,
      character_name,
      character_type,
      setting,
      current_page 
    } = params;
    
    const prompt = this.storyPromptTemplate
      .replace('{mainCharacter}', `${character_name} the ${character_type}`)
      .replace('{setting}', setting)
      .replace('{theme}', theme)
      .replace('{ageGroup}', age_group)
      .replace('{chapterNumber}', current_page)
      .replace('{previousContext}', previous_text || 'This is the start of the story.');

    const chatSession = await this.startChat();
    const response = await this.sendMessage(chatSession, prompt);
    
    // Validate the response maintains continuity
    if (!response.toLowerCase().includes(character_name.toLowerCase())) {
      throw new Error('Generated content does not maintain character continuity');
    }

    return response;
  }
}

export default new GeminiService(); 