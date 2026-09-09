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

// Когда-то был сломон по тому что в EMAIL_PASS в пароле были певидимые символы для раздиления
// Пример: pppp pppp pppp pppp
// Это так называемый "Неразрывный пробел", Юникод: U+00A0, HTML: &nbsp

// Важно чтоб в пароле этих символов не было


let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, //587
    secure: true, //false
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// async function sendVerificationSignUpCode(recipientEmail, code) {
//     let mailOptions = {
//         // from: '"Ваше приложение" <no-reply@yourdomain.com>',
//         from: '"Ваше приложение" <no-reply@yourdomain.com>',
//         to: recipientEmail,
//         subject: 'Подтверждение адреса электронной почты чтобы закончить регистрацию',
//         text: `Ваш код подтверждения: ${code}. Он действует 10 минут.`,
//         html: `<p>Ваш код подтверждения: <b>${code}</b>. Он действует 10 минут.</p>`
//     };
    
    
//     try {
//         await transporter.sendMail(mailOptions);
//         console.log('Код подтверждения отправлен на:', recipientEmail);
//     } catch (error) {
//         console.error('Ошибка при отправке почты:', error);
//         throw new Error('Не удалось отправить код подтверждения');
//     }
// }


const { translationsSignUpCode } = require('./locales'); // Подключаем словарь

async function sendVerificationSignUpCode(recipientEmail, code, lang = 'ru') {
    // Выбираем язык (если пришел неизвестный, падаем на русский)
    const translation = translationsSignUpCode[lang] || translationsSignUpCode.ru;
    console.log('lang:', lang);
    console.log('translation:', translation);
    

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



router.post('/signup', async (req, res) => {
    try {

        const {email, username, password, lang} = req.body
        
        console.log(req.body);
        
        const tokenReq = req.headers["authorization"]
        console.log(tokenReq);


        async function signUpNewUserFun() {
            const existingUserEmail = await Users.findOne({email: email})
            console.log('existingUserEmail');
            console.log(existingUserEmail);

            const existingUserUsername = await Users.findOne({username: username})
            console.log('existingUserUsername');
            console.log(existingUserUsername);

            if (existingUserEmail != null) {
                res.status(400).json({msg: "aUserEmailAlreadyExists"})
                
            } else if (existingUserUsername != null) {
                res.status(400).json({msg: "userNameIsTaken"})
                
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

                await sendVerificationSignUpCode(email, code, lang)
                
                const token = jwt.sign({id: newUser._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

                const isProduction = process.env.SECURE_COOKIE === 'production';

                res.cookie('token', token, {
                    httpOnly: true,
                    secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                    sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
                    maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                    path: '/',
                });


                res.status(200).json({msg: 'Пользователь успешно зарегистрирован'})

            }
        }
        
        
        await signUpNewUserFun()


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
        console.log(token);

        const isProduction = process.env.SECURE_COOKIE === 'production';
        
        res.cookie('token', token, {
            secure: isProduction === 'production', // true только в продакшене
            maxAge: 60 * 60 * 24 * 365, // 365 дней в милисикундах
            httpOnly: true,
            sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
            path: '/',
        });

        res.cookie('recoveringGuestToken', token, {
            httpOnly: true,
            secure: isProduction, // true только в продакшене
            sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
            maxAge: 60 * 60 * 24 * 365, // 365 дней в милисикундах
            path: '/',
        });

        res.status(200).json({ msg: 'Гостивой аккаунт зарегистрирован' })

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

router.post('/guest/update', async (req, res) => {
    
    const {email, username, password, lang} = req.body

    console.log(req.body);

    const existingUserEmail = await Users.findOne({email: email})
    console.log('existingUserEmail');
    console.log(existingUserEmail);

    const existingUserUsername = await Users.findOne({username: username})
    console.log('existingUserUsername');
    console.log(existingUserUsername);

    if (existingUserEmail != null) {
        res.status(400).json({msg: "aUserEmailAlreadyExists"})
        
    } else if (existingUserUsername != null) {
        res.status(400).json({msg: 'userNameIsTaken'})
        
    } else {
    
        const tokenReq = req.headers["authorization"]
        console.log(tokenReq);

        const decoded = jwt.verify(tokenReq.split(" ")[1], process.env.JWT_SECRET_KEY)

        const getGuestUser = await Users.findOne({_id: decoded.id})


        // В случии если пользователь уже авторизован и хочет зарегистрировать новый аккаунт
        // если этот пользователь не являентся гостям то ему зарегистрируют новый аккаунт

        if (getGuestUser.isGuest != true) {
            res.status(400).json({msg: 'userIsNotAGuest'})
        } else {

            const hashed = await bcrypt.hash(password, 10)

            const code = Math.floor(Math.random() * 999999)

            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));


            await Users.findByIdAndUpdate({_id: decoded.id}, 
                { 
                    email: email,
                    username: username, 
                    password: hashed,
                    avatar: { 
                        '400': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png", 
                        '1000': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png" 
                    },
                    isVerified: false,
                    verificationCode: code,
                    codeExpires: expirationTime,
                }
            )

            getGuestUser.isGuest = undefined;
            await getGuestUser.save();

            await sendVerificationSignUpCode(email, code, lang)

            res.status(200).json({msg: 'Данные пользователя обновлены'})
        }
    }


});

router.post('/login', async (req, res) => {
    try {
         
        const {email, username, password, lang} = req.body
        let userData = null

        console.log(req.body);
        

        if (email == '') {
            userData = await Users.findOne({username: username})
        } else if (username == '') {
            userData = await Users.findOne({email: email})
        }

        if (!userData) {
            if (email == '') {
                res.status(400).json({msg: "invalidUserName"})
            } else if (username == '') {
                res.status(400).json({msg: "invalidUserEmail"})       
            }
        } else {
            if (userData.isDelete == true) {
                
                res.status(400).json({msg: "accountDetailsNotExist"})

            } else if (userData.isVerified != false) {

                const passwordValed = await bcrypt.compare(password, userData.password)
                console.log(passwordValed);

                if (passwordValed != false) {

                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

                    const isProduction = process.env.SECURE_COOKIE === 'production';

                    console.log(process.env.SECURE_COOKIE === 'production');
                    
                    res.cookie('token', token, {
                        httpOnly: true,
                        secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                        sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
                        maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                        path: '/',
                    });

                    res.status(200).json({ msg: 'Вход выполнен' })
                    // res.status(200).json({token: token})
                } else {
                    res.status(400).json({msg: "incorrectPassword"})
                }
                
            } else if (userData.isVerified == false) {

                const code = Math.floor(Math.random() * 999999)

                const expirationTime = new Date();
                expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

                userData.verificationCode = code,
                userData.codeExpires = expirationTime,

                await sendVerificationSignUpCode(userData.email, code, lang)

                await userData.save()


                const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

                const isProduction = process.env.SECURE_COOKIE === 'production';

                res.cookie('token', token, {
                    httpOnly: true,
                    secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                    sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
                    maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                    path: '/',
                });


                res.status(400).json({msg: "emailNotVerified"})
            }

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})


router.post('/login/resetpassword/new', async (req, res) => {

    try {
         
        const {email, lang} = req.body
        const userData = await Users.findOne({email})

        if (!userData) {
            res.status(400).json({msg: "accountEmailAddressNotExist"})
        } else {
            const code = Math.floor(Math.random() * 999999)

            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

            userData.verificationCode = code,
            userData.codeExpires = expirationTime,

            await sendVerificationSignUpCode(email, code, lang)

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

    console.log(req.body);
    
    
    try {
         
        const userData = await Users.findOne({email: email})

        if (!userData) {
            res.status(400).json({msg: "accountEmailAddressNotExist"})
        } else {
           const expirationTime = new Date(userData.codeExpires)

            if (expirationTime > new Date()) {

                if (userData.verificationCode != code) {
                    res.status(400).json({ msg: 'invalidConfirmationCode' });
                } else {

                    userData.verificationCode = undefined
                    userData.codeExpires = undefined

                    const hashed = await bcrypt.hash(passwordNew, 10)
                    userData.password = hashed

                    await userData.save()

                    const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})

                    const isProduction = process.env.SECURE_COOKIE === 'production';

                    res.cookie('token', token, {
                        httpOnly: true, // Запрещает доступ к куке через свойство document.cookie
                        secure: isProduction, // process.env.SECURE_COOKIE === 'production', // true только в продакшене
                        sameSite: isProduction ? 'none' : 'lax', // Для локальной разработки на разных портах
                        maxAge: 24 * 60 * 60 * 1000, // 24 часа в миллисекундах
                        path: '/',
                    });

                    res.status(200).json({msg: 'Пароль успешно обновлён'})
                }

            } else {

                userData.verificationCode = undefined
                userData.codeExpires = undefined

                await userData.save()

                res.status(400).json({ msg: 'codeExpiredRequestNewCode' });
            }

        }

    } catch (error) {
        res.status(500).json({msg: error.message})
    }
})

module.exports = router;