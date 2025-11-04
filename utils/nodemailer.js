const nodemailer = require("nodemailer")
const dotenv = require("dotenv")

dotenv.config()

const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
})


// Password Reset Email (Guest)
const sendPasswordReset = async (email, fullname, resetPasswordCode) => {
    try {
        const info = await transport.sendMail({
            from: `"Hotel Reservations" <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Reset your password",
            html: `<div>
            <div style="display: flex; align-items: center;">
                <img alt="Logo" style="height: 50px; margin-right: 8px; width: 50px;" src="https://drive.google.com/uc?export=view&id=1VxBysUQV0835JiijO4hs24M9A0rZ_Q-d">
                <img alt="Heurekka" style="height: 30px; margin-right: 8px;" src="https://drive.google.com/uc?export=view&id=1REJbJrhQZakh4UD3gypU8OPa-A2RJVZA">
            </div>
            <br/>
            <p style="line-height: 1.2;">Hi ${fullname},</p>
            <p style="line-height: 1.2;">We've received a request to reset your password.</p>
            <p style="line-height: 1.5;">If you didn't make the request, just ignore this message. Otherwise, you can reset your password.</p>        
            <a href=http://localhost:1000/guest_auth/reset_password/${resetPasswordCode}>
                <button style="font-weight: 500;font-size: 14px;cursor: pointer; background-color: rgba(238, 119, 36, 1); border: none; border-radius: 4px; padding: 12px 18px 12px 18px; color: white;">
                    Reset your password
                </button>
            </a>
            <br/>
            <br/>
            <br/>
            <br/>
            <p style="line-height: 1.5">If you did not make this request, please ignore this email. <br /><br />Best regards, <br />Team Cart.</p>
        </div>`
    })

    console.log("Email sent:", info.response)
  } catch (error) {
    console.error("Error sending email:", error)
    return { msg: "Error sending email", error }
  }
}


// Password Reset Email (Staff) - Gmail-friendly
const sendPasswordResetStaff = async (email, fullname, resetPasswordCode) => {
    try {
        const mailOptions = {
            from: `"Hotel Reservations" <${process.env.MAIL_USER}>`, // full email address
            to: email,
            subject: "Staff Reset Password",
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                    <h3>Hi ${fullname},</h3>
                    <p>We've received a request to reset your password.</p>
                    <p>If you didn't make the request, ignore this email. Otherwise, click the button below:</p>
                    <a href="http://localhost:1000/staff_auth/reset_password/${resetPasswordCode}" style="text-decoration: none;">
                        <span style="display: inline-block; background-color: #EE7724; color: white; padding: 12px 18px; border-radius: 4px; font-weight: 500;">
                            Reset Password
                        </span>
                    </a>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p>http://localhost:1000/staff_auth/reset_password/${resetPasswordCode}</p>
                    <hr>
                    <p>Best regards,<br>Team Cart</p>
                </div>
            `,
            text: `Hi ${fullname},\n\nWe've received a request to reset your password.\n\nIf you didn't make the request, ignore this email. Otherwise, visit this link:\nhttp://localhost:1000/staff_auth/reset_password/${resetPasswordCode}\n\nBest regards,\nTeam Cart`
        }

        const info = await transport.sendMail(mailOptions)
        console.log("Email sent:", info.response);
        return { msg: "Email sent successfully", info }
    } catch (error) {
        console.error("Error sending email:", error)
        return { msg: "Error sending email", error }
    }
}


// Confirmation of Staff account created
const sendStaffAccountMail = async (email, password, fullname, role) => {
    try {
        const info = await transport.sendMail({
            from: `"Classic Crown Hotel" <${process.env.MAIL_USER}>`,
            to: email,
            subject: `Welcome to Classic Crown Hotel as ${role}`,
            html: `
                <h2>Hi ${fullname},</h2>
                <p>Your ${role} account has been successfully created.</p>
                <p>Here are your login details:</p>
                <ul>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p>Please log in and change your password immediately.</p>
                <p>Best Regards,<br/>Classic Crown Management Team</p>
           `,
        })

        console.log("Staff Account Creation Email sent:", info.response)
        return { status: "ok", msg: "Email sent" }
    } catch (error) {
        console.error("Error sending staff account creation email:", error)
        return { status: "error", msg: "Failed to send email", error }
    }
}


// Guest Booking Confirmation
const sendGuestBookingMail = async (
    email, fullname, roomName, roomType, checkInDate, checkOutDate, noOfGuests, amount) => {
        try {
            const info = await transport.sendMail({
                from: `"Hotel Reservations" <${process.env.MAIL_USER}>`,
                to: email,
                subject: "Room Booking Confirmation",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Room Booking Confirmed</h2>
                    <p>Dear ${fullname},</p>
                    <p>Your booking has been successfully confirmed. Here are the details:</p>
                    <ul>
                        <li><b>Room Name:</b> ${roomName}</li>
                        <li><b>Room Type:</b> ${roomType}</li>
                        <li><b>Check-in:</b> ${new Date(checkInDate).toDateString()}</li>
                        <li><b>Check-out:</b> ${new Date(checkOutDate).toDateString()}</li>
                        <li><b>No. of Guests:</b> ${noOfGuests}</li>
                        <li><b>Amount:</b> ₦${amount}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>We look forward to hosting you!</p>
                    <p>Warm regards,<br/>Hotel Reservations Team</p>
                </div>
            `
        })

        console.log("Booking Confirmation Email sent:", info.response)
        return { status: "ok", msg: "Email sent" }
    } catch (error) {
        console.error("Error sending booking email:", error)
        return { status: "error", msg: "Failed to send email", error }
    }
}



// Guest Booking Cancellation
const sendGuestCancellationMail = async (email, fullname, roomName) => {
    try {
        const info = await transport.sendMail({
            from: `"Hotel Reservations" <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Booking Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Booking Cancelled</h2>
                    <p>Dear ${fullname},</p>
                    <p>Your booking for <b>${roomName}</b> has been successfully cancelled.</p>
                    <p>If this was a mistake, you can rebook anytime through our website.</p>
                    <p>Warm regards,<br/>Hotel Reservations Team</p>
                </div>
            `
       })

       console.log("Booking Cancellation Email sent:", info.response)
       return { status: "ok", msg: "Email sent" }
    } catch (error) {
        console.error("Error sending cancellation email:", error)
        return { status: "error", msg: "Failed to send email", error }
    }
}

// const sendOTP = async (email, otp) => {
//   try {
//     const info = await transport
//       .sendMail({
//         from: `foodkart.dev@gmail.com <${process.env.MAIL_USER}>`,
//         to: email,
//         subject: "One Time Password",
//         html: `<p style="line-height: 1.5">
//         Your OTP verification code is: <br /> <br />
//         <font size="3">${otp}</font> <br />
//         Best regards,<br />
//         Team FoodKart.
//         </p>
//         </div>`,
//       });

//     console.log("Email sent:", info.response);
//   } catch (error) {
//     console.error("Error sending email:", error);
//     return { msg: "Error sending email", error };
//   }
// };

// Guest Event Booking Confirmation
const sendGuestEventMail = async (guest, hall, date) => {
    try {
        const info = await transport.sendMail({
            from: `"Hotel Events" <${process.env.MAIL_USER}>`,
            to: guest.email,
            subject: `Event Hall Booking Confirmation - ${hall.name}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Reservation Confirmed 🎉</h2>
                    <p>Dear Guest,</p>
                    <p>Your reservation for <b>${hall.name}</b> has been successfully confirmed.</p>
                    <ul>
                        <li><b>Date:</b> ${new Date(date).toDateString()}</li>
                        <li><b>Location:</b> ${hall.location}</li>
                        <li><b>Amount:</b> ₦${hall.amount.toLocalString()}</li>
                        <li><b>Hall Type:</b> ${hall.hall_type}</li>
                    </ul>
                    <p>Status: <b>Booked</b></p>
                    <p>We look forward to seeing you at the event!</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Events Team</p>
                </div>
            `,
        })

        console.log("Event Booking Confirmation Email sent:", info.response)
        return { status: "ok", msg: "Email sent" }
    } catch (error) {
        console.error("Error sending event booking email:", error)
        return { status: "error", msg: "Failed to send email", error }
    }
}


// Guest Event Booking Cancellation
const sendGuestEventCancellationMail = async (guest, hall, date) => {
    try {
        const info = await transport.sendMail({
            from: `"Hotel Events" <${process.env.EMAIL_USER}>`,
            to: guest.email,
            subject: "Event Reservation Cancelled",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Event Reservation Cancelled ❌</h2>
                    <p>Dear Guest,</p>
                    <p>Your reservation for <b>${event.name}</b> scheduled on <b>${new Date(event.date).toDateString()}</b> has been successfully cancelled.</p>
                    <p>If this was a mistake, please rebook anytime through our events page.</p>
                    <br/>
                    <p>Warm regards,<br/>Hotel Events Team</p>
                </div>
            `,
        })

        console.log("Event Booking Cancellation Email sent:", info.response)
        return { status: "ok", msg: "Email sent" }
    } catch (error) {
        console.error("Error sending event cancellation email:", error)
        return { status: "error", msg: "Failed to send email", error }
    }
}


// const sendAccountVerification = async (email, fullname) => {
//   try {
//     const info = await transport
//       .sendMail({
//         from: `foodkart.dev@gmail.com <${process.env.MAIL_USER}>`,
//         to: email,
//         subject: "Account Verification",
//         html: `<p style="line-height: 1.5">
//         Congratulations ${fullname}, you account has been verified.
//         You can now enjoy the perks that comes with this status.
//         Best regards,<br />
//         Team FoodKart.
//         </p>
//         </div>`,
//       });

//     console.log("Email sent:", info.response);
//   } catch (error) {
//     console.error("Error sending email:", error);
//     return { msg: "Error sending email", error };
//   }
// }

module.exports = {
    sendPasswordReset,
    sendPasswordResetStaff,
    sendStaffAccountMail,
    sendGuestBookingMail,
    sendGuestCancellationMail,
    sendGuestEventMail,
    sendGuestEventCancellationMail
}