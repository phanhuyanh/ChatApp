const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://Chat-App:phanhuyanh@cluster0-boowr.mongodb.net/test?retryWrites=true&w=majority'
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function main() {
    try {
        await client.connect()
        console.log('Connect database success')
    }
    catch {
        console.log('Connect database fail')
    }
}

main().catch(err => err)

module.exports = client;
