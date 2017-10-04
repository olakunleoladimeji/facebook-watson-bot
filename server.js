const express = require("express"),
    bodyParser = require("body-parser"),
    dotenv = require("dotenv"),
    watson = require("watson-developer-cloud"),
    request = require("request"),
    _ = require("lodash"),
    debug = require("debug")("mcb-bot-messenger"),
    winston = require("winston");

const config = dotenv.config();

if (config.error) {
    throw config.error;
}
// Start debug instance

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
    let messaging_events = req.body.entry[0].messaging || [];
    let context = null,
        contextIndex = 0;
    console.log(JSON.stringify(messaging_events))
    // console.log(messaging_events);
    for (let index = 0; index < messaging_events.length; index++) {
        let event = req.body.entry[0].messaging[index];
        let sender = event.sender.id;
        let text = ""
        if (event.message && event.message.text) {
            if (event.message.quick_reply && event.message.quick_reply.payload) {
                text = event.message.quick_reply.payload;
            } else {
                text = event.message.text;
            }
        } else if (event.postback && event.postback.payload) {
            text = event.postback.payload;
        }
        contexts.forEach(function (value, index, array) {
            if (value.from == sender) {
                console.log("Context here")
                context = value.context;
                contextIndex = index
            }
        })
        console.log("Current context is", context)
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
                        from: sender,
                        context: response.context
                    })
                } else {
                    contexts[contextIndex].context = response.context
                }
                if (_.find(response.intents, ["intent", "Hello"]) && _.isEmpty(response.entities)) {
                    sendButtonMessage(sender, "Hello, Welcome to MCB. Would you like information regarding any of the following?", [{
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
                    sendQuickReplies(sender, `${response.output.text[0]} \n Ok first and foremost, what is your resident status?`, [{
                        content_type: "text",
                        title: `Mauritian Resident`,
                        payload: "Mauritian living in Mauritius"
                    }, {
                        content_type: "text",
                        title: "Non-Resident Mauritian",
                        payload: "Mauritian living abroad"
                    }, {
                        content_type: "text",
                        title: "Foreigner living abroad",
                        payload: "Foreigner living abroad"
                    }, {
                        content_type: "text",
                        title: "Foreigner interested in Mauritius",
                        payload: "Foreigner looking to move to Mauritius"
                    }, {
                        content_type: "text",
                        title: "Expat in Mauritius",
                        payload: "Expat working in Mauritius"
                    }])
                } else if (_.find(response.intents, ["intent", "residentstatus"])) {
                    sendQuickReplies(sender, "Do you by any chance already have an account at MCB", [{
                        content_type: "text",
                        title: "Yes",
                        payload: "Yes"
                    }, {
                        content_type: "text",
                        title: "No",
                        payload: "No"
                    }])
                } else if (_.find(response.intents, ["intent", "YESaccount"])) {
                    sendQuickReplies(sender, response.output.text[0], [{
                        content_type: "text",
                        title: "Rs75,000- 150,000",
                        payload: "Rs75,000- 150,000"
                    }, {
                        content_type: "text",
                        title: "Rs150,000- 300,000",
                        payload: "Rs150,000- 300,000"
                    }, {
                        content_type: "text",
                        title: "Rs300,000 onwards",
                        payload: "Rs300,000 onwards"
                    }])
                } else if (_.find(response.intents, ["intent", "Investmentamount"])) {
                    sendQuickReplies(sender, response.output.text[0], [{
                        content_type: "text",
                        title: "Rs1,000,000- Rs2,000,000",
                        payload: "Rs1m to Rs2m"
                    }, {
                        content_type: "text",
                        title: "Rs2,000,000-Rs3,000,000",
                        payload: "Rs2m to Rs3m"
                    }, {
                        content_type: "text",
                        title: "Rs3,000,000+",
                        payload: "Rs3m upwards"
                    }])
                } else if (_.find(response.entities, ["entity", "Yearlyincome"])) {
                    sendQuickReplies(sender, response.output.text[0], [{
                        content_type: "text",
                        title: "Yes",
                        payload: "Yesinvest"
                    }, {
                        content_type: "text",
                        title: "No",
                        payload: "Noinvest"
                    }])
                } else if (_.find(response.entities, ["entity", "Investment"])) {
                    sendQuickReplies(sender, response.output.text[0], [{
                        content_type: "text",
                        title: "Not Interested",
                        payload: "I already have a portfolio of investments"
                    }, {
                        content_type: "text",
                        title: "Might be Interested",
                        payload: "I am an active investor who follows the markets regularly"
                    }, {
                        content_type: "text",
                        title: "I'm interested",
                        payload: "I would like to invest but do not have the time or expertise"
                    }])
                } else {
                    sendTextMessage(sender, response.output.text[0])
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

/**
 * 
 * @param {number} recipient 
 * @param {string} text 
 * @param {Array<JSON>} quick_replies 
 */
function sendQuickReplies(recipient, text, quick_replies) {
    request({
        method: "POST",
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {
            access_token: token
        },
        json: {
            recipient: {
                id: recipient
            },
            message: {
                text: text,
                quick_replies: quick_replies
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