var log=require('./log.js');
var appSettings = require('./appSettings.js');
var sendgrid  = require('sendgrid')(appSettings.sendgridUsername, appSettings.sendgridPassword);

function sendSingleTextMail(from, to, subject, message){
  var payload   = {
    to      : to,
    from    : from,
    subject : subject,
    text    : message
  }

  sendgrid.send(payload, function(err, json) {
    if (err) {
        log(JSON.stringify(err));
    }
    log(JSON.stringify(json));
  });
}

function sendSingleTextMailBCC(from, to, bcc, subject, message){
  var payload   = {
    to      : to,
    from    : from,
    subject : subject,
    text    : message
  }

  if(bcc){
    payload.bcc = bcc;
  }


  sendgrid.send(payload, function(err, json) {
    if (err) {
        log(JSON.stringify(err));
    }
    log(JSON.stringify(json));
  });
}

function sendSingleHtmlMail(from, to, cc, subject, message){
  var payload   = {
    to      : to,
    from    : from,
    subject : subject,
    html    : message
  }
  if(cc){
    payload.cc =cc;
  }

  sendgrid.send(payload, function(err, json) {
    if (err) {
        log(JSON.stringify(err),true);
    }
    log(JSON.stringify(json),true);
  });
}




module.exports = {
    sendSingleTextMail:sendSingleTextMail,
    sendSingleHtmlMail:sendSingleHtmlMail,
    sendSingleTextMailBCC:sendSingleTextMailBCC,
}