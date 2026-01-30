const express = require('express')   
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const nodemailer = require('nodemailer');
const router = express.Router()
require('dotenv').config();

const Users = require('../moduls/Users')
const authMidelwares = require('../midelwares/authMidelwares')

const connectDB = require('../lib/mongodb')

// service: 'gmail', //Gmail

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, //587
    secure: true, //false
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


async function sendVerificationSingUpCode(recipientEmail, code) {
    let mailOptions = {
        // from: '"Ваше приложение" <no-reply@yourdomain.com>',
        from: '"Ваше приложение" <no-reply@yourdomain.com>',
        to: recipientEmail,
        subject: 'Подтверждение адреса электронной почты',
        text: `Ваш код подтверждения: ${code}. Он действует 10 минут.`,
        html: `<p>Ваш код подтверждения: <b>${code}</b>. Он действует 10 минут.</p>`
    };
    
    
    try {
        await transporter.sendMail(mailOptions);
        console.log('Код подтверждения отправлен на:', recipientEmail);
    } catch (error) {
        console.error('Ошибка при отправке почты:', error);
        throw new Error('Не удалось отправить код подтверждения');
    }
}




router.post('/signup', async (req, res) => {
    try {
         
        const {email, username, password} = req.body

        console.log(req.body);
        

        const existingUserEmail = await Users.findOne({email})
        console.log(existingUserEmail);

        const existingUserUsername = await Users.findOne({username})
        console.log(existingUserUsername);

        if (existingUserEmail != null) {
            res.status(400).json({msg: "Полизователь с этой почтай уже существует"})
            
        } else if (existingUserUsername != null) {
            res.status(400).json({msg: `Имя пользователя ${username} уже зането`})
            
        } else {
            const hashed = await bcrypt.hash(password, 10)

            const shareId = Math.floor(Math.random() * 99999999)

            const code = Math.floor(Math.random() * 999999)

            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

            const newUser = new Users(
                {
                    email: email,
                    username: username, 
                    password: hashed,
                    shareId: shareId,
                    avatar: { 
                        '400': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png", 
                        '1000': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png" 
                    },
                    isVerified: false,
                    verificationCode: code,
                    codeExpires: expirationTime,
                }
            )
            await newUser.save()
            console.log(newUser);

            await sendVerificationSingUpCode(email, code)
            
            const token = jwt.sign({id: newUser._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})
            res.status(200).json({token: token})

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

router.post('/signup/guest', async (req, res) => {
    try {

        const shareId = Math.floor(Math.random() * 99999999)
        const newUser = new Users(
            {
                shareId: shareId,
                isGuest: true
            }
        )
        await newUser.save()
        console.log(newUser);
        
        const token = jwt.sign({id: newUser._id}, process.env.JWT_SECRET_KEY)
        res.status(200).json({token: token})

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

router.post('/login', async (req, res) => {
    try {
         
        const {email, username, password} = req.body
        let userData = null

        if (email == '') {
            userData = await Users.findOne({username})
        } else if (username == '') {
            userData = await Users.findOne({email})
        }

        if (!userData) {
            if (email == '') {
                res.status(400).json({msg: "Неверное имя пользователя"})
            } else if (username == '') {
                res.status(400).json({msg: "Неверная Почта"})       
            }
        } else {
            if (userData.isDelete == true) {
                
                res.status(400).json({msg: "Аккаунта с такими данными не существует"})

            } else if (userData.isVerified != false) {

                const passwordValed = await bcrypt.compare(password, userData.password)
                console.log(passwordValed);

                if (passwordValed != false) {
                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})
                    res.status(200).json({token: token})
                } else {
                    res.status(400).json({msg: "Не верный пароль"})
                }
                
            } else {

                const code = Math.floor(Math.random() * 999999)

                const expirationTime = new Date();
                expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

                userData.verificationCode = code,
                userData.codeExpires = expirationTime,

                await sendVerificationSingUpCode(userData.email, code)

                await userData.save()


                const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})
                res.status(400).json({msg: "Почта не верифицирована", token: token})
            }

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})


router.post('/login/resetpassword', async (req, res) => {

    try {
         
        const {email} = req.body
        const userData = await Users.findOne({email})

        if (!userData) {
            res.status(400).json({msg: "Аккаунта с этой почтой не существует"})
        } else {
            const code = Math.floor(Math.random() * 999999)

            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

            userData.verificationCode = code,
            userData.codeExpires = expirationTime,

            await sendVerificationSingUpCode(email, code)

            await userData.save()

            res.status(200).json({msg: "Код отправлен"})

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

router.post('/login/resetpassword/cancel', async (req, res) => {

    try {
         
        const {email} = req.body
        const userData = await Users.findOne({email})
        userData.verificationCode = undefined
        userData.codeExpires = undefined

        res.status(200).json({msg: "Сброс отменён"})

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

router.post('/login/resetpassword/verify', async (req, res) => {

    const {email, code, passwordNew } = req.body
    
    try {
         

        const userData = await Users.findOne({email})

        if (!userData) {
            res.status(400).json({msg: "Аккаунта с этой почтой не существует"})
        } else {
           const expirationTime = new Date(userData.codeExpires)

            if (expirationTime > new Date()) {

                if (userData.verificationCode != code) {
                    res.status(400).json({ msg: 'Неверный код подтверждения.' });
                } else {

                    userData.verificationCode = undefined
                    userData.codeExpires = undefined

                    const hashed = await bcrypt.hash(passwordNew, 10)
                    userData.password = hashed

                    await userData.save()

                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})
                    res.status(200).json({token: token})
                }

            } else {

                userData.verificationCode = undefined
                userData.codeExpires = undefined

                await userData.save()

                res.status(400).json({ msg: 'Срок действия кода истёк. Запросите новый код.' });
            }

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

module.exports = router;