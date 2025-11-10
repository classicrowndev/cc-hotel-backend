const express = require('express')
const router = express.Router()
const Dish = require("../../models/dish.js")


// View all dishes
router.post("/all", async (req, res) => {
    try {
        // Fetch all dishes
        const dishes = await Dish.find().sort({ date_added: -1})
        if (!dishes || dishes.length === 0) {
            return res.status(200).send({status: 'ok', msg: 'success'})
        }

        return res.status(200).send({status:'ok', count: dishes.length, dishes})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// View dishes by category
router.post("/category", async (req, res) => {
    const {category} = req.body

    if (!category) {
        return res.status(400).send({status:'error', msg: 'Category is required'})
    }

    try {
        // Fetch all dishes by category
        const dishes = await Dish.find({category}).sort({ date_added: -1})
        if (!dishes || dishes.length === 0) {
            return res.status(200).send({ status: 'ok', msg: `No available dishes found in ${category}` })
        }

        return res.status(200).send({ status: 'ok', count: dishes.length, dishes})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// View single dish by ID
router.post("/view", async (req, res) => {
    const { id} = req.body

    if (!id) {
        return res.status(400).send({status:'error', msg: 'Dish ID is required'})
    }

    try {
        // Find the dish
        const dish = await Dish.findById(id)
        if (!dish) {
            return res.status(404).send({ message: "Dish not found" })
        }

        return res.status(200).send({status: 'ok', dish})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// Search for dishes by name
router.post("/search", async (req, res) => {
    const { name} = req.body

    if (!name) {
        return res.status(400).send({status:'error', msg: 'Name is required'})
    }

    try {
        // Find the dishes
        const dishes = await Dish.find({
            name: { $regex: name, $options: "i" }
        }).sort({date_added: -1})

        if (!dishes || dishes.length === 0) {
            return res.status(200).send({ status: 'ok', msg: "No dishes matched your search" })
        }

        return res.status(200).send({status: 'ok', count: dishes.length, dishes})
    } catch (e) {
        return res.status(500).send({status: 'error', msg:'Error occurred', error: e.message})
    }  
})


// Filter dishes/meals
router.post('/filter', async (req, res) => {
    const { category } = req.body

    // Validate category if provided
    const validCategories = ["Breakfast", "Main Meal", "Swallow", "Soup", "Bar & Drinks", "Beverages",
        "Meat & Fish", "Snack & Desserts"]
    if (category && !validCategories.includes(category)) {
        return res.status(400).send({ status: 'error', msg: 'Invalid category' })
    }

    //Build query dynamically
    let query = {}

    // Filter by category (e.g. Appetizer, Main Course, Dessert)
    if (category && category !== 'All') {
        query.category = category
    }

    try {
        const dishes = await Dish.find(query).select('name category image amount_per_portion')
        if (!dishes.length) {
            return res.status(200).send({ status: 'ok', msg: 'No dishes match the filter' })
        }

        return res.status(200).send({ status: 'ok', dishes })
    } catch (e) {
        return res.status(500).send({ status: 'error', msg: 'Error occurred', error: e.message })
    }
})


module.exports = router