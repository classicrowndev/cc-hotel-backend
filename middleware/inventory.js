/**
 * Middleware to automatically set inventory status based on stock level.
 * @param {Object} doc - The mongoose document instance 
 */
const updateInventoryStatus = (doc) => {
    if (doc.stock <= 0) {
        doc.status = "Out of Stock";
    } else if (doc.stock <= 10) {
        doc.status = "Low Stock";
    } else {
        doc.status = "In Stock";
    }
};

module.exports = { updateInventoryStatus }