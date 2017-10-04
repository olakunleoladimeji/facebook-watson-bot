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
    }
    res.send('Error, wrong validation token');
})

app.post("/webhook", function (req, res) {
    let messaging_events = req.body.entry[0].messaging;
    for (let index = 0; index < messaging_events.length; index++) {
        let event = req.body.entry[0].messaging[index];
        let sender = event.sender.id;
        if (event.message && event.message.text) {
            let text = event.message.text
            conversationInstance.message({
                input: {
                    text: text,
                    context: contexts,
                    workspace_id: process.env.WATSON_WORKSPACE_ID
                }
            }, function (error, response) {
                if (error)
                    sendTextMessage(sender, "There was an error returning a response")
                else {
                    if (_.find(response.intents, ["intent", "Hello"])) {
                        sendButtonMessage(sender, "Hello, Welcome to MCB. What would you like information about?", [{
                            type: "postback",
                            title: "Private Banking",
                            payload: "I would like to join Private Banking"
                        }, {
                            type: "postbacl",
                            title: "Card Issues",
                            payload: "I would like to report card issues"
                        }, {
                            type: "postback",
                            title: "Juice/Internet Banking",
                            payload: "Internet Login"
                        }])
                    } else {
                        sendTextMessage(sender, response.output.text[0])
                    }
                }
            })
        }

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