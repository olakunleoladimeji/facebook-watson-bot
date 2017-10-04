const express = require("express"),
    bodyParser = require("body-parser"),
    dotenv = require("dotenv"),
    watson = require("watson-developer-cloud"),
    request = require("request"),
    _ = require("lodash");

const config = dotenv.config();

if (config.error) {
    throw config.error;
}
let app = express();

let contexts = [];

let conversationInstance = new watson.ConversationV1({
    username: process.env.WATSON_USERNAME,
    password: process.env.WATSON_PASSWORD,
    url: "https://gateway.watsonplatform.net/conversation/api",
    version_date: watson.ConversationV1.VERSION_DATE_2017_04_21
})

let token = process.env.FB_PAGE_ACCESS_TOKEN
let secret = process.env.FB_SECRET;

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('up');
});

app.get("/webhook", function (req, res) {
    if (req.query['hub.verify_token'] === secret) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Error, wrong validation token');

    }
})

app.post("/webhook", function (req, res) {
    let messaging_events = req.body.entry[0].messaging;
    let context = null,
        contextIndex = 0,
        anotherContextIndex = 0;
    console.log(messaging_events);
    for (let index = 0; index < messaging_events.length; index++) {
        let event = req.body.entry[0].messaging[index];
        let sender = event.sender.id;
        let text = ""
        if (event.message && event.message.text) {
            text = event.message.text;
        } else if (event.postback && event.postback.payload) {
            text = event.postback.payload;
        }
        contexts.forEach(function (value, currIndex, array) {
            if (value.from == sender) {
                context = value.context;
                contextIndex = anotherContextIndex
            }
            anotherContextIndex++;
        })
        conversationInstance.message({
            input: {
                text: text
            },
            workspace_id: process.env.WATSON_WORKSPACE_ID,
            context: context
        }, function (error, response) {
            if (error) {
                console.log(error)
                sendTextMessage(sender, "There was an error returning a response")
            } else {
                console.log(response)
                if (!context) {
                    contexts.push({
                        from: "sender",
                        context: response.context
                    })
                } else {
                    contexts[contextIndex].context = response.context
                }
                if (_.find(response.intents, ["intent", "Hello"])) {
                    sendButtonMessage(sender, response.output.text[0], [{
                        type: "postback",
                        title: "Private Banking",
                        payload: "I would like to join Private Banking"
                    }, {
                        type: "postback",
                        title: "Card Issues",
                        payload: "I would like to report card issues"
                    }, {
                        type: "postback",
                        title: "Juice/Internet Banking",
                        payload: "Internet Login"
                    }])
                } else if (_.find(response.intents, ["intent", "PrivateBanking"])) {
                    sendButtonMessage(sender, `${response.output.text[0]} \n Ok first and foremost, what is your resident status?`, [{
                        type: "postback",
                        title: `Mauritian Resident`,
                        payload: "Mauritian living in Mauritius"
                    }, {
                        type: "postback",
                        title: "Non-Resident Mauritian",
                        payload: "Mauritian living abroad"
                    }, {
                        type: "postback",
                        title: "Foreigner living abroad",
                        payload: "Foreigner living abroad"
                    }, {
                        type: "postback",
                        title: "Foreigner looking to move to Mauritius",
                        payload: "Foreigner looking to move to Mauritius"
                    }, {
                        type: "postback",
                        title: "Expat in Mauritius",
                        payload: "Expat working in Mauritius"
                    }])
                } else {
                    sendTextMessage(sender, "Hello, Welcome to MCB. Would you like information regarding any of the following?")
                }
            }
        })

    }
    res.sendStatus(200);
})

/**
 * 
 * @param {number} recipient 
 * @param {string} text 
 */
function sendTextMessage(recipient, text) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {
            access_token: token
        },
        method: "POST",
        json: {
            recipient: {
                id: recipient
            },
            message: {
                text: text
            }
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    })
}

/**
 * 
 * @param {number} recipient 
 * @param {string} text 
 * @param {Array<JSON>} buttons 
 */
function sendButtonMessage(recipient, text, buttons) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {
            access_token: token
        },
        method: "POST",
        json: {
            recipient: {
                id: recipient
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text,
                        buttons: buttons
                    }
                }
            }
        }
    }, function (error, response, body) {
        if (error)
            console.log("Error sending message: ", error)
        else if (response.body.error)
            console.log("Error: ", response.body.error)
    })
}

app.listen(process.env.PORT || 5000, function () {
    console.log(`Listening on port ${process.env.PORT}`)
})