const express = require('express')
const router = express.Router()
const verifyToken = require('../../middleware/verifyToken')
const Dish = require("../../models/dish.js");


// View all available dishes
router.post("/all", verifyToken, async (req, res) => {
    try {
        // Fetch all available dishes
        const dishes = await Dish.find({ status: "Available" }).sort({ date_added: -1})
        if (!dishes || dishes.length === 0) {
            return res.status(200).send({status: 'ok', msg: 'No dishes available at the moment'})
        }

        return res.status(200).send({status:'success', count: dishes.length, dishes})
    } catch (error) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Error fetching dishes', error: e.message})
    }  
})


// View dishes by category
router.post("/category", verifyToken, async (req, res) => {
    const {category} = req.body

    if (!category) {
        return res.status(400).send({status:'error', msg: 'Category is required'})
    }

    try {
        // Fetch all dishes by category
        const dishes = await Dish.find({category, status: 'Available'}).sort({ date_added: -1})
        if (!dishes || dishes.length === 0) {
            return res.status(200).send({ status: 'ok', msg: `No available dishes found in ${category}` })
        }

        return res.status(200).send({ status: 'success', count: dishes.length, dishes})
    } catch (error) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Error fetching dishes by category', error: e.message})
    }  
})


// View single dish by ID
router.post("/view", verifyToken, async (req, res) => {
    const { id} = req.body

    if (!id) {
        return res.status(400).send({status:'error', msg: 'Dish ID is required'})
    }

    try {
        // Find the dish
        const dish = await Dish.findById(id)
        if (!dish) {
            return res.status(404).json({ message: "Dish not found" })
        }

        return res.status(200).send({status: 'success', dish})
    } catch (error) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Error fetching dish details', error: e.message})
    }  
})


// Search for dishes by name
router.post("/search", verifyToken, async (req, res) => {
    const { name} = req.body

    if (!name) {
        return res.status(400).send({status:'error', msg: 'Name is required'})
    }

    try {
        // Find the dishes
        const dishes = await Dish.find({
            name: { $regex: name, $options: "i" },
            status: "Available"
        }).sort({date_added: -1})

        if (!dishes || dishes.length === 0) {
            return res.status(200).send({ status: 'ok', msg: "No dishes matched your search" })
        }

        return res.status(200).send({status: 'ok', count: dishes.length, dishes})
    } catch (error) {
        if (e.name === "JsonWebTokenError") {
            return res.status(400).send({status: 'error', msg:'Token verification failed', error: e.message})
        }
        return res.status(500).send({status: 'error', msg:'Error searching dishes', error: e.message})
    }  
})


module.exports = router
