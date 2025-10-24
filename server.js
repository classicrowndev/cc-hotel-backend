const express = require('express')
const app = express()

const dotenv = require('dotenv')
dotenv.config()

const mongoose = require('mongoose')
/*
const cors = require('cors')
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // add both dev ports just in case
    credentials: true, // allow cookies/tokens if needed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // allow all HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'] // allow headers used by axios
}))
*/

// connect database
mongoose.connect(process.env.MONGO_URI)
const con = mongoose.connection
con.on('open', error =>{
    if(error) {
        console.log(`Error connecting to database ${error}`)
    }else{
    console.log("Connected to Database")
    }
})

app.use(express.json())
app.use(express.urlencoded({extended: true}))


//user routes
app.use('/guest_auth', require('./uroutes/auth'))
app.use('/guest_profile', require('./routes/profile'))
app.use('/guest_room', require('./routes/room'))
app.use('/guest_booking', require('./routes/booking'))
app.use('/guest_dish', require('./routes/dish'))
app.use('/guest_order', require('./routes/order'))
app.use('/guest_service', require('./routes/service'))
app.use('/guest_event', require('./routes/event'))
app.use('/guest_hall', require('./routes/hall'))
app.use('/guest_faq', require('./routes/faq'))
app.use('/guest_testimonial', require('./routes/testimonial'))
app.use('/guest_contact', require('./routes/contact'))
app.use('/guest_policy', require('./routes/policy'))



//staff routes
app.use('/staff_auth', require('./routes/auth'))
app.use('/staff_profile', require('./routes/profile'))
app.use('/staff_dashboard', require('./routes/dashboard'))
app.use('/staff_room', require('./routes/room'))
app.use('/staff_service', require('./routes/service'))
app.use('/staff_serviceRequest', require('./routes/serviceRequest'))
app.use('/staff_booking', require('./routes/booking'))
app.use('/staff_dish', require('./routes/dish'))
app.use('/staff_order', require('./routes/order'))
app.use('/staff_event', require('./routes/event'))
app.use('/staff_hall', require('./routes/hall'))

const port = process.env.PORT
app.listen(port , ()=>{
    console.log(`server listening at port ${port}`)
})

module.exports = app