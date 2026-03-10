const express = require('express')  
const router = express.Router()
require('dotenv').config();
const path = require('path');
const nodemailer = require('nodemailer')

const Users = require('../moduls/Users')

const authMidelwares = require('../midelwares/authMidelwares')
const cron = require("node-cron");

const connectDB = require('../lib/mongodb')

// service: 'Gmail',

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

    // console.log('Письмо отправлено на почту: ' + recipientEmail);
    
}

async function sendVerificationСhangeCode(recipientEmail, code) {
    let mailOptions = {
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

    // console.log('Письмо отправлено на почту: ' + recipientEmail);
}

router.get('/email/test/:email', async (req, res) => {

    const { email } = req.params

    let mailOptions = {
        from: '"Ваше приложение" <no-reply@yourdomain.com>',
        to: email,
        subject: 'Подтверждение адреса электронной почты',
        text: `Ваш код подтверждения: ${email}. Он действует 10 минут.`,
        html: `<p>Ваш код подтверждения: <b>${email}</b>. Он действует 10 минут.</p>`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({msg: 'Отправлено'});
})


router.get('/email/test', async (req, res) => {
    let mailOptions = {
        from: '"Ваше приложение" <no-reply@yourdomain.com>',
        to: 'sergeymishin749@gmail.com',
        subject: 'Подтверждение адреса электронной почты',
        text: `Ваш код подтверждения: 00000000000. Он действует 10 минут.`,
        html: `<p>Ваш код подтверждения: <b>00000000000</b>. Он действует 10 минут.</p>`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({msg: 'Отправлено'});
})


router.post('/:option/email/verify', authMidelwares, async (req, res) => {
    try {
         
        const { code } = req.body
        const userId = req.userId
        const { option } = req.params
      
        const user = await Users.findOne({_id: userId})
        console.log(user);

        const expirationTime = new Date(user.codeExpires)

        console.log(user);
        console.log(user.codeExpires);
        console.log(expirationTime);
        console.log(new Date());
        

        if (expirationTime > new Date()) {

            if (user.verificationCode != code) {
                res.status(400).json({ msg: 'Неверный код подтверждения.' });
            } else {

                user.verificationCode = undefined
                user.codeExpires = undefined

                if (option == 'change') {

                    if (user.emailNew != null) {

                        user.email = user.emailNew
                        user.emailNew = undefined

                        await user.save()
                        res.status(200).json({msg: 'Адрес эл. почты изменён'});

                    } else {
                        res.status(200).json({msg: 'Что-то пошло не так'});
                    }



                } else if (option == 'signup') {

                    user.isVerified = undefined

                    await user.save()

                    res.status(200).json({msg: 'Пользователь зарегистрирован'});

                } else {
                    res.status(400).json({msg:'Ошибка при вирефикацы, повторите попытку'});
                }
            }

        } else {

            user.verificationCode = undefined
            user.codeExpires = undefined

            await user.save()

            res.status(400).json({ msg: 'Срок действия кода истёк. Запросите новый код.' });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
})


router.get('/:option/email/new', authMidelwares, async (req, res) => {
    console.log(req.headers);

    try {
         
        const userId = req.userId
        const { option } = req.params
        const code = Math.floor(Math.random() * 999999)

        const user = await Users.findOne({_id: userId})
        console.log(user);

        const expirationTime = new Date();
        expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

        user.verificationCode = code
        user.codeExpires = expirationTime

        await user.save()

        if (option == 'change') {

            await sendVerificationСhangeCode(user.emailNew, code)

        } else if (option == 'signup') {

            await sendVerificationSingUpCode(user.email, code)

        } else {
            res.status(400).json({msg:'Ошибка при отправке, повторите попытку'});
        }

        res.status(200).json({msg:'Новый код отправлен'});

    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});

router.get('/:option/email/cancel', authMidelwares, async (req, res) => {
    console.log(req.headers);

    try {
         
        const userId = req.userId
        const { option } = req.params

        // if (!option || option == '') {
            
        // }
        const user = await Users.findOne({_id: userId})
        console.log(user);

        user.verificationCode = undefined
        user.codeExpires = undefined

        if (option == 'change') {

            user.emailNew = undefined
            await user.save()

        } else {
            res.status(400).json({msg:'Ошибка при отмене, повторите попытку'});
        }

        // else if (option == 'signup') {

        //     const userDel = await Users.findByIdAndDelete({_id: userId})

        // }

        res.status(200).json({msg:'Верификацыя отменина'});

    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});

cron.schedule("0 */15 * * * *", async () => {
    try {

         

        const users = await Users.find()
        
        for (const user of users) {
            
            const expirationTime = new Date(user.codeExpires)

            if (expirationTime < new Date()) {

                user.emailNew = undefined
                user.verificationCode = undefined
                user.codeExpires = undefined

                await user.save()

                console.log("Код потвирждения удалён:", user.username);
            }

        }

    } catch (error) {
        console.log(error);   
    }
});


module.exports = router;