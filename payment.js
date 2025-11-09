const dotenv = require("dotenv")
dotenv.config()

const paystack = require("paystack")(process.env.PAYSTACK_TEST_SECRET_KEY)


// function to create an order payment
const createPayment = async (email, amount) => {
    try {
        const paymentData = {
            email,
            amount: amount * 100,
            currency: "NGN",
            ref: Date.now().toString()
        }

        const response = await paystack.transaction.initialize(paymentData)
        // console.log(response)
        return response
    } catch (error) {
        console.error(error)
        return { msg: "some error occurred", error }
    }
}

module.exports = { createPayment }