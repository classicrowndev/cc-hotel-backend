const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_TEST_SECRET_KEY

// Initialize a Paystack payment
const createPayment = async (email, amount) => {
    try {
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amount * 100, // Paystack expects amount in kobo
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        return response.data; // Contains authorization_url, access_code, reference
    } catch (error) {
        console.error('Error initializing Paystack payment:', error.response?.data || error.message)
        throw new Error('Failed to initialize payment')
    }
}


module.exports = { createPayment }