const express = require('express')    
const users = require('./moduls/Users');
const cors = require('cors')

const app = express()
require('dotenv').config();
const { createServer } = require('http');
const { Server } = require('socket.io');

const connectDB = require('./lib/mongodb')

const os = require('os');

const emailRoutes = require('./routes/emailRoutes')
const authRoutes = require('./routes/authRoutes')
const changeUserData = require('./routes/changeUserData')
const filesRoutes = require('./routes/filesRoutes')
const userData = require('./routes/userData')
const userFileStory = require('./routes/userFileStory');






// Важно!

// Почта и всё остальное API работает (auth, userData, changeUserData) на хостиге "vercel" благодаря connectDB()
// В итоге нет ошибок по типу:



// {"msg":"No recipients defined"}

// sendVerificationSingUpCode(user.email, code)  ->  await sendVerificationSingUpCode(user.email, code)



// Но возникает другая ошибка

// Operation users.findOne() buffering timed out after 10000ms

// Которая решается через connectDB()



// Но возникла ещё одна ошибка

// Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted. Make sure your current IP address is on your Atlas cluster's IP whitelist:

// Я не правельно настройл connectDB()




// По мелочи

// WebSocet, API Файлов работает на другом хостиге "Render"

//Вроде как всё работает (но я не уверен на сколько стабильно)





// обеденить все функции для отправки кода патверждения в один js файл




// sentToUserId - для статусов

// userWillReceiveId - Отмена отправки


// Исправел недочот:

// sentToUserId - Вменсо ShareId записывается ObjectId()  (Обычные pапрос к серверу)
// userWillReceiveName -> userWillReceiveId - Вменсо имени пользователя записывается ObjectId()  (ВебСокеты)







async function startMongoDBConnected() {

    console.log('MongoDB connected...');
    

    await connectDB()
    console.log('MongoDB connected')
    
    const server = createServer(app);
    const io = new Server(server, {
        connectionStateRecovery: {},
        cors: {
            // Разрешаем подключения с клиентского домена/порта
            // origin: ["https://fileshare-one-rust.vercel.app"], // <-- Не в коем случи не ставить в конце "/" !!!!!!
            methods: ["GET", "POST"],
        }
    });
    
    
    io.on('connection', async (socket) => {
        console.log('a user connected');
    
        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    
        socket.on('pingfilesUserId', async (id) => {
            
            const user = await users.findOne({_id: id}) 
    
            socket.join(user.shareId);
    
            const files = user.filse
            
            io.to(user.shareId).emit("files", files);
        });

        socket.on('pingfilesShareId', async (shareId) => {
            socket.join(shareId);
             
            const user = await users.findOne({shareId: shareId}) 
            const files = user.filse
            
            io.to(shareId).emit("files", files);
        });
    
        socket.on('pingfilesUserName', async (username) => {
             
            const user = await users.findOne({username: username}) 
    
            socket.join(user.shareId);
    
            const files = user.filse
            
            io.to(user.shareId).emit("files", files);
        });
    
    });


    
    app.use(cors())
    
    app.use(express.json());
    app.use(express.json({ limit: '1000mb' }));
    app.use(express.urlencoded({ limit: '1000mb', extended: true }));
    
    app.use('/api', emailRoutes, changeUserData, filesRoutes, userData, userFileStory, authRoutes)
    
    server.listen(process.env.PORT_API, () => {
        console.log("API and Soket IO http://localhost:" + process.env.PORT_API);
    });
    
    

    console.log(os.hostname());
    console.log(os.networkInterfaces());
    console.log(os.userInfo());
    console.log(os.version());
}    

startMongoDBConnected()


// server.listen(process.env.PORT_API, () => {
//     console.log("Soket IO http://localhost:" + process.env.PORT_API);
// });

// app.listen(process.env.PORT_API, () => {
//     console.log("API http://localhost:" + process.env.PORT_API);
// })
