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

//staff routes
app.use('/staff_auth', require('./routes/auth'))
app.use('/staff_profile', require('./routes/profile'))

const port = process.env.PORT
app.listen(port , ()=>{
    console.log(`server listening at port ${port}`)
})

module.exports = app