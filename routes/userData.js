const express = require('express');
const cron = require("node-cron");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken")
const router = express.Router()
require('dotenv').config();
const path = require('path');
const nodemailer = require('nodemailer')

const Users = require('../moduls/Users')

const authMidelwares = require('../midelwares/authMidelwares');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');


const s3Client = new S3Client({
    region: process.env.region,
    credentials: {
      accessKeyId: process.env.accessKeyId,
      secretAccessKey: process.env.secretAccessKey,
    }
})

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, //587
    secure: true, //false
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});




const { translationsRecoveringAccountCode, translationsSignUpCode } = require('./locales')

async function sendVerificationSignUpCode(recipientEmail, code, lang = 'ru') {
    // Выбираем язык (если пришел неизвестный, падаем на русский)
    const translation = translationsSignUpCode[lang] || translationsSignUpCode.ru;

    let mailOptions = {
        from: `"${translation.senderName}" <no-reply@yourdomain.com>`,
        to: recipientEmail,
        subject: translation.subject,
        text: translation.text(code),
        html: translation.html(code)
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Код подтверждения отправлен на (${lang}):`, recipientEmail);
    } catch (error) {
        console.error('Ошибка при отправке почты:', error);
        throw new Error('failedToSendTheConfirmationCode');
    }
}

async function sendVerificationRecoveringAccountCode(recipientEmail, code, lang = 'ru') {
    // Выбираем язык (если пришел неизвестный, падаем на русский)
    const translation = translationsRecoveringAccountCode[lang] || translationsRecoveringAccountCode.ru;

    let mailOptions = {
        from: `"${translation.senderName}" <no-reply@yourdomain.com>`,
        to: recipientEmail,
        subject: translation.subject,
        text: translation.text(code),
        html: translation.html(code)
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Код подтверждения отправлен на (${lang}):`, recipientEmail);
    } catch (error) {
        console.error('Ошибка при отправке почты:', error);
        throw new Error('Не удалось отправить код подтверждения');
    }

    // console.log('Письмо отправлено на почту: ' + recipientEmail);
    
}








router.get('/getUserData', authMidelwares, async (req, res, next) => {
    // console.log(req);
    
    const userId = req.userId
    const { lang } = req.params

    try {
         

        const user = await Users.findOne({_id: userId})

        if (user != null && user.isVerified != false && user.isDelete != true) {

            console.log(user);
            // user.password = undefined
            // user.filse = undefined
            // user.filseStoryGet = undefined
            // user.filseStorySend = undefined

            // user.verificationCode = undefined
            // user.codeExpires = undefined
            // user.isVerified = undefined
            // user.emailNew = undefined
            // user.expirationTime = undefined

            const userDataFilter = {
                _id: user._id,
                isGuest: user.isGuest,
                shareId: user.shareId,
                avatar: user.avatar,
                username: user.username,
                email: user.email,
            }

            res.status(200).json(userDataFilter)

        } else if (user != null && user.isVerified == false) {

            const code = Math.floor(Math.random() * 999999)

            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

            user.verificationCode = code,
            user.codeExpires = expirationTime,

            await sendVerificationSignUpCode(user.email, code, lang)

            await user.save()


            const token = jwt.sign({id: user._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

            const isProduction = process.env.SECURE_COOKIE === 'production';

            res.cookie('token', token, {
                httpOnly: true,
                secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                sameSite: isProduction ? 'lax' : 'lax', // Для локальной разработки на разных портах
                maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                path: '/',
            });

            res.status(500).json({msg: "emailNotVerified"})
            
        } else if (user != null && user.isDelete == true) {

            res.status(500).json({msg: "accountDeleted"})
            
        } else {
            res.status(500).json({msg: "somethingWentWrong"})
        }


    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});


router.get('/user/isguest', authMidelwares, async (req, res, next) => {

    const userId = req.userId

    try {   
        
        const user = await Users.findOne({_id: userId})

        if (user.isGuest == true) {
            res.status(200).json({ isGuest: true })
        } else {
            res.status(200).json({ isGuest: false })
        }


    } catch (error) {
        res.status(500).json({msg: error.message})
    }

});


router.post('/user/isTheUserInDB', async (req, res, next) => {

    console.log(req.body);
    

    const {email, username} = req.body

    try {  

        const existingUserEmail = await Users.findOne({email: email})
        const existingUserUsername = await Users.findOne({username: username})
        
        if (existingUserEmail != null) {
            res.status(400).json({msg: "aUserEmailAlreadyExists"})          
        } else if (existingUserUsername != null) {
            res.status(400).json({msg: 'userNameIsTaken'})      
        } else {
            res.status(200).json({msg: `Пользователя не найден`})
        }


    } catch (error) {
        res.status(500).json({msg: error.message})
    }

});


router.get('/getUserDataById/:id', async (req, res, next) => {

    const { id } = req.params

    console.log('///////////////////////////');
    console.log(req.headers);
    console.log(req.cookies );
    console.log('///////////////////////////');
    

    try {
         

        const user = await Users.findOne({shareId: id})
        console.log(user);
        

        if (user != null) {

            if (!user.isGuest) {

                if (user.isVerified == false) {
                    res.status(400).json({msg: 'userNotFound'})
                } else if (user.isDelete == true) {
                    res.status(400).json({msg: 'userNotFound'})
                } else {
           
                    const newUser = {
                        username: user.username,
                        avatar: user.avatar
                    }
        
                    res.status(200).json(newUser)

                }

            } else {
                
                const newUser = {
                    isGuest: user.isGuest
                }
    
                res.status(200).json(newUser)

            }
          
        } else {
            res.status(400).json({msg: 'userNotFound'})
        }



    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});


router.get('/images/avatars/:id', async (req, res, next) => {
    const { id } = req.params


    try {

        const usersAvatars = path.join(__dirname, '../avatars', `${id}.png`)
        console.log(usersAvatars);

        res.sendFile(usersAvatars)
        
    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});






// router.post('/account/сreate/session', authMidelwares, async (req, res, next) => {
//     const { type } = req.body


// });










router.post('/account/delete/session', authMidelwares, async (req, res, next) => {
    const userId = req.userId
    const { password } = req.body

    try {
         
        const user = await Users.findOne({_id: userId})
        const sessionRandomId = Math.floor(Math.random() * 99999999)

        const expirationTime = new Date();
        expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000)); 

        const passwordValed = await bcrypt.compare(password, user.password)

        if (passwordValed != false) {

            const sessionNew = {
                sessionId: sessionRandomId,
                expirationTime: String(expirationTime)
            }

            user.session = sessionNew

            user.save()

            res.status(200).json({msg: 'Сессия создана', sessionId: sessionRandomId})

        } else {
            res.status(500).json({msg: 'incorrectPassword'})
        }
        
    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});


router.get('/get/session', authMidelwares, async (req, res, next) => {
    const userId = req.userId

    try {
         
        const user = await Users.findOne({_id: userId})
        const session = user.session
        console.log(session);

        if (session != undefined) {
            user.save()
            res.status(200).json({sessionId: session.sessionId})   
        } else {
            res.status(500).json({msg: 'noSessions'})
        }
        
    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});



router.delete('/account/delete', authMidelwares, async (req, res, next) => {
    const userId = req.userId

    try {
         
        const user = await Users.findOne({_id: userId})
        
        if (user != null) {

            const expirationTime = new Date();
            expirationTime.setDate(expirationTime.getDate() + 14); 

            user.isDelete = true
            user.accountDeleteExpirationTime = expirationTime
            // user.session = {}

            user.save()

            res.status(200).json({msg: 'Аккаунты удалён'})   

        } else {
            res.status(500).json({msg: 'accountDetailsNotExist'})
        }
        
    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});




//Recovering user account

router.post('/account/recovering/verification', authMidelwares, async (req, res, next) => {

    const { code } = req.body
    const userId = req.userId

    console.log('\n =================================================\n ');
    console.log(userId);
    console.log('\n =================================================\n ');
    
    
    try {
         
        const userData = await Users.findOne({ _id: userId })

        console.log('\n =================================================\n ');
        console.log(userData);
        console.log('\n =================================================\n ');
        

        if (!userData) {
            res.status(400).json({msg: "userNotFound"})
        } else {

            const expirationTime = new Date(userData.codeExpires)

            if (expirationTime > new Date()) {

                if (userData.verificationCode != code) {
                    res.status(400).json({ msg: 'invalidConfirmationCode' });
                } else {
                    
                    userData.isDelete = undefined;
                    userData.accountDeleteExpirationTime = undefined;
                    userData.codeExpires = undefined;
                    userData.verificationCode = undefined;

                    await userData.save();

                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

                    const isProduction = process.env.SECURE_COOKIE === 'production';

                    console.log(process.env.SECURE_COOKIE === 'production');
                    
                    res.cookie('token', token, {
                        httpOnly: true,
                        secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                        sameSite: isProduction ? 'lax' : 'lax', // Для локальной разработки на разных портах
                        maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                        path: '/',
                    });
                    

                    res.status(200).json({msg: 'Аккаунты восстановлен'})

                }

            } else {

                userData.verificationCode = undefined
                userData.codeExpires = undefined

                await userData.save()

                res.status(400).json({ msg: 'codeExpiredRequestNewCode' });
            }
        }

    } catch (error) {
        // res.status(500).json({msg: 'Что-то пошло не так, попробуйте позже'})
        res.status(500).json({msg: error.message})
    }
});

router.post('/account/recovering', async (req, res, next) => {

    const {email, username, password, lang} = req.body
    let userData = null

    try {
         

        if (email == '') {
            userData = await Users.findOne({username})
        } else if (username == '') {
            userData = await Users.findOne({email})
        }

        if (!userData) {
            if (email == '') {
                res.status(400).json({msg: "invalidUserName"})
            } else if (username == '') {
                res.status(400).json({msg: "invalidUserEmail"})       
            }
        } else {

            if (userData.isDelete == true) {

                const passwordValed = await bcrypt.compare(password, userData.password)
                console.log(passwordValed);
    
                if (passwordValed != false) {
                    const code = Math.floor(Math.random() * 999999)
    
                    const expirationTime = new Date();
                    expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));
    
                    userData.verificationCode = code
                    userData.codeExpires = expirationTime
    
                    await sendVerificationRecoveringAccountCode(userData.email, code, lang)
            
                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY)
                    console.log(token);

                    const isProduction = process.env.SECURE_COOKIE === 'production';
                    
                    res.cookie('token', token, {
                        secure: isProduction, // true только в продакшене
                        maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                        httpOnly: true,
                        sameSite: isProduction ? 'lax' : 'lax', // Для локальной разработки на разных портах
                        path: '/',
                    });
    
                    userData.save()
    
                    res.status(200).json({msg: 'Введите код из почты чтоб завершить восстановление'})
                } else {
                    res.status(400).json({msg: "incorrectPassword"})
                }

            } else {
                res.status(400).json({msg: "thisAccountHasNotBeenDeleted"})
            }


        }

    } catch (error) {
        // res.status(500).json({msg: 'Что-то пошло не так, попробуйте позже'})
        res.status(500).json({msg: error.message})
    }
});









cron.schedule("0 */5 * * * *", async () => {
    try {
         
        const users = await Users.find()

        users.forEach(async (user, index) => {

            if (user.session != undefined) {
                const expirationTime = new Date(user.session.expirationTime)
            
                if (expirationTime < new Date()) {

                    user.session = {}

                    console.log("Сессия удалён:", user.session.sessionId);
                }

                await user.save();   
            }

        });

    } catch (error) {
        console.log(error);   
    }
});

cron.schedule("0 */10 * * * *", async () => {
    try {
         
        const users = await Users.find()

        users.forEach(async (user, index) => {

            if (user.isDelete != undefined || user.isDelete != false) {
                const expirationTime = new Date(user.accountDeleteExpirationTime)
            
                if (expirationTime < new Date()) {

                    console.log("Пользаватель удалён:", user.username);

                    const command400 = new DeleteObjectCommand({
                        Bucket: 'sergay-air-bucket-one',
                        Key: 'avatars/' + user._id + '400.png'
                    })

                    await s3Client.send(command400)

                    const command1000 = new DeleteObjectCommand({
                        Bucket: 'sergay-air-bucket-one',
                        Key: 'avatars/' + user._id + '1000.png'
                    })

                    await s3Client.send(command1000)

                    console.log(user._id);
                    await Users.deleteOne(user._id)
                    // await Users.findByIdAndDelete(user._id)

                }

            }

        });

    } catch (error) {
        console.log(error);   
    }
});




module.exports = router;