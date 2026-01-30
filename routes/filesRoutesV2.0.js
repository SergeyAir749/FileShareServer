const express = require('express')  
const router = express.Router()
require('dotenv').config();
const path = require('path');
const { 
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} = require('@aws-sdk/client-s3')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const multerS3 = require('multer-s3')

const Users = require('../moduls/Users')

const authMidelwares = require('../midelwares/authMidelwares')
const multer = require('multer');
const cron = require("node-cron");

const connectDB = require('../lib/mongodb')


const s3Client = new S3Client({
    region: process.env.region,
    credentials: {
      accessKeyId: process.env.accessKeyId,
      secretAccessKey: process.env.secretAccessKey,
    }
})






const generateFilename = (fileName) => {
    const randomNameId = Math.floor(Math.random() * 9999999999)

    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex === -1 || lastDotIndex === 0) {
        return `${fileName} (${randomNameId})`;
    }

    const fileNameUTFNotExtension = fileName.substring(0, lastDotIndex)
    const fileExtension = fileName.substring(lastDotIndex + 1)

    console.log(`${fileName}${randomNameId}.${fileExtension}`);
    return `${fileNameUTFNotExtension} (${randomNameId}).${fileExtension}`;
}


// Ты зарание позоботился о том с каким названиям будут сохраниться
// поэтому в будующем в "/fileLoad/:id/" upload.array('files') req.files 
// возвращает файлы с изменённым названием

const uploadS3 = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: 'sergay-air-bucket-one',

    key: function (req, file, cb) {
      console.log(req);
      
      const fileNameUTF = Buffer.from(file.originalname, 'latin1').toString('utf8');
      console.log(fileNameUTF);

      const fileName = generateFilename(fileNameUTF)
      console.log(fileName);
      
      cb(null, file.originalname = fileName);
      cb(null, file.key = 'files/' + fileName);
      console.log('key');
      console.log(file);
    },

  })
})



router.post('/fileLoadNew/:id/', uploadS3.array('files'), authMidelwares, async (req, res) => {
    try {
         

        const userId = req.userId
    
        const { id } = req.params
        const { sentToUserId, data, device, username } = req.body

        console.log(id);  
        console.log(device);  
        console.log(data);  
        console.log(username);

        console.log(req.files);

        const userWillReceive = await Users.findOne({shareId: id})
        const sentToUser = await Users.findOne({_id: userId})

        let filseStorySendNew = sentToUser.filseStorySend

        const expirationTime = new Date();
        expirationTime.setDate(expirationTime.getDate() + 14);

        req.files.forEach((item, index) => {

            const obj = {
                id: Math.floor(Math.random() * 9999999999),
                filename: item.originalname,
                sentFromDevice: device,
                data: data,
                status: 'sent',
                sentToUserId: sentToUserId,
                sentToUser: username,
                userWillReceive: userWillReceive.username,
                expirationTime: expirationTime
            }

            // console.log(obj);

            userWillReceive.filse.push(obj)
            filseStorySendNew.unshift(obj)
            console.log(sentToUser.filseStorySend);
        })


        // sentToUser.save() в данном случае не подходил, и выдавал ошибку
        // Поэтому пришлось использовать findByIdAndUpdate

        // console.log(user);
        await userWillReceive.save()
        await Users.findByIdAndUpdate({_id: userId}, {filseStorySend: filseStorySendNew})


        res.status(200).send({msg:'Файлы успешно загружены!'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});








router.post('/textLoad/:id', authMidelwares, async (req, res) => {

    console.log(req.body);

    try {
         
        const { id } = req.params
        const { sentToUserId, textValue, data, device, username } = req.body
        const userId = req.userId

        let filseStorySendNew = sentToUser.filseStorySend

        const userWillReceive = await Users.findOne({shareId: id})
        const sentToUser = await Users.findOne({_id: userId})

        const expirationTime = new Date();
        expirationTime.setDate(expirationTime.getDate() + 14);

        const obj = {
            id: Math.floor(Math.random() * 9999999999),
            text: textValue,
            sentFromDevice: device,
            data: data,
            status: 'sent',
            sentToUserId: sentToUserId,
            sentToUser: username,
            userWillReceive: userWillReceive.username,
            expirationTime: expirationTime
        }

        userWillReceive.filse.push(obj)
        filseStorySendNew.unshift(obj)
        console.log(sentToUser.filseStorySend);

        // sentToUser.save() в данном случае не подходил, и выдавал ошибку
        // Поэтому пришлось использовать findByIdAndUpdate

        console.log(userWillReceive);
        await userWillReceive.save()
        await Users.findByIdAndUpdate({_id: userId}, {filseStorySend: filseStorySendNew})

        res.status(200).send({msg:'Текст успешно загружены!'});
    } catch (error) {
        console.log(error);
        res.status(500).json({msg: error.message})
    }
});





// Скачивание файла и перемещение в историю

router.get('/getDownloadNew/:option/:shareId/:fileId', async (req, res) => {
    try {
         
        console.log(req.params);
        
        const { shareId, fileId, option } = req.params
    
        const userShareId = await Users.findOne({shareId: shareId})
        const filse = userShareId.filse

        const getFile = filse.find((item) => item.id == fileId)
        const deleteFile = filse.filter((item) => item.id != fileId)
        
        if (option == 'file') {
            if (getFile != undefined) {

                

                // использовать здесь .save() бесполезно записи не происходят



                // Пльзователь принял файл, запись в историю получении

                getFile.status = 'accepted'
                let filseStoryGetNew = userShareId.filseStoryGet
                filseStoryGetNew.unshift(getFile)
                userShareId.filse = deleteFile

                await Users.findOneAndUpdate({shareId: shareId}, {filseStoryGet: filseStoryGetNew, filse: deleteFile})




                // переписываем статус файла, для отправителя

                const sentToUserId = await Users.findOne({shareId: getFile.sentToUserId})
                const filseStorySendNew = sentToUserId.filseStorySend
                
                const reStatus = filseStorySendNew.find(file => file.id == fileId)

                reStatus.status = 'accepted'
                await Users.findOneAndUpdate({shareId: getFile.sentToUserId}, {filseStorySend: filseStorySendNew})
                console.log(filseStorySendNew);





                // await sentToUserId.save()

                console.log(sentToUserId);
                

                // console.log(getFile.filename);

                const command = new GetObjectCommand({
                    Bucket: 'sergay-air-bucket-one',
                    Key: 'files/' + getFile.filename
                })

                const url = await getSignedUrl(s3Client, command) 

                res.send({url: url});
            } else {
                res.send({msg:'Файл не найден'});
            }            
        } else if (option == 'text') {

            if (getFile != undefined) {


                // использовать здесь .save() бесполезно записи не происходят



                // Пльзователь принял файл, запись в историю получении

                getFile.status = 'accepted'
                let filseStoryGetNew = userShareId.filseStoryGet
                filseStoryGetNew.unshift(getFile)
                userShareId.filse = deleteFile

                await Users.findOneAndUpdate({shareId: shareId}, {filseStoryGet: filseStoryGetNew, filse: deleteFile})





                // переписываем статус файла, для отправителя

                const sentToUserId = await Users.findOne({shareId: getFile.sentToUserId})
                const filseStorySendNew = sentToUserId.filseStorySend
                
                const reStatus = filseStorySendNew.find(file => file.id == fileId)

                reStatus.status = 'accepted'
                await Users.findOneAndUpdate({shareId: getFile.sentToUserId}, {filseStorySend: filseStorySendNew})
                console.log(filseStorySendNew);




                

                res.send({msg:'Текст принет'});
            } else {
                res.send({msg:'Текст не найден'});
            }

        }

    } catch (error) {
        console.log(error);  
        res.status(500).send(error);
    }
});









router.post('/files/cancel/:shareId',authMidelwares, async (req, res) => {
    try {
         
        const { shareId } = req.params
        const userId = req.userId

        const user = await Users.findOne({_id: userId})

        if (!user) {
            return res.status(404).send({ msg: 'Пользователь не найден' })
        }

        if (user.shareId == shareId) {

            for (const file of user.filse) {

                const sentToUser = await Users.findOne({shareId: file.sentToUserId})
                let filseStorySendNew = sentToUser.filseStorySend

                if (sentToUser != null) {
            
                    const newFilseFind = filseStorySendNew.find((item) => item.id == id)
                    
                    console.log('newFilseFind ', newFilseFind);

                    if (sentToUser != null) {
                        newFilseFind.status = 'refusal'
                        console.log('filseStorySendNew ', filseStorySendNew);
                        
                        await Users.findOneAndUpdate({shareId: file.sentToUserId}, {filseStorySend: filseStorySendNew})
                    } else {
                    
                    }

                } else {
                    
                }


            }

            await user.save()
            
            res.send({msg: 'Загрузка отменена'}); 
        } else {
            res.status(500).send({msg: 'Ошибка Что-то пошло не так'}); 
        }

    } catch (error) {
        console.log(error);  
        res.send(error);
    }
});


router.post('/files/cancel/:shareId/:id', authMidelwares, async (req, res) => {
    try {
         

        const { shareId, id } = req.params
        console.log(req.params)
        const userId = req.userId
        
        const user = await Users.findOne({_id: userId})

        if (!user) {
            return res.status(404).send({ msg: 'Пользователь не найден' })
        }

        if (user.shareId == shareId) {

            const newFilseFind = user.filse.find((item) => item.id == id)
            const newFilseFilter = user.filse.filter((item) => item.id != id)

            const sentToUser = await Users.findOne({shareId: newFilseFind.sentToUserId})
            let filseStorySendNew = sentToUser.filseStorySend
            console.log('filseStorySend', filseStorySendNew);
            
            if (sentToUser != null) {
            
                const newFilseFind = filseStorySendNew.find((item) => item.id == id)
                
                console.log('newFilseFind ', newFilseFind);

                if (sentToUser != null) {
                    newFilseFind.status = 'refusal'
                    console.log('filseStorySendNew ', filseStorySendNew);
                    
                    await Users.findOneAndUpdate({shareId: newFilseFind.sentToUserId}, {filseStorySend: filseStorySendNew})
                } else {
                
                }

            } else {
                
            }

            user.filse = newFilseFilter
            await user.save()

        } else {
            res.status(500).send({msg: 'Ошибка Что-то пошло не так'}); 
        }
        
        res.send({msg: 'Загрузка отменена'});
    } catch (error) {
        console.log(error);  
        res.send(error);
    }
});





cron.schedule("0 0 * * * *", async () => {
    try {
         
        const users = await Users.find()

        for (const user of users) {

            const newFilesDelete = [];

            //filse
            for (const file of user.filse) {

                const expirationTime = new Date(file.expirationTime)
                
                if (expirationTime < new Date()) {

                    const command = new DeleteObjectCommand({
                        Bucket: 'sergay-air-bucket-one',
                        Key: 'files/' + file.filename
                    })

                    await s3Client.send(command)

                    console.log("Файл удалён:", file.filename);
                } else {
                    newFilesDelete.push(file);
                }

            }

            //filseStorySend
            for (const file of user.filseStorySend) {

                const expirationTime = new Date(file.expirationTime)
                
                if (expirationTime < new Date()) {

                    const command = new DeleteObjectCommand({
                        Bucket: 'sergay-air-bucket-one',
                        Key: 'files/' + file.filename
                    })

                    await s3Client.send(command)

                    console.log("Файл удалён:", file.filename);
                }

            }

            for (const file of user.filseStoryGet) {

                const expirationTime = new Date(file.expirationTime)
                
                if (expirationTime < new Date()) {

                    const command = new DeleteObjectCommand({
                        Bucket: 'sergay-air-bucket-one',
                        Key: 'files/' + file.filename
                    })

                    await s3Client.send(command)

                    console.log("Файл удалён:", file.filename);
                }

            }

            user.filse = newFilesDelete
            await user.save();
            
        }

    } catch (error) {
        console.log(error);   
    }
});






module.exports = router;