var express = require('express');
var bodyParser = require('body-parser');
var QRCode = require('qrcode');
const nodemailer = require("nodemailer");
var router = express.Router();
var config = require('../config/env_production.js');

var jsonParser = bodyParser.json()

/* QR Code generation */
router.post('/api/qrcode', jsonParser, function (req, res) {
    QRCode.toString(req.body.data,
        {
            type: "svg",
            width: 512,
            margin: 1,
            color: {
                dark: "#222",
                light: "#2fcc76"
            }
        }, function (err, string) {
            if (err) throw err
            res.send(string);
        })
});

/*Oculus Email Pairing Functionality*/
async function sendMail(toAddress, urlToSend) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: config.sendGridUser, // generated ethereal user
        pass: config.sendGridPass, // generated ethereal password
      },
    });
  
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: '"MUVR Pairing" <pairing@muvr.xyz>', // sender address
      to: toAddress, // list of receivers
      subject: "Pair Oculus Quest with MUVR", // Subject line
      html: urlToSend, // html body
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
  }

router.post('/api/email', jsonParser, function (req, res) {
    console.log(req.body.toAddress, req.body.room);
    var urlToSend = "https://" + config.tld + "/app/caster#" + req.body.room;
    sendMail(req.body.toAddress, urlToSend).catch(console.error);
    res.send('OK');
});

module.exports = router;