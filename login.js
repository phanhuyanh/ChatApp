const client = require('./connect.js')

module.exports = async function(req, res, next) {
    if(req.path == '/login' || req.path == '/sign-in') {
        return next()
    }
    let email = req.signedCookies.email
    let password = req.signedCookies.password

    if(!email || !password) return res.redirect('/login')
    let account = await findAccount(email, password)
    if(account) return next()
    return res.redirect('/login')
}

async function findAccount(email, password) {
    let account = await client.db('chat').collection('account').findOne({email: email, password: password})
    return account
}