const express = require('express');
const cron = require("node-cron");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken")
const router = express.Router()
require('dotenv').config();
const path = require('path');

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

router.get('/getUserData', authMidelwares, async (req, res, next) => {
    const userId = req.userId

    try {
         

        const user = await Users.findOne({_id: userId})

        if (user != null && user.isVerified != false && user.isDelete != true) {

            console.log(user);
            user.password = undefined
            user.filse = undefined
            user.filseStoryGet = undefined
            user.filseStorySend = undefined
            res.status(200).json(user)

        } else if (user != null && user.isVerified == false) {

            res.status(500).json({msg: 'Почта не верифицирована'})
            
        } else {
            res.status(500).json({msg: 'Что-то пошло не так'})
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


router.get('/getUserDataById/:id', async (req, res, next) => {

    const { id } = req.params

    try {
         

        const user = await Users.findOne({shareId: id})
        console.log(user);
        

        if (user != null) {

            if (!user.isGuest) {

                const newUser = {
                    username: user.username,
                    avatar: user.avatar
                }
    
                res.status(200).json(newUser)

            } else {
                
                const newUser = {
                    isGuest: user.isGuest
                }
    
                res.status(200).json(newUser)

            }
          
        } else {
            res.status(400).json({msg: 'Пользователь не найден'})
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
            res.status(500).json({msg: 'Не верный пароль'})
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
            res.status(500).json({msg: 'Нет сессий'})
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
            user.session = {}

            user.save()

            res.status(200).json({msg: 'Аккаунты удалён'})   

        } else {
            res.status(500).json({msg: 'Аккаунты с такими данными не существует'})
        }
        
    } catch (error) {
        res.status(500).json({msg: error.message})
    }
});

//recovering
router.post('/account/recovering', async (req, res, next) => {

    const {email, username, password} = req.body
    let userData = null

    try {
         

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

            userData.isDelete = undefined
            userData.accountDeleteExpirationTime = undefined
            userData.session = {}

            await userData.save()

            const passwordValed = await bcrypt.compare(password, userData.password)
            console.log(passwordValed);

            if (passwordValed != false) {
                const token = jwt.sign({id: userData._id}, process.env.JWT_SECRET_KEY, {expiresIn: "24h"})
                res.status(200).json({msg: 'Аккаунты восстановлен', token: token})
            } else {
                res.status(400).json({msg: "Не верный пароль"})
            }

        }

    } catch (error) {
        // res.status(500).json({msg: 'Что-то пошло не так, попробуйте позже'})
        res.status(500).json({msg: error})
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