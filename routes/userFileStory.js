const express = require('express')  
const router = express.Router()
require('dotenv').config();

const Users = require('../moduls/Users')
const authMidelwares = require('../midelwares/authMidelwares')

const connectDB = require('../lib/mongodb')




// Story get CRUD

router.get('/story/get', authMidelwares, async (req, res) => {
    try {
         
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        res.status(200).send(user.filseStoryGet);
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
})


router.post('/story/get/delete/:id', authMidelwares, async (req, res) => {
    console.log(req.body);

    try {
        const { id } = req.params
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        const newFilseStory = user.filseStoryGet.filter((item) => item.id != id)
        user.filseStoryGet = newFilseStory
        await user.save()

        res.status(200).send({msg:'Удалено из истории'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});


router.post('/story/get/deleteAll/', authMidelwares, async (req, res) => {
    console.log(req.body);
    try {
         
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        user.filseStoryGet = []
        await user.save()

        res.status(200).send({msg:'Вся история удалена'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});




// Story send CRUD

router.get('/story/send', authMidelwares, async (req, res) => {
    try {
         
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        res.status(200).send(user.filseStorySend);
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
})

router.post('/story/send/delete/:id', authMidelwares, async (req, res) => {
    console.log(req.body);

    try {
         
        const { id } = req.params
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        const newFilseStory = user.filseStorySend.filter((item) => item.id != id)
        user.filseStorySend = newFilseStory
        await user.save()

        res.status(200).send({msg:'Удалено из истории'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});

router.post('/story/send/deleteAll/', authMidelwares, async (req, res) => {
    console.log(req.body);
    try {
         
        const userId = req.userId

        const user = await Users.findOne({_id: userId})
        console.log(user);

        user.filseStorySend = []
        await user.save()

        res.status(200).send({msg:'Вся история удалена'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});




router.post('/files/send/delete/:id', authMidelwares, async (req, res) => {
    console.log(req.body);

    try {
         
        const { id } = req.params
        const { userWillReceiveName } = req.body
        const userId = req.userId

        console.log(req.params);
        console.log(req.body);

        const userWillReceive = await Users.findOne({username: userWillReceiveName})
        console.log(userWillReceive);

        const newFilse = userWillReceive.filse.filter((item) => item.id != id)
        userWillReceive.filse = newFilse
        await userWillReceive.save()


        const user = await Users.findOne({_id: userId})
        console.log(user);

        const newFilseStory = user.filseStorySend.filter((item) => item.id != id)
        user.filseStorySend = newFilseStory
        await user.save()


        res.status(200).send({msg:'Отправка отменина'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});





module.exports = router;