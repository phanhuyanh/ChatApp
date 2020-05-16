const host = window.location.origin || 'http://localhost:3000'
const limit = 20
_ = _.noConflict()
const socket = io()
console.log(window.location, host)
new Vue({
    el: '#app',
    data: function() {
        return {
            showSearch: false,
            accId: '',
            topics: [],
            me: {},
            searchUsers: [],
            conversation: [],
            users: {},
            currTopic: '',
            text: '',
            anchor: 0
        }
    },
    async created() {
        this.accId = await this.fetchAPI(`${host}/getData`, 'POST')
        this.topics = await this.fetchAPI(`${host}/topics?limit=${limit}`, 'POST')
        this.currTopic = _.get(this.topics.sort((a,b) => b.updated - a.updated), '0')
        this.me = await this.fetchAPI(`${host}/getMe`, 'POST')
        for(let topic of this.topics) {
            if(!this.users[topic.user1]) {
                let user = await this.getUser(topic.user1)
                this.users[user.id] = user
            }
            if(!this.users[topic.user2]) {
                let user = await this.getUser(topic.user2)
                this.users[user.id] = user
            }
        }
        this.getConversation(_.get(this.currTopic, 'cid'))

        socket.on('chat', msg => {
            console.log(msg, 'msg')
            this.conversation.push(msg)
            this.$nextTick(() => {
                this.scrollBottom()
            })
        })

        socket.on('update topic', topic => {
            console.log(topic, 'update topic')
            if(topic.user1 !== this.me.id && topic.user2 !== this.me.id) return
            let idxTopic = this.topics.findIndex(e => e.cid === topic.cid)
            if(idxTopic === -1) return this.newTopic(topic)

            this.$set(this.topics[idxTopic], 'updated', topic.updated)
            if(this.currTopic.cid === topic.cid) return this.readTopic(topic)
            this.$set(this.topics[idxTopic], 'unread', ~~this.topics[idxTopic].unread + topic.unread)
        })
    },
    watch: {
        currTopic(topic) {
            this.initSocket(topic)
        },
    },
    mounted() {
        setTimeout(() => this.scrollBottom(), 1000)
        var ul = document.querySelector('.topic-body ul')
        ul.onscroll = e => {
            let scrollTop = e.target.scrollTop
            let scrollHeight = e.target.scrollHeight
            let height = e.target.clientHeight
            if(scrollHeight !== scrollTop + height) return
            this.loadMoreTopics()
        }
    },
    computed: {
        topicSort() {
            return this.topics.sort((a,b) => b.updated - a.updated)
        }
    },
    methods: {
        async loadMoreTopics() {
            let moreTopics = await this.fetchAPI(`${host}/loadMoreTopics?limit=${this.anchor}&uid=${this.me.id}&anchor=${this.anchor}`, 'POST')
            this.anchor += moreTopics.length
            console.log(moreTopics, 'moreTopics')
        },
        async newTopic(topic) {
            let user = await this.getUser(topic.user1)
            this.users[user.id] = user
            this.topics.unshift(topic)
        },
        format(timeMs) {
            return dayjs(timeMs).format('hh:mm DD/MM/YYYY')
        },
        timeAgo(timeMs) {
            return timeago.format(timeMs)
        },
        scrollBottom() {
            var conversationBody = this.$el.querySelector('.conversation-body')
            conversationBody.scrollTop = conversationBody.scrollHeight
        },
        initSocket(topic) {
            console.log('init', topic)
            socket.emit('joinRoom', topic.cid)
        },
        logout() {
            console.log('click')
            document.cookie = "email=''; password='';"
            window.location.href = '/login'
        },
        async fetchAPI(url, method, data = {}) {
            var result

            const response = await fetch(url, {
                method: method, 
                headers: {
                //'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: JSON.stringify(data)
            })
            result = await response.text();
            
            //console.log(result, 'result')
            try {
                JSON.parse(result)
                return JSON.parse(result)
            }
            catch {
                return result
            }
        },
        getFirstLetter(str) {
            return  _.get(str, '0')
        },
        async searchUser(value) {
            console.log(value, 'value')
            if(!value.trim()) return
            let users = await this.fetchAPI(`${host}/searchUsers?search=${value}`, 'POST')
            console.log(users, 'users')
            try {
                JSON.parse(users)
                this.searchUsers = JSON.parse(users)
            }
            catch {
                this.searchUsers = users
            }
        },
        async loadConversation(uid) {
            let uid1 = this.me.id
            let uid2 = uid
            let topic = await this.fetchAPI(`${host}/getTopic?u1=${uid1}&u2=${uid2}`, 'POST')
            //console.log(topic, 'topic')
            if(!topic) {
               topic = this.fetchAPI(`${host}/createTopic?u1=${uid1}&u2=${uid2}`, 'POST') 
            }
            if(!this.topics.some(t => t.id === topic.id)) this.topics.push(topic)
            this.currTopic = topic
            await this.getConversation(topic.cid)
        },
        async getConversation(cid) {
            let conversation = await this.fetchAPI(`${host}/getConversation?cid=${cid}`, 'POST')
            this.conversation = conversation
            this.$nextTick(() => this.scrollBottom())
        },
        async getUser(uid) {
            let user = await this.fetchAPI(`${host}/getUser?uid=${uid}`, 'POST')
            return user || {}
        },
        getUserFromTopic(topic) {
            let uid
            if(topic.user1 == this.me.id) uid = topic.user2
            else uid = topic.user1
            return this.users[uid]
        },
        getPropertyName(obj) {
            return _.get(obj, 'name')
        },
        getPropertyJob(obj) {
            return _.get(obj, 'job')
        },
        async sendMessage() {
            this.text = this.text.trim()
            if(!this.text) return
            let cid = _.get(this.currTopic, 'cid')
            let message = {
                cid: cid,
                timestamp: Date.now(),
                msg: this.text,
                by: this.me.id
            }
            console.log(message)
            let topic = _.cloneDeep(this.currTopic)
            topic.updated = Date.now()
            topic.unread = 1
            this.$set(this.currTopic, 'updated', topic.updated)
            socket.emit('chat', message)
            socket.emit('update topic', topic)
            this.text = ''
            this.scrollBottom()

            let result = await this.fetchAPI(`${host}/createMessage`, 'POST', { payload: message })
            let topicUpdate = await this.fetchAPI(`${host}/update-topic`, 'POST', {payload: topic})
            if(!result || !topicUpdate) alert('message sent error')
        },
        async readTopic(topic) {
            if(_.get(this.currTopic, 'unread') === 0) return
            this.$set(this.currTopic, 'unread', 0)
            let r = await this.fetchAPI(`${host}/readTopic`, 'POST', {payload: topic})
            if(!r) alert('Read Topic error')
        }
    },
})