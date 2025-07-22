import Category from "../../models/Categroy.js";
import Label from "../../models/Label.js";
import Product from "../../models/Product.js";
import mongoose from "mongoose";

// Get all categories
const HandleGetAllCetagroy = async (req, res) => {
    const { labelId } = req.query;

    if (!labelId) {
        return res.status(400).json({
            success: false,
            message: "labelId is required",
        });
    }

    try {
        const categories = await Category.find({ label: labelId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Categories fetched for the given label",
            categories,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error,
        });
    }
};


// Add new category
const HandleAddCetagroy = async (req, res) => {
    const { name, labelId } = req.body;

    if (!name || !labelId) {
        return res.status(400).json({
            success: false,
            message: "Both name and labelId are required"
        });
    }

    try {
        // Step 1: Check if label exists
        const labelExists = await Label.findById(labelId);
        if (!labelExists) {
            return res.status(404).json({
                success: false,
                message: "Label not found"
            });
        }

        // Step 2: Check if category name already exists under this label
        const existing = await Category.findOne({ name, label: labelId });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Category already exists under this label"
            });
        }

        // Step 3: Create category
        const newCategory = new Category({ name, label: labelId });
        await newCategory.save();

        // Step 4: Push category into label's categories array
        labelExists.categories.push(newCategory._id);
        await labelExists.save();

        res.status(201).json({
            success: true,
            message: "Category added and linked to label successfully",
            category: newCategory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error
        });
    }
};


// Delete a category
const HandleDeleteCetagroy = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    try {
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Delete all products under this category
        await Promise.all(category.products.map(async (productId) => {
            await Product.findByIdAndDelete(productId);
        }));

        // Now delete the category itself
        await Category.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Category and its products deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};

// Update a category
const HandleUpdateCetagroy = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        const newCategory = await Category.find({name:name})

        if(newCategory){
            return res.status(404).json({ success: false, message: `${name} already exist` });
        }

        if (name) category.name = name;

        await category.save();

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            category,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error });
    }
};

export {
    HandleGetAllCetagroy,
    HandleAddCetagroy,
    HandleDeleteCetagroy,
    HandleUpdateCetagroy
};
