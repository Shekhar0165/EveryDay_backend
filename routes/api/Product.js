

import express from "express";
import {
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
} from "../../Controllers/application/Product.js";
import { AdminAuth } from "../../middleware/AdminAuth.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.get("/:categoryId", HandleGetPrductByCetagroy);
router.get("/get/random/:LabelId", HandleGetRandomProductFromEachCetagory);
router.get("/get/most-selling/:LabelId", HandleGetMostSellingProductFromEachCetagory);
router.get("/get/best-selling", HandleGetBestSellerProductFromEachLabels);
router.post("/add", AdminAuth, HandleAddPrduct);
router.put("/update/:productId", AdminAuth, HandleUpdatePrduct);
router.delete("/delete/:productId", AdminAuth, HandleDeletePrduct);
router.get('/similar/:productId', getSimilarProducts);


// Search products
router.get("/user/search", searchProducts);
router.get("/user/trending", getTrendingProducts);
router.get("/user/suggestions", getProductSuggestions);
router.get("/product/:id", getProductById);


// Add to cart 

router.get("/addtocart/:ProductId", auth, HandleAddToCartProduct);
router.post("/addtocart/update/:ProductId", auth, HandleUpdateUnitFromCart);
router.get("/removetocart/:ProductId", auth, HandleRemoveToCart);
router.get("/get/cart", auth, HandleGetAddtoCartProduct);
export default router;




