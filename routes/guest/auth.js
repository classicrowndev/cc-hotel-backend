const express = require('express')
const router = express.Router()

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Guest = require('../../models/guest')

const { sendOTP, sendPasswordReset } = require("../../utils/nodemailer")



//endpoint to create account
router.post('/sign_up', async(req, res) =>{
    const {fullname, email, phone_no, password} = req.body

    if(!fullname || (!email && !phone_no) || !password)
        return res.status(400).send({status: 'error', msg: 'All fields must be filled'})

    // Start try block
    try {
        //Check if guest already exists
        const check = await Guest.findOne({$or: [{ email }, { phone_no }] })
        if(check) {
            return res.status(200).send({status: 'ok', msg: 'An account with this email or phone number already exists'})
        }

        //Hash password
        const hashedpassword = await bcrypt.hash(password, 10)

        //Create new guest
        const guest = new Guest()
        guest.fullname = fullname
        guest.email = email || null
        guest.phone_no = phone_no || null
        guest.password = hashedpassword
        //guest.is_verified = false
        guest.profile_img_url = ""
        guest.profile_img_id = ""

        await guest.save()

        /*
        // Generate verification token (optional if you want email/phone verification (expires in 30 minutes))
        const verificationToken = jwt.sign(
            { guestId: guest._id, email: guest.email, phone_no: guest.phone_no },
            process.env.JWT_SECRET,
            { expiresIn: "30m" }
        )
        
        // Optionallly, send OTP/email verification only if email is provided
        if (email) {
            await sendOTP(email, fullname, verificationToken)
        }
*/
        return res.status(200).send({ status: "ok", msg: "Account created successfully!"
            /*msg: "Account created! Check your email to verify your account."*/, _id: guest._id
        })
        
    } catch (error) {
        if(error.name == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})
    
        return res.status(500).send({status: 'error', msg:'An error occured during registration.', error})
    }
})

// endpoint to verify account
/*
router.get("/verify/:token", async (req, res) => {
    const { token } = req.params

    try {
        const guest = jwt.verify(token, process.env.JWT_SECRET)
        
        const Vguest = await Guest.findById({_id: guest._id})
        if (!Vguest)
            return res.status(400).send({ status: "error", msg: "Guest not found" })
        
        if (Vguest.is_verified)
            return res.status(200).send({ status: "ok", msg: "Account already verified" })
        Vguest.is_verified = true
        await Vguest.save()
        
        return res.status(200).send({ status: "ok", msg: "Account successfully verified" })
        
    } catch (error) {
        if (error.name === "TokenExpiredError")
            return res.status(400).send({ status: "error", msg: "Verification link expired" })
            
        if (error.name === "JsonWebTokenError")
            return res.status(400).send({ status: "error", msg: "Invalid verification token" })
            
        console.error(error)
        return res.status(500).send({ status: "error", msg: "Verification failed" })
    }
})
*/

//endpoint to Login
router.post('/sign_in', async(req, res) => {
    const {email, phone_no, password} = req.body
    if ((!email && !phone_no) || !password)
        return res.status(400).send({status: 'error', msg: 'All fields must be filled'})

    try {
        // get guest from database
        let guest = await Guest.findOne({$or: [{ email: email || null }, { phone_no: phone_no || null }] }).lean()
        if(!guest)
            return res.status(400).send({
        status: 'error', msg:'No guest account found with the provided email or phone number'})

        // check if guest's account has been verified
        /*
        if (guest.is_verified) {
            return res.status(400).send({ status: "error", msg: "Please verify your account first." })
        }*/

        // check if blocked
        if (guest.is_blocked === true) {
            return res.status(400).send({ status: "error", msg: "account blocked" })
        }
        
        // check if banned
        if (guest.is_banned === true) {
            return res.status(400).send({ status: "error", msg: "account banned" })
        }

        // check if deleted
        if (guest.is_deleted === true) {
            return res.status(400).send({ status: "error", msg: "account deleted" })
        }

        //compare password
        const correct_password = await bcrypt.compare(password, guest.password)
        if(!correct_password)
            return res.status(400).send({status: 'error', msg:'Password is incorrect'})

        // create token
        const token = jwt.sign({
            _id: guest._id,
            email: guest.email,
            phone_no: guest.phone_no
        }, process.env.JWT_SECRET, {expiresIn: '1h'})

        //update guest document to online
        guest = await Guest.findOneAndUpdate({_id: guest._id}, {is_online: true}, {new: true}).lean()

        //send response
        res.status(200).send({status: 'ok', msg: 'Login Successful', guest, token})
        
    } catch (error) {
        console.log(error)
        return res.status(500).send({status: 'error', msg:'An error occured'})  
    }
})

//endpoint to Logout
router.post('/logout', async(req, res) => {
    const {token} = req.body
    if(!token)
        return res.status(400).send({status: 'error', msg: 'Token is required'})

    try {
        //verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // check if user still exists
        const guest = await Guest.findById(decoded._id)
        if (!guest)
        return res.status(404).send({ status: 'error', msg: 'Account no longer exists' })

        // update is_online to false
        await Guest.updateOne({ _id: decoded._id }, { is_online: false })
        return res.status(200).send({ status: 'ok', msg: 'Logout Successful' })

    } catch (error) {
        console.log(error)
        if(error == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'An error occured'})    
    }
})

// endpoint to change password
router.post('/change_password', async(req, res)=>{
    const {token , old_password, new_password, confirm_new_password} = req.body

    //check if fields are passed correctly
    if(!token || !old_password || !new_password || !confirm_new_password){
       return res.status(400).send({status: 'error', msg: 'all fields must be filled'})
    }

    // get guest document and change password
    try {
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        let Cguest = await Guest.findOne({_id: guest._id}).select("password")

        if (!Cguest) {
            return res.status(400).send({status:'error', msg:'Guest not found'})
        }

        //Compare old password
        const check = await bcrypt.compare(old_password, Cguest.password)
        if(!check){
            return res.status(400).send({status:'error', msg:'old password is incorrect'})
        }

        //Prevent reusing old password
        const isSamePassword = await bcrypt.compare(new_password, Cguest.password)
        if(isSamePassword){
            return res.status(400).send({status:'error', msg:'New password must be different from the old password'})
        }

        //Confirm new passwords match
        if (new_password !== confirm_new_password) {
            return res.status(400).send({status: 'error', msg: 'Password mismatch'})
        }

        //Hash new password and update
        const updatePassword = await bcrypt.hash(confirm_new_password, 10)
        await Guest.findOneAndUpdate({_id: guest._id}, {password: updatePassword})

        return res.status(200).send({status: 'successful', msg: 'Password successfully changed'})
    } catch (error) {
        if(error.name === 'JsonWebTokenError'){
        console.log(error)
        return res.status(401).send({status: 'error', msg: 'Token Verification Failed', error: error.message})
}
      return res.status(500).send({status: 'error', msg: 'An error occured while changing password', error: error.message})}
})


// endpoint for a guest to reset their password
router.post('/forgot_password', async (req, res) => {
    const { email, phone_no } = req.body

    if (!email && !phone_no) {
        return res.status(400).send({ status: 'error', msg: 'Email or phone number is required' });
    }

    try {
        // Find guest by email or phone
        const guest = await Guest.findOne({
            $or: [{ email: email || null }, { phone_no: phone_no || null }]}).lean()

        if (!guest) {
            return res.status(400).send({ status: 'error', msg: 'No guest account found with the provided email or phone' });
        }

        // Create reset token (expires in 10 min)
        const resetToken = jwt.sign(
            { _id: guest._id },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        // Send email (or SMS later if implemented)
        await sendPasswordReset(guest.email || guest.phone_no, guest.fullname, resetToken)

        return res.status(200).send({ status: 'ok', msg: 'Password reset link sent. Please check your email or phone.' })

    } catch (error) {
        console.error(error)
        return res.status(500).send({ status: 'error', msg: 'Error sending password reset link', error: error.message })
    }
})


// endpoint to reset password webpage
router.get("/reset_password/:resetPasswordCode", async (req, res) => {
const resetPasswordCode = req.params.resetPasswordCode
    try {
      const data = jwt.verify(resetPasswordCode, process.env.JWT_SECRET)
  
      const sendTime = data.timestamp;
      // check if more than 5 minutes has elapsed
      const timestamp = Date.now()
      if (timestamp > sendTime) {
        console.log("handle the expiration of the request code")
      }
  
      return res.send(`<!DOCTYPE html>
      <html>
          <head>
              <title>Forgot Password</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">    
              <style>
                  body {
                      font-family: Arial, Helvetica, sans-serif;
                      margin-top: 10%;
                  }
                  form{
              width: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-left: 26%;
              margin-top: 0%;
          }
              @media screen and (max-width: 900px) {
                  form{
              width: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
                  }
              
  
              }
                  input[type=text]
              {
                      width: 100%;
                      padding: 12px 20px;
                      margin: 8px 0;
                      display: inline-block;
                      border: 1px solid #ccc;
                      box-sizing: border-box;
                  }
  
                  button {
                      background-color: #04AA6D;
                      color: white;
                      padding: 14px 20px;
                      margin: 8px 0;
                      border: none;
                      cursor: pointer;
                      width: 100%;
                  }
  
                  button:hover {
                      opacity: 0.8;
                  }   
  
                  .container {
                      padding: 16px;
                  }
  
                  span.psw {
                      float: right;
                      padding-top: 16px;
                  }
  
                  /* Change styles for span and cancel button on extra small screens */
                  @media screen and (max-width: 300px) {
                      span.psw {
                          display: block;
                          float: none;
                      }
  
                      .cancelbtn {
                          width: 100%;
                      }
                  }
              </style>
          </head>
          <body>    
                  <h2 style="display: flex; align-items: center; justify-content: center; margin-bottom: 0;">Recover Account</h2>
                  <h6 style="display: flex; align-items: center; justify-content: center; font-weight: 200;">Enter the new password
                      you want to use in recovering your account</h6>    
          
              <form action="http://localhost:1000/guest_auth/reset_password" method="post">
                  <div class="imgcontainer">
                  </div>
                  <div class="container">
                    <input type="password" placeholder="Enter new password" name="new_password" required style="border-radius: 5px" minlength="11">
                    <input type="password" placeholder="Confirm new password" name="confirm_password" required style="border-radius: 5px" minlength="11">
                    <input type="hidden" name="resetPasswordCode" value="${resetPasswordCode}"><br>
                    <button type="submit" style="border-radius: 5px; background-color: #1aa803">Submit</button>
                  </div>
                </form>
          </body>
  
      </html>`)
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
          // Handle general JWT errors
          console.error('JWT verification error:', e.message);
          return res.status(401).send(`</div>
          <h1>Password Reset</h1>
          <p>Token verification failed</p>
          </div>`);
        } else if (e.name === 'TokenExpiredError') {
          // Handle token expiration
          console.error('Token has expired at:', e.expiredAt);
          return res.status(401).send(`</div>
          <h1>Password Reset</h1>
          <p>Token expired</p>
          </div>`);
        } 
      console.log(e);
      return res.status(200).send(`</div>
      <h1>Password Reset</h1>
      <p>An error occured!!! ${e.message}</p>
      </div>`)
    }
  })
  
  // endpoint to reset password
  router.post("/reset_password", async (req, res) => {
    const { new_password, confirm_password, resetPasswordCode } = req.body
  
    if (!new_password || !confirm_password || !resetPasswordCode) {
      return res
        .status(400)
        .json({ status: "error", msg: "All fields must be entered" })
    }

    // Check password equality
    if (new_password !== confirm_password) {
    return res
        .status(400)
        .json({ status: "error", msg: "Passwords do not match" });
    }

    // (Optional) check minimum length / complexity on the server side too
    if (new_password.length < 11) {
    return res
        .status(400)
        .json({ status: "error", msg: "Password must be at least 11 characters" });
    }
  
    try {
      const data = jwt.verify(resetPasswordCode, process.env.JWT_SECRET)
      const hashedPassword = await bcrypt.hash(new_password, 10)

      console.log("Resetting password for user ID:", data._id)

  
      // update the phone_no field
      await Guest.updateOne(
        { _id: data._id },
        {
          $set: { password: hashedPassword } ,
        }
      );
  
      // return a response which is a web page
      return res.status(200).send(`</div>
      <h1>Reset Password</h1>
      <p>Your password has been reset successfully!!!</p>
      <p>You can now login with your new password.</p>
      </div>`);
    } catch (e) {
        if (e.name === 'JsonWebTokenError') {
          // Handle general JWT errors
          console.error('JWT verification error:', e.message);
          return res.status(401).send(`</div>
          <h1>Password Reset</h1>
          <p>Token verification failed</p>
          </div>`);
        } else if (e.name === 'TokenExpiredError') {
          // Handle token expiration
          console.error('Token has expired at:', e.expiredAt);
          return res.status(401).send(`</div>
          <h1>Password Reset</h1>
          <p>Token expired</p>
          </div>`);
        } 
      console.log("error", e);
      return res.status(200).send(`</div>
      <h1>Reset Password</h1>
      <p>An error occured!!! ${e.message}</p>
      </div>`)
    }
  })

//endpoint to delete account
router.post('/delete', async(req, res) => {
    const {token} = req.body
    if(!token)
        return res.status(400).send({status: 'error', msg: 'Token is required'})

    try {
        //verify token
        const guest = jwt.verify(token, process.env.JWT_SECRET)

        //Find the guest and delete the account
        const Dguest = await Guest.findByIdAndDelete(guest._id)

        //Check if the guest exists and was deleted
        if(!Dguest)
            return res.status(400).send({status: 'error', msg: 'No guest Found'})

        return res.status(200).send({status: 'ok', msg: 'Account Successfully deleted'})

    } catch (error) {
        console.log(error)

        if(error == "JsonWebTokenError")
            return res.status(400).send({status: 'error', msg: 'Invalid token'})

        return res.status(500).send({status: 'error', msg:'An error occured'})    
    }

})

module.exports = router