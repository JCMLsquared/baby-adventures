import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const storySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  ageGroup: {
    type: String,
    required: true
  },
  theme: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true
  },
  characterType: {
    type: String,
    required: true
  },
  setting: {
    type: String,
    required: true
  },
  pages: [{
    pageNumber: Number,
    text: String,
    image: String
  }],
  currentPage: {
    type: Number,
    default: 1
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  ratings: [ratingSchema],
  averageRating: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
storySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Story = mongoose.model('Story', storySchema);

export default Story; 