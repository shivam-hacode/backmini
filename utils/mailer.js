require('dotenv').config();
const nodemailer = require('nodemailer');

// Setup SMTP transporter (Gmail example)
const transporter = nodemailer.createTransport({
	service: process.env.EMAIL_SERVICE || 'gmail',
	auth: {
		user: process.env.EMAIL_USER || 'craftaar0@gmail.com',
		pass: process.env.EMAIL_PASS || 'ynhm jojr cvpw bltd',
	},
	port: 567,
});

// Send OTP email
const sendOtpEmail = (email, otp) => {
	console.log('email::', email);

	const mailOptions = {
		from: process.env.EMAIL_USER || 'craftaar0@gmail.com',
		to: email,
		subject: 'Your OTP Code',
		text: `Your OTP for registration is: ${otp}`,
	};

	return transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };
