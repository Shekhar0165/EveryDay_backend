import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  ProductName: {
    type: String,
    required: true,
    trim: true,
  },
  Images: {
    type: String,
    require: true
  },
  LabelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Labels',
    required: true,
  },
  CategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  Type: {
    type: String,
    enum: ['packet', 'non-packet'],
    required: true,
  },
  Stock: {
    type: Number,
    required: true,
  },
  Rating: {
    type: Number,
    default: 0,
  },
  imagePublicId:{
    type: String,
    require: true
  },
  PricePerUnit: {
    type: Number,
    required: true,
  },
  Units: {
    type: [String],
    enum: ['kg', 'g', 'L', 'mL', 'dozen'],
    default: [],
  },
  MinimumOrder: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;
