const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Guest = require('./models/guest'); // Adjust path as needed

// Mock Express Request/Response
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.send = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

async function runTest() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/cc-hotel'); // Adjust DB URI
        console.log('Connected to DB');

        const testEmail = 'test_auth_debug@example.com';
        const testPass = 'password123';

        // Clean up previous test
        await Guest.deleteMany({ email: testEmail });

        // 1. Sign Up
        console.log('--- Testing Sign Up ---');
        const hashedPassword = await bcrypt.hash(testPass, 10);
        const guest = new Guest({
            fullname: 'Test User',
            email: testEmail,
            phone_no: '0000000000',
            password: hashedPassword,
            status: 'Active' // Ensure active
        });
        await guest.save();
        console.log('User created');

        // 2. Sign In (Success Case)
        console.log('--- Testing Sign In (Correct Password) ---');
        // Simulate Logic from route
        let foundGuest = await Guest.findOne({ email: testEmail }).lean();
        if (!foundGuest) throw new Error('Guest not found');

        let match = await bcrypt.compare(testPass, foundGuest.password);
        console.log(`Password match (clean): ${match}`);

        // 3. Sign In (Whitespace Case)
        console.log('--- Testing Sign In (Password with Space) ---');
        match = await bcrypt.compare(testPass + ' ', foundGuest.password);
        console.log(`Password match (with trailing space): ${match}`);

        // 4. Test Route Logic Simulation with raw inputs
        console.log('--- Simulation of Route Logic ---');
        const inputEmail = testEmail;
        const inputPass = testPass;  // Correct

        const fetchGuest = await Guest.findOne({ email: inputEmail }).lean();
        if (fetchGuest) {
             const isMatch = await bcrypt.compare(inputPass, fetchGuest.password);
             console.log(`Route Logic Match: ${isMatch}`);
        } else {
            console.log('Route Logic: User not found');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
