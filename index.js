const 
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());

const ngrok = require('ngrok');
const request = require('request');
const dotenv = require('dotenv');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const port = process.env.PORT || 1337;

let baseURL = process.env.BASE_URL; // base URL for webhook server

dotenv.config();

app.post('/webhook', (req, res) => {

    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {            

            if (entry.messaging) {
                let event = entry.messaging[0];
                let sender_psid = event.sender.id;
                
                console.log(event);

                if (event.message) {
                    handleMessage(sender_psid, event.message);
                } else if (event.postback) {
                    handlePostback(sender_psid, event.postback);
                }
            }
        });
        
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }

});

app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = process.env.VERIFY_TOKEN
      
    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
      
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
    
      // Checks the mode and token sent is correct
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        
        // Responds with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);      
      }
    }
  });

  // Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;

    // Check if the message contains text
    if (received_message.text) {    
  
      // Create the payload for a basic text message
      response = {
        "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
      }

    } else if (received_message.attachments)  {

        // Gets the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
              "type": "template",
              "payload": {
                "template_type": "generic",
                "elements": [{
                  "title": "Is this the right picture?",
                  "subtitle": "Tap a button to answer.",
                  "image_url": attachment_url,
                  "buttons": [
                    {
                      "type": "postback",
                      "title": "Yes!",
                      "payload": "yes",
                    },
                    {
                      "type": "postback",
                      "title": "No!",
                      "payload": "no",
                    }
                  ],
                }]
              }
            }
          }
    }
    
    // Sends the response message
    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    let response;
  
    // Get the payload for the postback
    let payload = received_postback.payload;
  
    // Set the response based on the postback payload
    if (payload === 'yes') {
      response = { "text": "Thanks!" }
    } else if (payload === 'no') {
      response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

app.listen(port, () => {
  if (baseURL) {
    console.log(`listening on ${baseURL}:${port}/webhook`);
  } else {
    console.log("It seems that BASE_URL is not set. Connecting to ngrok...");
    (async function() {
      const url = await ngrok.connect(port);
      if (url) {
        baseURL = url;
        console.log(`listening on ${baseURL}/webhook`);
      }
    })();
  }
});