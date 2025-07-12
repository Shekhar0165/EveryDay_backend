import mongoose from 'mongoose';

const labelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category' 
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Label = mongoose.model('Label', labelSchema);
export default Label;
