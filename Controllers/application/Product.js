import Category from "../../models/Categroy.js";
import Product from "../../models/Product.js";
import Label from "../../models/Label.js";
import cloudinary from '../../config/Cloudinary.js';
import mongoose from "mongoose";
import User from "../../models/User.js";


const HandleGetPrductByCetagroy = async (req, res) => {
    const { categoryId } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    try {
        // Build search and category filter
        const filter = {
            CategoryId: categoryId,
            ProductName: { $regex: search, $options: "i" }, // case-insensitive search
        };

        const products = await Product.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            // .limit(limitNumber);

        const total = await Product.countDocuments(filter);

        console.log({
            success: true,
            currentPage: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            totalProducts: total,
            products,
        })

        res.status(200).json({
            success: true,
            currentPage: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            totalProducts: total,
            products,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};


const HandleGetRandomProductFromEachCetagory = async (req, res) => {
    const { LabelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(LabelId)) {
        return res.status(400).json({ success: false, message: "Invalid Label ID" });
    }

    try {
        // First, get all categories for this label
        const categories = await Category.find({ label: LabelId });

        if (!categories || categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No categories found for this label"
            });
        }

        // Get one random product from each category
        const randomProducts = await Promise.all(
            categories.map(async (category) => {
                // Get a random product from this category
                const product = await Product.aggregate([
                    { $match: { CategoryId: category._id } },
                    { $sample: { size: 1 } }
                ]);

                return product[0] || null;
            })
        );

        // Filter out any null values (categories with no products)
        const filteredProducts = randomProducts.filter(product => product !== null);

        res.status(200).json({
            success: true,
            totalCategories: categories.length,
            productsFound: filteredProducts.length,
            products: filteredProducts
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


const HandleGetMostSellingProductFromEachCetagory = async (req, res) => {
     const { LabelId } = req.params;
     console.log(LabelId)

    if (!mongoose.Types.ObjectId.isValid(LabelId)) {
        return res.status(400).json({ success: false, message: "Invalid Label ID" });
    }

    try {
        // First, get all categories for this label
        const categories = await Category.find({ label: LabelId });


        if (!categories || categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No categories found for this label"
            });
        }

        // Get one random product from each category
        const randomProducts = await Promise.all(
            categories.map(async (category) => {
                // Get a random product from this category
                const product = await Product.aggregate([
                    { $match: { CategoryId: category._id } },
                    { $sample: { size: 6 } }
                ]);


                return {product,cetagoryName:category.name} || null;
            })
        );

        // Filter out any null values (categories with no products)
        const filteredProducts = randomProducts.filter(product => product !== null);

        res.status(200).json({
            success: true,
            totalCategories: categories.length,
            productsFound: filteredProducts.length,
            products: filteredProducts
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


const HandleGetBestSellerProductFromEachLabels = async(req,res)=>{
    try {
        // Get all unique labels that have products
        const labels = await Category.aggregate([
            {
                $group: {
                    _id: "$label",
                    labelName: { $first: "$label" }
                }
            }
        ]);

        if (!labels || labels.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No labels found"
            });
        }

        // Get products for each label
        const productsPerLabel = await Promise.all(
            labels.map(async (labelObj) => {
                // Get random products for this label
                const products = await Product.aggregate([
                    { $match: { LabelId: labelObj._id } },
                    { $sample: { size: 3 } }  // Get 3 random products
                ]);

                return {
                    labelId: labelObj._id,
                    products: products || []
                };
            })
        );

        // Filter out labels with no products and format response
        const filteredResults = productsPerLabel.filter(label => label.products.length > 0);

        res.status(200).json({
            success: true,
            totalLabels: filteredResults.length,
            labels: filteredResults
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
}


const HandleAddPrduct = async (req, res) => {
    try {
        const {
            ProductName,
            Images,
            CategoryId,
            Type,
            Stock,
            PricePerUnit,
            Units,
            MinimumOrder,
            imagePublicId
        } = req.body;

        console.log(req.body)

        if (!ProductName || !CategoryId || !Type || !Stock || !PricePerUnit || !Images || !imagePublicId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const category = await Category.findById(CategoryId);

        if (!category) {
            return res.status(400).json({ success: false, message: "Category Not Found!" });
        }

        const LabelId = category.label;

        // 🔍 Check for duplicate product with same name and category but different type
        const existingProduct = await Product.findOne({
            ProductName,
            CategoryId,
            Type
        });

        if (existingProduct) {
            return res.status(409).json({
                success: false,
                message: `Product with this name already exists under ${category.name} in ${Type} Type`
            });
        }

        const productData = {
            ProductName,
            Images,
            LabelId,
            CategoryId,
            Type,
            Stock,
            PricePerUnit,
            imagePublicId
        };

        if (Type !== 'packet') {
            productData.Units = Units;
            productData.MinimumOrder = MinimumOrder;
        }

        const newProduct = new Product(productData);
        await newProduct.save();

        category.products.push(newProduct._id);
        await category.save();

        res.status(201).json({ success: true, message: "Product added successfully", product: newProduct });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};


const HandleUpdatePrduct = async (req, res) => {
    const { productId } = req.params;
    const updateData = req.body;

    // 1. Basic validation
    if (!updateData.ProductName || !updateData.CategoryId || !updateData.Type) {
        return res.status(400).json({ success: false, message: "ProductName, CategoryId, and Type are required" });
    }

    // 2. Check valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    try {
        // 3. Find current product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        const isImageChanged = updateData.Images !== product.Images;

        if (isImageChanged) {
            cloudinary.uploader.destroy(product.imagePublicId, function (error, result) {
                if (error) {
                    console.error('Error:', error);
                } else {
                    console.log('Deleted:', result);
                }
            });
        }

        // 4. Check for duplicate name only if name is changed
        const isNameChanged = updateData.ProductName !== product.ProductName;
        if (isNameChanged) {
            const existingProduct = await Product.findOne({
                ProductName: updateData.ProductName,
                CategoryId: updateData.CategoryId,
                Type: updateData.Type,
                _id: { $ne: productId }, // Exclude current product from duplicate check
            });

            if (existingProduct) {
                return res.status(409).json({
                    success: false,
                    message: "Product with this name already exists in the same category and type",
                });
            }
        }

        // 5. Update product
        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product: updatedProduct,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};


const HandleDeletePrduct = async (req, res) => {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    try {


        const deletedProduct = await Product.findByIdAndDelete(productId);

        cloudinary.uploader.destroy(deletedProduct.imagePublicId, function (error, result) {
            if (error) {
                console.error('Error:', error);
            } else {
                console.log('Deleted:', result);
            }
        });

        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};



const HandleAddToCartProduct = async (req, res) => {
    const { ProductId } = req.params;
    const units = 1
    const userId = req.user._id;
    try {
        // Validate ProductId
        if (!mongoose.Types.ObjectId.isValid(ProductId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        // Check if product exists and has stock
        const product = await Product.findById(ProductId);
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found" 
            });
        }

        if (product.Stock < units) {
            return res.status(400).json({ 
                success: false, 
                message: "Not enough stock available" 
            });
        }

        // Check if product is already in cart
        const user = await User.findById(userId);
        const existingCartItem = user.AddToCard.find(
            item => item.ProductId.toString() === ProductId
        );

        if (existingCartItem) {
            // Update existing cart item
            existingCartItem.units += units;

            // Check if updated quantity exceeds stock
            if (existingCartItem.units > product.Stock) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Cannot add more units than available in stock" 
                });
            }
        } else {
            // Add new item to cart
            user.AddToCard.push({
                ProductId,
                units
            });
        }

        await user.save();

        // Populate the product details in the response
        const updatedUser = await User.findById(userId).populate('AddToCard.ProductId');

        res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            cart: updatedUser.AddToCard
        });

    } catch (error) {
        console.error('Error in HandleAddToCartProduct:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
}


const HandleUpdateUnitFromCart = async(req,res) => {
    const { ProductId } = req.params;
    const { units } = req.body;
    const userId = req.user._id;

    console.log(units)
    
    try {
        // Validate ProductId and units
        if (!mongoose.Types.ObjectId.isValid(ProductId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        if (!units || units < 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid units value" 
            });
        }

        // Get user and product
        const user = await User.findById(userId);
        const product = await Product.findById(ProductId);

        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found" 
            });
        }

        // Find the cart item
        const cartItem = user.AddToCard.find(
            item => item.ProductId.toString() === ProductId
        );

        if (!cartItem) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found in cart" 
            });
        }

        // Check if requested units exceed stock
        if (units > product.Stock) {
            return res.status(400).json({ 
                success: false, 
                message: "Requested units exceed available stock" 
            });
        }

        // If units is 0, remove the item from cart
        if (units === 0) {
            user.AddToCard = user.AddToCard.filter(
                item => item.ProductId.toString() !== ProductId
            );
        } else {
            // Update the units
            cartItem.units = units;
        }

        await user.save();

        // Return updated cart with populated product details
        const updatedUser = await User.findById(userId).populate('AddToCard.ProductId');
        
        res.status(200).json({
            success: true,
            message: units === 0 ? "Product removed from cart" : "Cart updated successfully",
            cart: updatedUser.AddToCard
        });

    } catch (error) {
        console.error('Error in HandleUpdateUnitFromCart:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
}



const HandleRemoveToCart = async(req,res) => {
    const { ProductId } = req.params;
    const userId = req.user._id;
    
    try {
        // Validate ProductId
        if (!mongoose.Types.ObjectId.isValid(ProductId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid product ID" 
            });
        }

        // Get user
        const user = await User.findById(userId);

        // Check if product exists in cart
        const cartItemExists = user.AddToCard.some(
            item => item.ProductId.toString() === ProductId
        );

        if (!cartItemExists) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found in cart" 
            });
        }

        // Remove the item from cart
        user.AddToCard = user.AddToCard.filter(
            item => item.ProductId.toString() !== ProductId
        );

        await user.save();

        // Return updated cart with populated product details
        const updatedUser = await User.findById(userId).populate('AddToCard.ProductId');
        
        res.status(200).json({
            success: true,
            message: "Product removed from cart successfully",
            cart: updatedUser.AddToCard
        });

    } catch (error) {
        console.error('Error in HandleRemoveToCart:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
}

const HandleGetAddtoCartProduct = async(req,res)=>{
    const userId = req.user._id;

    console.log("card",userId)
    
    try {
        // Get user with populated cart items
        const user = await User.findById(userId).populate({
            path: 'AddToCard.ProductId',
            select: 'ProductName Images PricePerUnit Stock Type Units MinimumOrder' // Select specific fields you want
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Calculate total items and price
        const cartSummary = user.AddToCard.reduce((summary, item) => {
            if (item.ProductId) { // Check if product exists (not deleted)
                summary.totalItems += item.units;
                summary.totalPrice += item.units * item.ProductId.PricePerUnit;
            }
            return summary;
        }, { totalItems: 0, totalPrice: 0 });

        // Filter out any cart items where product has been deleted
        const validCartItems = user.AddToCard.filter(item => item.ProductId);

        res.status(200).json({
            success: true,
            cart: {
                items: validCartItems,
                totalItems: cartSummary.totalItems,
                totalPrice: cartSummary.totalPrice
            }
        });

    } catch (error) {
        console.error('Error in HandleGetAddtoCartProduct:', error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
}


const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Get the current product to find its label and category
    const currentProduct = await Product.findById(productId);

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Find similar products using simple queries
    const [sameLabelProducts, sameCategoryProducts, sameTypeProducts, randomProducts] = await Promise.all([
      // Products with same label
      Product.find({
        _id: { $ne: productId },
        LabelId: currentProduct.LabelId,
        Stock: { $gt: 0 }
      }).sort({ Rating: -1 }).limit(5),

      // Products with same category (excluding same label ones)
      Product.find({
        _id: { $ne: productId },
        LabelId: { $ne: currentProduct.LabelId },
        CategoryId: currentProduct.CategoryId,
        Stock: { $gt: 0 }
      }).sort({ Rating: -1 }).limit(3),

      // Products with same type (excluding above)
      Product.find({
        _id: { $ne: productId },
        LabelId: { $ne: currentProduct.LabelId },
        CategoryId: { $ne: currentProduct.CategoryId },
        Type: currentProduct.Type,
        Stock: { $gt: 0 }
      }).sort({ Rating: -1 }).limit(2),

      // Random products as fallback
      Product.find({
        _id: { $ne: productId },
        Stock: { $gt: 0 }
      }).sort({ Rating: -1 }).limit(parseInt(limit))
    ]);

    // Combine results with priority
    let similarProducts = [];
    
    // Add same label products (highest priority)
    similarProducts = [...similarProducts, ...sameLabelProducts.map(p => ({ ...p.toObject(), similarityScore: 3 }))];
    
    // Add same category products (medium priority)
    similarProducts = [...similarProducts, ...sameCategoryProducts.map(p => ({ ...p.toObject(), similarityScore: 2 }))];
    
    // Add same type products (low priority)
    similarProducts = [...similarProducts, ...sameTypeProducts.map(p => ({ ...p.toObject(), similarityScore: 1 }))];
    
    // If we don't have enough, add random products
    if (similarProducts.length < parseInt(limit)) {
      const needed = parseInt(limit) - similarProducts.length;
      const existingIds = new Set(similarProducts.map(p => p._id.toString()));
      const additionalProducts = randomProducts
        .filter(p => !existingIds.has(p._id.toString()))
        .slice(0, needed)
        .map(p => ({ ...p.toObject(), similarityScore: 0 }));
      
      similarProducts = [...similarProducts, ...additionalProducts];
    }

    // Limit to requested number
    similarProducts = similarProducts.slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Similar products retrieved successfully',
      products: similarProducts,
      totalCount: similarProducts.length,
      currentProduct: {
        _id: currentProduct._id,
        ProductName: currentProduct.ProductName,
        LabelId: currentProduct.LabelId,
        CategoryId: currentProduct.CategoryId
      }
    });

  } catch (error) {
    console.error('Error fetching similar products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



const searchProducts = async (req, res) => {
    console.log("Search products request:", req.query);
  try {
    const {
      search = '',
      category = '',
      label = '',
      type = '',
      minPrice = 0,
      maxPrice = Infinity,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      inStock = false
    } = req.query;
    console.log(req.query)

    // Build search query
    const searchQuery = {};
    
    // Text search across product name
    if (search) {
      searchQuery.ProductName = {
        $regex: search,
        $options: 'i' // case insensitive
      };
    }

    // Category filter
    if (category) {
      searchQuery.CategoryId = category;
    }

    // Label filter
    // if (label) {
    //   searchQuery.LabelId = label;
    // }

    // Type filter
    if (type) {
      searchQuery.Type = type;
    }

    // Price range filter
    if (minPrice > 0 || maxPrice < Infinity) {
      searchQuery.PricePerUnit = {
        $gte: Number(minPrice),
        $lte: Number(maxPrice)
      };
    }

    // Stock filter
    if (inStock === 'true') {
      searchQuery.Stock = { $gt: 0 };
    }

    // Sorting options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query with population
    const products = await Product.find(searchQuery)
      .populate('CategoryId', 'name description')
      .populate({ path: 'LabelId', model: 'Label', select: 'name color' })
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / Number(limit));

    // Transform data for frontend
    const transformedProducts = products.map(product => ({
      id: product._id,
      name: product.ProductName,
      image: product.Images,
      imagePublicId: product.imagePublicId,
      category: product.CategoryId?.name || 'Unknown',
      categoryId: product.CategoryId?._id,
      label: product.LabelId?.name || '',
      labelColor: product.LabelId?.color || '#FB8C00',
      type: product.Type,
      price: product.PricePerUnit,
      units: product.Units,
      stock: product.Stock,
      rating: product.Rating,
      minimumOrder: product.MinimumOrder,
      inStock: product.Stock > 0,
      createdAt: product.createdAt
    }));

    res.status(200).json({
      success: true,
      data: {
        products: transformedProducts,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalCount,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1
        },
        filters: {
          search,
          category,
          label,
          type,
          minPrice: Number(minPrice),
          maxPrice: maxPrice === Infinity ? null : Number(maxPrice),
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message
    });
  }
};

// Get trending/popular products
const getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const trendingProducts = await Product.find({ Stock: { $gt: 0 } })
      .populate('CategoryId', 'name')
      .sort({ Rating: -1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      data: trendingProducts
    });

  } catch (error) {
    console.error('Get trending products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending products',
      error: error.message
    });
  }
};

// Get product suggestions for autocomplete
const getProductSuggestions = async (req, res) => {
    console.log("Get product suggestions request:");
  try {
    const { q = '', limit = 8 } = req.query;
    console.log("Product suggestions query:", req.query);

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const suggestions = await Product.find({
      ProductName: { $regex: q, $options: 'i' },
      Stock: { $gt: 0 }
    })
    .select('ProductName CategoryId Images PricePerUnit')
    .populate('CategoryId', 'name')
    .limit(Number(limit))
    .lean();

    const transformedSuggestions = suggestions.map(product => ({
      id: product._id,
      name: product.ProductName,
      category: product.CategoryId?.name || 'Unknown',
      image: product.Images,
      price: product.PricePerUnit
    }));

    res.status(200).json({
      success: true,
      data: transformedSuggestions
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
};

// Get single product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('CategoryId', 'name description')
      .populate({ path: 'LabelId', model: 'Label', select: 'name color description' })
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const transformedProduct = {
      id: product._id,
      name: product.ProductName,
      image: product.Images,
      imagePublicId: product.imagePublicId,
      category: {
        id: product.CategoryId?._id,
        name: product.CategoryId?.name || 'Unknown',
        description: product.CategoryId?.description
      },
      label: {
        id: product.LabelId?._id,
        name: product.LabelId?.name || '',
        color: product.LabelId?.color || '#FB8C00',
        description: product.LabelId?.description
      },
      type: product.Type,
      price: product.PricePerUnit,
      units: product.Units,
      stock: product.Stock,
      rating: product.Rating,
      minimumOrder: product.MinimumOrder,
      inStock: product.Stock > 0,
      createdAt: product.createdAt
    };

    res.status(200).json({
      success: true,
      data: transformedProduct
    });

  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product',
      error: error.message
    });
  }
};

export {
    HandleGetPrductByCetagroy,
    HandleAddPrduct,
    HandleUpdatePrduct,
    HandleDeletePrduct,
    HandleGetRandomProductFromEachCetagory,
    HandleGetMostSellingProductFromEachCetagory,
    HandleGetBestSellerProductFromEachLabels,
    HandleAddToCartProduct,
    HandleUpdateUnitFromCart,
    HandleRemoveToCart,
    HandleGetAddtoCartProduct,
    getSimilarProducts,
    searchProducts,
    getTrendingProducts,
    getProductSuggestions,
    getProductById
}