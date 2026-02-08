const express = require('express')  
const mongoose = require('mongoose')  
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const fs = require('fs');
const router = express.Router()
require('dotenv').config();
const path = require('path');

const connectDB = require('../lib/mongodb')

const Users = require('../moduls/Users')

const authMidelwares = require('../midelwares/authMidelwares')
const multer = require('multer')


const { 
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3')


const s3Client = new S3Client({
    region: process.env.region,
    credentials: {
      accessKeyId: process.env.accessKeyId,
      secretAccessKey: process.env.secretAccessKey,
    }
})




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


async function sendVerificationСhangeCode(recipientEmail, code) {
    let mailOptions = {
        from: '"Ваше приложение" <no-reply@yourdomain.com>',
        to: recipientEmail,
        subject: 'Подтверждение смены адреса электронной почты',
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


router.post('/change/avatar/default', authMidelwares, async (req, res) => {
    try {
         
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        user.avatar = { 
            '400': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png",
            '1000': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/default.png" 
        }

        await user.save()
        
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});





const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 1024 * 1024 * 100000
    }
})





const seveAvatarAndSetting = async (fileBuffer, format, animated, userId) => {
    
    let img1000 = ''
    let img400 = ''

    if (animated == true) {

        img1000 = await sharp(fileBuffer, { animated: animated })
            .resize({
                width: 1000,
                height: 1000,
                fit: sharp.fit.cover,
                position: sharp.gravity.center
            })
            .gif({ dither: 0, colors: 256 })
            .toFormat(`${format}`)
            .toBuffer();
            
        img400 = await sharp(fileBuffer, { animated: animated })
            .resize({
                width: 400, 
                height: 400, 
                fit: sharp.fit.cover,
                position: sharp.gravity.center
            })
            .gif({ dither: 0, colors: 256 })
            .toFormat(`${format}`)
            .toBuffer();
        
    } else {

        img1000 = await sharp(fileBuffer)
            .resize({
                width: 1000,
                height: 1000,
                fit: sharp.fit.cover,
                position: sharp.gravity.center
            })
            .toFormat(`${format}`)
            .toBuffer();
            
        img400 = await sharp(fileBuffer)
            .resize({
                width: 400, 
                height: 400, 
                fit: sharp.fit.cover,
                position: sharp.gravity.center
            })
            .toFormat(`${format}`)
            .toBuffer();
        
    }

        
    await s3Client.send(new PutObjectCommand({
        Bucket: 'sergay-air-bucket-one',
        Key: `avatars/${userId}1000.${format}`,
        Body: img1000,
        ContentType: `image/${format}`,
    }));

    await s3Client.send(new PutObjectCommand({
        Bucket: 'sergay-air-bucket-one',
        Key: `avatars/${userId}400.${format}`,
        Body: img400,
        ContentType: `image/${format}`,
    }));

}



router.post('/change/avatar', uploadAvatar.single('avatar'), authMidelwares, async (req, res) => {
    try {

        const { v } = req.body
        
        const userId = req.userId
        // req.file.originalname = userId + '.png'

        const lastDotIndex = req.file.originalname.lastIndexOf('.');

        let format = ''

        console.log(req.file);


        if (lastDotIndex === -1 || lastDotIndex === 0) {
            format = 'png'
            await seveAvatarAndSetting(req.file.buffer, 'png', false, userId)
        } else {

            const fileExtension = req.file.originalname.substring(lastDotIndex + 1)
            
            console.log(req.file);

            if (fileExtension == 'gif') {
                format = 'gif'
                await seveAvatarAndSetting(req.file.buffer, 'gif', true, userId) 

            } else if (fileExtension == 'webp') {
                format = 'webp'
                await seveAvatarAndSetting(req.file.buffer, 'webp', true, userId)
            } else {
                format = 'png'
                await seveAvatarAndSetting(req.file.buffer, 'png', false, userId)
            }

            const user = await Users.findOne({_id: userId})
            console.log(user);


            user.avatar = { 
                '400': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/" + userId + '400' + "." + format + "?v=" + v,
                '1000': "https://sergay-air-bucket-one.s3.eu-north-1.amazonaws.com/avatars/" + userId + '1000' + "." + format + "?v=" + v
            }
            await user.save()

            console.log('Файл успешно удалён');
            res.status(200).json({msg:'Новая аватарка сахранина'});

        }


        
        
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});













router.put('/change/email', authMidelwares, async (req, res) => {
    console.log(req.body);
    console.log(req.headers);

    try {
         
        const userId = req.userId
        const code = Math.floor(Math.random() * 999999)
        const { emailNew } = req.body

        const user = await Users.findOne({_id: userId})
        console.log(user);
        const similarEmailuser = await Users.findOne({email: emailNew})

        if (!similarEmailuser) {
            const expirationTime = new Date();
            expirationTime.setTime(expirationTime.getTime() + (10 * 60 * 1000));

            user.verificationCode = code
            user.codeExpires = expirationTime
            user.emailNew = emailNew
            await user.save()

            await sendVerificationСhangeCode(user.emailNew, code)

            res.status(200).json({msg:'Код отправлен'});   
        } else {
            res.status(400).json({msg: "Полизователь с такой почтой уже существует"})
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});






router.put('/change/username', authMidelwares, async (req, res) => {
    console.log(req.body);
    console.log(req.headers);
    try {
         
        const userId = req.userId
        const { usernameNew } = req.body

        const user = await Users.findOne({_id: userId})
        console.log(user);

        user.username = usernameNew
        await user.save()

        res.status(200).json({msg:'Имя пользователя изменина'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});






router.put('/change/password', authMidelwares, async (req, res) => {
    console.log(req.body);
    console.log(req.headers);
    try {
         
        const userId = req.userId
        const { passwordOld, passwordNew, passwordRepeatNew } = req.body

        const user = await Users.findOne({_id: userId})
        console.log(user);

        const passwordValed = await bcrypt.compare(passwordOld, user.password)

        if (passwordValed != false) {

            const hashed = await bcrypt.hash(passwordNew, 10)

            user.password = hashed  
            await user.save()
            res.status(200).json({msg:'Пароль изменён'});

        } else {
            res.status(400).json({msg: "Не верный пароль"})
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});


module.exports = router;