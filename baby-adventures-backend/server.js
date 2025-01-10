import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import Story from './models/Story.js';
import connectDB from './config/database.js';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import { Blob } from 'node-fetch';
import FormData from 'form-data';
import crypto from 'crypto';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import and use Gemini routes
import geminiRoutes from './routes/geminiRoutes.js';
app.use('/api/gemini', geminiRoutes);

// Serve static files from the public directory
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

const STABILITY_API_HOST = "https://api.stability.ai";

// Story context management
class StoryContext {
  constructor(age_group, theme, characterInfo, location) {
    this.age_group = age_group;
    this.theme = theme;
    this.characterInfo = characterInfo;
    this.location = location;
    this.pages = [];
    this.characterSeed = Math.floor(Math.random() * 2147483647); // Base seed for character consistency
  }

  getPageSeed(pageNumber) {
    // Generate a unique but deterministic seed for each page based on the character seed
    return (this.characterSeed + (pageNumber * 1000)) % 2147483647;
  }

  addPage(content) {
    this.pages.push(content);
  }

  getCurrentContext() {
    return {
      characterInfo: this.characterInfo,
      location: this.location,
      previousContent: this.pages.length > 0 ? this.pages[this.pages.length - 1] : null
    };
  }
}

// Store story contexts in memory
const storyContexts = new Map();

// Add after environment variables are loaded
console.log('Initializing Google AI...');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Debug Google AI setup
console.log('Google AI Key exists:', !!process.env.GEMINI_API_KEY);
console.log('Model initialized:', !!model);

const authenticateToken = async (req, res, next) => {
  console.log('Authenticating token...');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token found');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);
    
    // Find user in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('User not found');
      return res.status(403).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      password: hashedPassword,
      isAdmin: username === 'admin' // Make the first admin user
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, username: user.username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

// User login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username);
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Add this before the image generation function
const validateImageBuffer = async (buffer) => {
  if (!buffer || buffer.length === 0) {
    throw new Error('Invalid image buffer');
  }
  // Add more image validation if needed
  return true;
};

async function generateImage(story_text, age_group, storyId) {
  try {
    const context = storyContexts.get(storyId);
    
    if (!context) {
      throw new Error('Story context not found');
    }

    const characterInfo = context.characterInfo;
    
    if (!characterInfo) {
      throw new Error('Character information not found');
    }

    // Validate and provide defaults for all inputs
    const validatedStoryText = story_text || 'having an adventure';
    const storyAction = validatedStoryText.toLowerCase();
    
    // Extract key story elements for better context
    const sceneElements = validatedStoryText.match(/(?:near|with|at|by|in|on)\s+(?:the\s+)?([^,.!]+)/g) || [];
    const actionElements = validatedStoryText.match(/(?:is|are|was|were)\s+([^,.!]+)/g) || [];
    const emotionWords = validatedStoryText.match(/(?:happy|sad|excited|scared|laughing|crying|smiling|worried|curious|surprised)/g) || [];
    
    // Build a comprehensive scene description
    const sceneDescription = [
      ...sceneElements,
      ...actionElements.map(action => action.trim()),
      ...emotionWords
    ].join(', ') || 'in a magical setting';

    // Ensure all character info fields have defaults
    const validatedCharacterInfo = {
      color: characterInfo.color || 'colorful',
      species: characterInfo.species || 'character',
      name: characterInfo.name || 'friend',
      special_features: characterInfo.special_features || 'with special features',
      personality: characterInfo.personality || 'friendly'
    };

    // Build a detailed character description that maintains consistency
    const characterDescription = `A ${validatedCharacterInfo.color} ${validatedCharacterInfo.species} named ${validatedCharacterInfo.name}, ${validatedCharacterInfo.special_features}, ${validatedCharacterInfo.personality}, in ${context.location?.place || 'a magical place'}. The character is ${storyAction}`;
    
    // Create a more detailed prompt that emphasizes both consistency and story context
    const safePrompt = `Children's book illustration, highly detailed character design of ${characterDescription}. The scene shows: ${sceneDescription}. Maintain consistent character design with ${validatedCharacterInfo.special_features}. Style: Soft, rounded shapes, pastel colors, simple clean backgrounds, gentle shading, kawaii aesthetic, child-friendly storybook style.`.trim();

    // Add stronger negative prompts for consistency
    const negativePrompt = "nsfw, scary, dark, violent, adult themes, realistic, photographic, different character design, inconsistent appearance, wrong colors, wrong species, complex backgrounds, human characters, wrong character features";
    
    // Get current page number from context
    const currentPageNumber = context.pages.length + 1;
    const pageSeed = context.getPageSeed(currentPageNumber);

    if (currentPageNumber === 1) {
      console.log('Generating initial character image...');
      
      const formData = new FormData();
      formData.append('prompt', safePrompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('output_format', 'jpeg');

      const response = await fetch(
        `${STABILITY_API_HOST}/v2beta/stable-image/generate/sd3`,
        {
          method: 'POST',
          headers: {
            Accept: 'image/*',
            Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stability API Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Stability API error: ${response.statusText} - ${errorText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');
      
      // Store the initial character image for future reference
      context.initialCharacterImage = base64Image;
      return base64Image;

    } else {
      console.log('Using image-to-image generation for consistency...');
      try {
        const imageBuffer = Buffer.from(context.initialCharacterImage, 'base64');
        
        const formData = new FormData();
        formData.append('prompt', safePrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('output_format', 'jpeg');
        formData.append('init_image', imageBuffer);
        formData.append('image_strength', '0.35'); // Lower strength to maintain more character consistency

        const response = await fetch(
          `${STABILITY_API_HOST}/v2beta/stable-image/generate/sd3`,
          {
            method: 'POST',
            headers: {
              Accept: 'image/*',
              Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
            },
            body: formData
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Stability API Response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            headers: Object.fromEntries(response.headers.entries())
          });
          throw new Error(`Stability API error: ${response.statusText} - ${errorText}`);
        }

        const buffer = await response.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        return base64Image;

      } catch (error) {
        console.error('Error in image-to-image generation:', error);
        console.log('Falling back to text-to-image generation with strong character description...');
        
        // If image-to-image fails, use an even more detailed text prompt
        const fallbackPrompt = `Children's book illustration, EXACT SAME CHARACTER DESIGN as before: ${characterDescription}. Must maintain ${validatedCharacterInfo.color} color and ${validatedCharacterInfo.special_features}. The character is now ${storyAction} with scene elements: ${sceneDescription}. Style: Soft, rounded shapes, pastel colors, simple clean backgrounds, gentle shading, kawaii aesthetic, child-friendly storybook style.`.trim();
        
        const formData = new FormData();
        formData.append('prompt', fallbackPrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('output_format', 'jpeg');

        const response = await fetch(
          `${STABILITY_API_HOST}/v2beta/stable-image/generate/sd3`,
          {
            method: 'POST',
            headers: {
              Accept: 'image/*',
              Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
            },
            body: formData
          }
        );

        if (!response.ok) {
          throw new Error('Failed to generate fallback image');
        }

        const buffer = await response.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        return base64Image;
      }
    }
  } catch (error) {
    console.error('Detailed image generation error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

async function generateCharacterInfo(age_group, character_name, character_type) {
  try {
    const prompt = `Generate a character description for a children's story character with these requirements:
    - name (string, must be: ${character_name})
    - species (string, must be: ${character_type})
    - color (string)
    - special_features (string)
    - personality (string)
    
    Example format:
    {
      "name": "${character_name}",
      "species": "${character_type}",
      "color": "orange and white",
      "special_features": "fluffy tail and tiny pink nose",
      "personality": "playful and curious"
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const characterInfo = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!characterInfo.name || !characterInfo.species || !characterInfo.color || 
        !characterInfo.special_features || !characterInfo.personality) {
      throw new Error('Missing required character fields');
    }

    return characterInfo;
  } catch (error) {
    console.error('Error generating character info:', error);
    // Return default character if generation fails
    return {
      name: character_name,
      species: character_type,
      color: "golden",
      special_features: "unique and special features",
      personality: "friendly and energetic"
    };
  }
}

async function generateLocation(theme) {
  try {
    const prompt = `Generate a location description for a children's story with these fields:
    - place (string, the name of the location)
    - description (string, a brief description)
    
    Example format:
    {
      "place": "Enchanted Forest",
      "description": "A magical woodland with sparkling trees and friendly creatures"
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const locationInfo = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!locationInfo.place || !locationInfo.description) {
      throw new Error('Missing required location fields');
    }

    return locationInfo;
  } catch (error) {
    console.error('Error generating location:', error);
    // Return default location if generation fails
    return {
      place: "Magical Playground",
      description: "A wonderful place full of fun and adventure"
    };
  }
}

async function generateStoryPage(age_group, theme, page_number, storyId, character_name, character_type) {
  try {
    let context = storyContexts.get(storyId);
    
    if (!context) {
      console.log('Creating new story context...');
      const characterInfo = await generateCharacterInfo(age_group, character_name, character_type);
      const location = await generateLocation(theme);
      context = new StoryContext(age_group, theme, characterInfo, location);
      storyContexts.set(storyId, context);
      console.log('Story context created:', context);
    }

    // Get the current context without modifying it
    const storyContext = context.getCurrentContext();
    console.log('Current story context:', storyContext);

    // Limit to 5 pages maximum
    if (page_number > 5) {
      throw new Error('Maximum page limit reached');
    }

    const basePrompt = `
      Character: A ${storyContext.characterInfo.color} ${storyContext.characterInfo.species} named ${storyContext.characterInfo.name} who ${storyContext.characterInfo.special_features}
      Location: ${JSON.stringify(storyContext.location)}
      Theme: ${theme}
      
      Guidelines:
      - ${age_group === '0-2' ? 'Write EXACTLY TWO sentences' : 'Write EXACTLY ONE sentence'}
      - Use simple, child-friendly words
      - Always refer to the character as "${storyContext.characterInfo.name} the ${storyContext.characterInfo.species}"
      - Keep it in the same location (${storyContext.location.place})
      - Make it fun and engaging
      - End each sentence with an exclamation mark
      - Include sound words when possible (like "giggle" or "splash")
      - Focus on the ${theme} theme
      
      ${page_number === 1 ? 'Start the story by introducing the character and showing them doing something fun!' : 'Continue the story naturally from the previous content!'}
      
      ${page_number > 1 ? `Previous content: ${storyContext.previousContent}` : ''}
      
      Example format for ${age_group === '0-2' ? 'TWO' : 'ONE'} sentences:
      ${age_group === '0-2' ? 
        `${character_name} [action in setting]! ${character_name} [theme-related reaction]!` :
        `${character_name} [action in setting with theme-related element]!`}
      
      Do not include any image prompts or instructions.`;

    console.log('Generating story with prompt:', basePrompt);
    const result = await model.generateContent(basePrompt);
    const storyText = result.response.text().trim();
    
    // Clean up the response
    let cleanedText;
    if (age_group === '0-2') {
      // Split into sentences and take first two
      const sentences = storyText
        .split(/[.!?]/)
        .filter(sentence => sentence.trim().length > 0)
        .slice(0, 2)
        .map(sentence => {
          let cleaned = sentence.trim();
          cleaned = cleaned.replace(/undefined$/, '').trim();
          return cleaned + "!";
        });
      cleanedText = sentences.join(" ");
    } else {
      // Take just the first sentence for other age groups
      cleanedText = storyText
        .split(/[.!?]/)
        .filter(sentence => sentence.trim().length > 0)[0]
        .trim() + "!";
    }
    
    console.log('Generated story text:', cleanedText);
    
    // Only add the page to context after successful generation
    context.addPage(cleanedText);
    
    return cleanedText;
  } catch (error) {
    console.error('Error generating story:', error);
    throw new Error(`Story generation failed: ${error.message}`);
  }
}

// Add the next_page endpoint with authentication
app.post('/api/next_page', authenticateToken, async (req, res) => {
  try {
    const { age_group, theme, current_page, story_id, character_name, character_type } = req.body;
    
    console.log('Generating next page:', {
      age_group,
      theme,
      current_page,
      story_id,
      character_name,
      character_type
    });

    // First check if the story exists
    let existingStory = await Story.findOne({
      userId: req.user._id,
      _id: story_id
    });

    // If story doesn't exist, create it first
    if (!existingStory) {
      console.log('Creating new story in database...');
      existingStory = new Story({
        _id: story_id,
        userId: req.user._id,
        title: `${character_name}'s Adventure`,
        ageGroup: age_group,
        theme,
        characterName: character_name,
        characterType: character_type,
        currentPage: 1,
        pages: []
      });
      await existingStory.save();
    }

    // Check if this page already exists
    const existingPage = existingStory.pages.find(p => p.pageNumber === current_page + 1);
    if (existingPage) {
      // If the page exists, return it instead of generating a new one
      console.log('Returning existing page:', current_page + 1);
      return res.json({
        story_id,
        page_number: current_page + 1,
        story_text: existingPage.text,
        image: existingPage.image,
        total_pages: 5
      });
    }

    // If page doesn't exist, generate new content
    const story_text = await generateStoryPage(age_group, theme, current_page + 1, story_id, character_name, character_type);
    console.log('Generated story text:', story_text);

    const image = await generateImage(story_text, age_group, story_id);
    console.log('Generated image');

    // Save the new page to the database
    existingStory.pages.push({
      pageNumber: current_page + 1,
      text: story_text,
      image: image
    });
    existingStory.currentPage = current_page + 1;
    await existingStory.save();
    console.log('Saved new page to database');
    
    res.json({
      story_id,
      page_number: current_page + 1,
      story_text,
      image,
      total_pages: 5
    });
  } catch (error) {
    console.error('Error generating next page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add near the top after express setup
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Add after other endpoints
app.post('/api/start_story', authenticateToken, async (req, res) => {
  try {
    const { age_group, theme, character_name, character_type, setting, voice } = req.body;

    // Validate required fields
    if (!age_group || !theme || !character_name || !character_type || !setting) {
      throw new Error('Missing required fields: age group, theme, character name, character type, and setting are required');
    }
    
    const story_id = new mongoose.Types.ObjectId().toString();

    console.log('Starting new story:', {
      age_group,
      theme,
      character_name,
      character_type,
      setting,
      story_id
    });

    // Initialize story context first
    console.log('Generating character and location info...');
    const characterInfo = await generateCharacterInfo(age_group, character_name, character_type);
    const location = await generateLocation(theme);
    const context = new StoryContext(age_group, theme, characterInfo, location);
    storyContexts.set(story_id, context);
    console.log('Story context created:', context);

    // Create the story prompt
    const getWordLimit = (age_group) => {
      const age = parseInt(age_group.split('-')[1]);
      if (age <= 2) return 12;  // Very short stories for babies - just 3-4 lines
      if (age <= 4) return 250;
      if (age <= 6) return 350;
      return 500;
    };

    const wordLimit = getWordLimit(age_group);

    let prompt;
    if (age_group === '0-2') {
      prompt = `Create a baby-friendly story with EXACTLY TWO complete sentences:
        - Main Character: ${character_name}, a ${character_type}
        - Setting: ${setting}
        - Theme: ${theme}

        REQUIRED Style:
        - Write EXACTLY TWO complete sentences (not fragments)
        - First sentence: Introduce ${character_name} in the ${setting}
        - Second sentence: Show ${character_name} doing something fun related to the ${theme}
        - Use simple, child-friendly words
        - Make both sentences engaging and descriptive
        - End each sentence with an exclamation mark
        - Include action words and sound effects when possible
        
        Example good story:
        The happy ${character_name} plays in the ${setting}! ${character_name} makes a big splash and giggles with joy!

        Example bad story (too simple):
        See ${character_name}! ${character_name} jump!

        Return ONLY the two sentences, no additional text.`;
    } else {
      prompt = `Create a children's story with exactly these specifications:
        - Age Group: ${age_group}
        - Theme: ${theme}
        - Main Character: ${character_name}, a ${character_type}
        - Setting: ${setting}
        - Maximum word count: ${wordLimit} words

        Story requirements:
        - Write ONLY the story text, with NO prefix or introduction
        - Use age-appropriate vocabulary and concepts
        - Keep sentences short and clear
        - Use descriptive language that children can understand
        - Include positive messages
        
        Format the story in clear paragraphs.`;
    }

    // Use our Gemini service to generate the story
    const geminiService = (await import('./utils/geminiService.js')).default;
    const story_text = await geminiService.generateResponse(prompt);
    console.log('Generated first page text:', story_text);

    const image = await generateImage(story_text, age_group, story_id);
    console.log('Generated first page image');

    // Save story to database
    const story = new Story({
      _id: story_id,
      userId: req.user._id,
      title: `${character_name}'s Adventure`,
      ageGroup: age_group,
      theme,
      characterName: character_name,
      characterType: character_type,
      setting: setting,
      currentPage: 1,
      pages: [{
        pageNumber: 1,
        text: story_text,
        image
      }]
    });

    await story.save();
    console.log('Saved story to database');

    res.json({
      story_id,
      page_number: 1,
      story_text,
      image,
      total_pages: 5
    });
  } catch (error) {
    console.error('Error starting story:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's stories
app.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const stories = await Story.find({ userId: req.user._id });
    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get specific story
app.get('/api/stories/:storyId', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findOne({
      userId: req.user._id,
      storyId: req.params.storyId
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json(story);
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Add token validation endpoint
app.get('/api/validate-token', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Update the delete endpoint
app.delete('/api/stories/:storyId', authenticateToken, async (req, res) => {
  try {
    console.log('Attempting to delete story:', req.params.storyId);
    
    const story = await Story.findOne({
      userId: req.user._id,
      _id: req.params.storyId
    });

    if (!story) {
      console.log('Story not found:', req.params.storyId);
      return res.status(404).json({ error: 'Story not found' });
    }

    await Story.deleteOne({
      userId: req.user._id,
      _id: req.params.storyId
    });

    console.log('Story deleted successfully:', req.params.storyId);
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// Add share endpoint
app.post('/api/stories/:storyId/share', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findOne({
      userId: req.user._id,
      _id: req.params.storyId
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');
    story.shareToken = shareToken;
    await story.save();

    res.json({ shareUrl: `${req.protocol}://${req.get('host')}/shared/${shareToken}` });
  } catch (error) {
    console.error('Error sharing story:', error);
    res.status(500).json({ error: 'Failed to share story' });
  }
});

// Add rating endpoint
app.post('/api/stories/:storyId/rate', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const storyId = req.params.storyId;
    
    console.log('Rating request received:', {
      storyId,
      rating,
      comment,
      userId: req.user._id
    });
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    // Find story by MongoDB _id
    const story = await Story.findOne({
      userId: req.user._id,
      _id: storyId
    });

    if (!story) {
      console.error('Story not found:', {
        storyId,
        userId: req.user._id
      });
      return res.status(404).json({ error: 'Story not found' });
    }

    console.log('Found story:', story._id);

    // Add the rating
    story.ratings.push({
      userId: req.user._id,
      rating,
      comment,
      date: new Date()
    });

    // Update average rating
    story.averageRating = story.ratings.reduce((acc, curr) => acc + curr.rating, 0) / story.ratings.length;

    await story.save();
    console.log('Rating saved successfully');
    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Error rating story:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// Add analytics endpoint
app.get('/api/stories/:storyId/analytics', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findOne({
      userId: req.user._id,
      _id: req.params.storyId
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const analytics = {
      totalViews: story.ratings.length,
      averageRating: story.averageRating,
      ratings: story.ratings.map(r => ({
        rating: r.rating,
        comment: r.comment,
        date: r.date
      }))
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Add OpenAI TTS preview endpoint
app.post('/api/preview_voice', authenticateToken, async (req, res) => {
  try {
    const { voice, text } = req.body;
    
    if (!voice || !text) {
      return res.status(400).json({ error: 'Voice and text are required' });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to generate speech');
    }

    const audioBuffer = await response.arrayBuffer();
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
    });
    
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Error in preview_voice:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Add text-to-speech endpoint
app.post('/api/text_to_speech', authenticateToken, async (req, res) => {
  try {
    const { text, voice } = req.body;
    
    if (!text || !voice) {
      return res.status(400).json({ error: 'Text and voice are required' });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to generate speech');
    }

    const audioBuffer = await response.arrayBuffer();
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
    });
    
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Error in text_to_speech:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

const PORT = process.env.PORT || 3001;

// Modified server startup to ensure database connection
const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB first
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); // Start the server