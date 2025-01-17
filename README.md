# Baby Adventures 🍼

An interactive storytelling application that creates personalized children's stories using AI. Parents can generate unique, engaging stories for their children with custom characters and scenarios.

## Features ✨

- **AI-Powered Story Generation**: Create unique, personalized stories using advanced AI technology
- **Voice Narration**: Listen to stories with high-quality voice narration
- **Story Saving**: Save favorite stories for future reading
- **User Authentication**: Secure user accounts to manage personal story collections
- **Responsive Design**: Works seamlessly on both desktop and mobile devices

## Tech Stack 🛠️

### Frontend
- React.js
- Vite
- CSS3
- Axios for API communication

### Backend
- Node.js
- Express.js
- MongoDB
- Google's Gemini AI API

## Getting Started 🚀

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Google Cloud Platform account (for Gemini AI API)

### Installation

1. Clone the repository
```bash
git clone https://github.com/[your-username]/baby-adventures.git
cd baby-adventures
```

2. Install Backend Dependencies
```bash
cd baby-adventures-backend
npm install
```

3. Configure Environment Variables
Create a `.env` file in the backend directory with:
```
MONGODB_URI=your_mongodb_connection_string
GOOGLE_API_KEY=your_google_api_key
JWT_SECRET=your_jwt_secret
```

4. Install Frontend Dependencies
```bash
cd ../baby-adventures-frontend
npm install
```

5. Start the Application
```bash
# Start Backend (from baby-adventures-backend directory)
npm start

# Start Frontend (from baby-adventures-frontend directory)
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage 📖

1. Create an account or log in
2. Click "Create New Story" to start generating a story
3. Input story preferences (character names, themes, etc.)
4. Generate and customize your story
5. Save stories to your collection
6. Listen to voice narration or read the story

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments 🙏

- Google Gemini AI for powering story generation
- OpenAI for providing the voice narration
- Stability AI for providing image generation



Project Link: https://github.com/JCMLsquared/baby-adventures