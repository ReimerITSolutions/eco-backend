var mongoose = require('mongoose');
var url = require('url');
var sanitizeHtml = require('sanitize-html');
var https = require('https');
var http = require('http');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var fs = require('fs');

var appSettings = require('./appSettings.js');
var log = require('./log.js');



appSettings.mongoBackendConnection  = mongoose.createConnection('mongodb://'+ appSettings.mongoBackendDBUser + ":" + appSettings.mongoBackendDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseBackendDB);
appSettings.mongoIDPConnection = mongoose.createConnection('mongodb://'+ appSettings.mongoIDPDBUser + ":" + appSettings.mongoIDPDBPassword + '@' + appSettings.mongoHost + ':' + appSettings.mongoPort + '/' +appSettings.mongooseIDPDB);

appSettings.mongoBackendConnection.on('error', console.error.bind(console, 'connection error:'));
appSettings.mongoBackendConnection.once('open', function callback (){
    debugger;
    log('Backend MongoDB connected',true);

    if(fs.existsSync('inProcessXapiQueue') ){
        log('Semaphore present. Quiting...',true);
        mongoose.disconnect();
        process.exit(code=0);
    } else {
      // set sempafhore...
      fs.closeSync(fs.openSync('inProcessXapiQueue', 'w'));

      util.inherits(xApiQueueProcessor, EventEmitter);
      xApiQueueProcessor = new xApiQueueProcessor();
      xApiQueueProcessor.process();
    }

});

var models=require('./models.js');
var utils = require('./utils.js');


var xApiQueueProcessor = function(){
    var self=this;
    this.process=function(){
      models.XapiQueue.find({committedTimestamp:null}).sort({recievedTimestamp:1}).limit(1000).exec(function (err, theQueue){
      //models.XapiQueue.find({_id:"56905f49d9352d3817f65ba3"}).sort({recievedTimestamp:1}).exec(function (err, theQueue){
      debugger;
      if (err){
        exit('Error finding records. Error: ' + JSON.stringify(err) + '.Process aborted.');
      } else {
          self.xApiRecordPointer = -1;
          self.xApiRecords = theQueue;
          log('Start sending ' + self.xApiRecords.length + ' statements...',true);
          self.emit('sendStatement');
      }
      });
    }

    this.on('sendStatement', function(){
        self.xApiRecordPointer++;
        if(self.xApiRecordPointer>=self.xApiRecords.length){
          exit('Finished!');
        } else {
            var statement= {
                actor: self.xApiRecords[self.xApiRecordPointer].actor,
                verb: self.xApiRecords[self.xApiRecordPointer].verb,
                object: self.xApiRecords[self.xApiRecordPointer].object,
                timestamp : self.xApiRecords[self.xApiRecordPointer].recievedTimestamp,
                version: "1.0.1"
            }
            var postData=JSON.stringify(statement);

            self.xApiRecords[self.xApiRecordPointer].xApiStatement =postData;
            self.xApiRecords[self.xApiRecordPointer].save(function (err, xApi){
                if (err) {
                    exit('Error updating xApi statement. Error: ' + JSON.stringify(err) + '.Process aborted.');
                }
            });

            var authBuffer = new Buffer(appSettings.LRSUser + ":" + appSettings.LRSPassword);
            var headers = {
                'Content-Type':'application/json',
                'X-Experience-API-Version': '1.0.0',
                'Authorization': 'Basic ' + authBuffer.toString('base64')
            }

            debugger;

            utils.urlPOSTRequest(appSettings.LRSUrl,postData,headers, appSettings.httpRequestTimeout)
            .then(function(data){
                try {
                    response = JSON.parse(data);
                } catch(e) {
                    response=null;
                    log('Xapi Proxy returned invalid JSON response: ' + data + '.  xApi statement: ' + self.xApiRecords[self.xApiRecordPointer].xApiStatement,true);
                }

                // test for 2 properties: result and id
                debugger;
                if(!(response && response.hasOwnProperty('result') && response.hasOwnProperty('id'))){
                    log('Xapi Proxy  returned invalid JSON response: ' + data + '.  xApi statement: ' + self.xApiRecords[self.xApiRecordPointer].xApiStatement,true);
                    self.emit('sendStatement');
                } else if(response.result !== 'ok'){
                    log('Xapi Proxy  returned an error: ' + JSON.stringify(response) + '  xApi statement: ' + + self.xApiRecords[self.xApiRecordPointer].xApiStatement,true);
                    self.emit('sendStatement');
                } else {
                    self.xApiRecords[self.xApiRecordPointer].committedTimestamp =  new Date();
                    self.xApiRecords[self.xApiRecordPointer].UUID =  response.id
                    self.xApiRecords[self.xApiRecordPointer].save(function (err, xApi){
                        // go on to the next statement when the result is saved. Otherwise,
                        // at the end of the list the process will exit, always leaving some records not marked
                        // as being committed. They will be sent again....
                        if (err) {
                            exit('Error updating xApi statement. Error: ' + JSON.stringify(err) + '.Process aborted.');
                        }
                        self.emit('sendStatement');
                    });
                }
            })
            .fail(function(err){
                log('ERROR: Url POST Request Fault:' + err +  JSON.stringify(err),true);
                self.emit('sendStatement');
            })
            .fin(function(){
                log('Sent statement ' + (self.xApiRecordPointer+1),true);
            })
        }
    });

    function exit(msg){
            log(msg,true);
            mongoose.disconnect();
            // delete sempaphore...
            fs.unlinkSync('inProcessXapiQueue');
            process.exit(code=0);
    }

};

