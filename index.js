const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const client = require('./connect.js')
const cookieParser = require('cookie-parser')
const login = require('./login.js')
const md5 = require('md5')
const uniqid = require('uniqid')
var accid
var user

// app.all('/*', function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "X-Requested-With");
//     next();
//   });


app.use(cookieParser('lkjslfjoiqwueriowejklfjslkdjfklsjdflksakdlfjslkdfhsdklfjsldkfjslkfjlsjflksjflksjlfksdfjklsfjlksjflsjlfshfuwyqeruiwyuri'))
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'))
app.use(login)

app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')



app.get('/', async function(req, res) {
    let email = req.signedCookies.email

    let account = await client.db('chat').collection('account').findOne({email: email})
    if(!account) return res.send('Not found account. Try login again')

    accid = account.id

    user = await client.db('chat').collection('user').findOne({accId: accid})
    if(!user) return res.send('Not found user. Try sign-in again')

    res.render('index')
})

app.get('/login', function(req, res) {
    res.render('login', {err: undefined})
})
app.post('/login', async function(req, res) {
    let email = req.body.email
    let password = req.body.password
    let account = await client.db('chat').collection('account').findOne({email: email, password: md5(password)})
   
    if(account) {
        res.cookie('email', email, {
            expires: new Date(Date.now() + 24 * 3600000),
            signed: true
        })
        .cookie('password', md5(password), {
            expires: new Date(Date.now() + 24 * 3600000),
            signed: true
        })
        return res.redirect('/')
    }
    return res.render('login', { err: 'Email and Password not correct' })
})

app.get('/sign-in', function(req, res) {
    res.render('signIn', {err: undefined})
})

app.post('/sign-in', async function(req, res) {
    let email = req.body.email
    let password = req.body.password
    let username = req.body.username
    let job = req.body.job
    let accId = uniqid()


    if(!email.trim() || !password.trim() || !username.trim() || !job.trim()) {
        res.render('signIn', {err: 'Field not empty'})
        return
    }

    let accountEmail = await client.db('chat').collection('account').findOne({ email: email })
    if(accountEmail) return res.render('signIn', { err: 'Has account. Let login'})



    await client.db('chat').collection('account').insertOne({
        id: accId,
        email: email,
        password: md5(password)
    })
    await client.db('chat').collection('user').insertOne({
        id: uniqid(),
        accId: accId,
        name: username,
        job: job
    })
    res.cookie('email', email, {
        expires: new Date(Date.now() + 24 * 3600000),
        signed: true
    })
    .cookie('password', md5(password), {
        expires: new Date(Date.now() + 24 * 3600000),
        signed: true
    })
    return res.redirect('/')
})


app.post('/getData', async function(req, res) {
    if(accid) return res.send(accid)
    let email = req.signedCookies.email

    let account = await client.db('chat').collection('account').findOne({email: email})
    if(!account) return res.send('Not found account. Try login again')

    let accId = account.id
    accid = account.id

    let u = await client.db('chat').collection('user').findOne({accId: accId})
    if(!u) return res.send('Not found user. Try sign-in again')
    user = u
    return res.send(accId)
})

app.post('/topics', async function(req, res) {
    let uid = user.id
    let limit = req.query.limit
    let cursor1 = client.db('chat').collection('topic').find({user1: `${uid}`}).sort({updated: 1}).limit(+limit)
    let topics = await cursor1.toArray()
    return res.send(topics)
})  

app.post('/getMe', async function(req, res) {
    if(user) return res.send(JSON.stringify(user))
    if(accid) {
        user = await client.db('chat').collection('user').findOne({accId: accid})
        return res.send(JSON.stringify(user))
    }

    let email = req.signedCookies.email

    let account = await client.db('chat').collection('account').findOne({email: email})
    if(!account) return res.send('Not found account. Try login again')

    accid = account.id

    user = await client.db('chat').collection('user').findOne({accId: accid})
    if(!user) return res.send('Not found user. Try sign-in again')

    return res.send(JSON.stringify(user))
})

app.post('/searchUsers', async function(req, res) {
    let data = req.query.search
    console.log(data, 'data')
    let cursor = client.db('chat').collection('user').find({name: data})

    let users = await cursor.toArray()
    console.log(users, 'users')
    return res.send(JSON.stringify(users))
})

app.post('/getTopic', async function(req, res) {
    let u1 = req.query.u1
    let u2 = req.query.u2
    let topic = await client.db('chat').collection('topic').findOne({user1: u1, user2: u2})
    return res.send(topic)
})

app.post('/createTopic', async function(req, res) {
    let u1 = req.query.u1
    let u2 = req.query.u2
    let cid = uniqid()
    let topic1 = {
        id: uniqid(),
        user1: u1,
        user2: u2,
        cid: cid,
        created: Date.now(),
        updated: Date.now(),
        unread: 0
    }
    let topic2 = {
        id: uniqid(),
        user1: u2,
        user2: u1,
        cid: cid,
        created: Date.now(),
        updated: Date.now(),
        unread: 0
    }
    topic1 = await client.db('chat').collection('topic').insertOne(topic1)
    if(u1 !== u2) topic2 = await client.db('chat').collection('topic').insertOne(topic2)
    return res.send(topic1)
})

app.post('/getConversation', async function(req, res) {
    let cid = req.query.cid
    let cursor = client.db('chat').collection('conversation').find({cid: cid})
    conversation = await cursor.toArray()
    return res.send(JSON.stringify(conversation))
})

app.post('/getUser', async function(req, res) {
    let uid = req.query.uid
    let user = await client.db('chat').collection('user').findOne({id: `${uid}`})
    return res.send(user)
})

app.post('/createMessage', async function(req,res) {
    let body = req.body
    let payload
    Object.keys(body).map(key => payload = JSON.parse(key))
    let message = payload.payload
    console.log(payload.payload, 'payload')
    let result = await client.db('chat').collection('conversation').insertOne(message)
    return res.json(result)
})

app.post('/update-topic', async function(req,res) {
    let body = req.body
    let payload
    Object.keys(body).map(key => payload = JSON.parse(key))
    let topic = payload.payload
    let topic2
    if(topic.user1 !== topic.user2) topic2 = await client.db('chat').collection('topic').findOne({user1: topic.user2, cid: topic.cid})
    let t2
    let t1 = await client.db('chat').collection('topic').updateOne({user1: topic.user1, cid: topic.cid}, {$set: {updated: topic.updated, unread: 0}})
    if(topic.user1 !== topic.user2) t2 = await client.db('chat').collection('topic').updateOne({user1: topic.user2, cid: topic.cid}, {$set: {updated: topic.updated, unread: topic2.unread + topic.unread}})
    if(!t1) return res.send('')
    return res.json(t1)
})

app.post('/readTopic', async function(req, res) {
    let body = req.body
    let payload
    Object.keys(body).map(key => payload = JSON.parse(key))
    let topic = payload.payload
    let r = await client.db('chat').collection('topic').updateOne({user1: topic.user1, cid: topic.cid}, {$set: {unread: 0}})
    if(!r) res.send('')
    return res.json(r)
})

app.post('/loadMoreTopics', async function(req, res) {
    let limit = parseInt(req.query.limit)
    let uid = req.query.uid
    let anchor = parseInt(req.query.anchor)
    let cursor = client.db('chat').collection('topic').find({user1: uid}).sort({updated: -1}).skip(anchor).limit(limit)
    let r = await cursor.toArray()
    return res.json(r)
})

app.get('/time', function(req, res) {
    return res.send(new Date())
})

server.listen(3000, async _ => {
    console.log('Server is running at http:localhost:3000')
    initSocket()
})

function initSocket() {

    io.on('connection', function(socket) {
        socket.on('joinRoom', cid => {
            socket.leaveAll()
            socket.join(`${cid}`)
        })

        socket.on('chat', msg => {
            io.to(`${msg.cid}`).emit('chat', msg)
        })

        socket.on('update topic', topic => {
            socket.broadcast.emit('update topic', topic)
        })

        socket.on('disconnect', () => {
            console.log('disconnect')
        })
    })

}

